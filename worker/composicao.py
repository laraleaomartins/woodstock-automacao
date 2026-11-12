# ============================================================================
# DESATIVADO EM 12/11/2026 — o sistema nao gera mais arte.
#
# O Woodstock virou um painel de coleta: a banda manda os dados e as fotos, e as
# artes sao feitas fora do sistema. Nada aqui foi apagado nem comentado — este
# arquivo continua inteiro e funcionando. O que mudou e que ninguem o chama: o
# agendamento da oficina saiu de .github/workflows/artes.yml e a chave
# MOTOR_DE_ARTES_LIGADO, em apps-script/00_Config.gs, esta em false.
#
# Por que nao foi apagado: isto custou dezenas de defeitos reais para ficar de pe —
# a memoria que o motor dos modelos nao devolve, o contorno cinza da mascara dura,
# a polaroide que cortava o artista, o grupo que flutuava enfileirado. Reescrever
# seria pagar tudo de novo. A decisao de fazer as artes por fora pode ser revertida.
#
# PARA RELIGAR: ver o cabecalho de .github/workflows/artes.yml.
# ============================================================================

"""
Encaixa a foto já tratada no espaço que cada peça reserva para ela.

Por que isto existe
-------------------
O gerador do kit posiciona a foto com `object-fit: contain` e a altura travada no
tamanho do espaço. Traduzindo: se a foto for mais DEITADA que o espaço, o
navegador encolhe a foto inteira até a largura caber — e, como o encaixe é pelo
rodapé (`object-position: bottom`), a banda desce e vai parar exatamente onde o
logotipo e o nome são escritos. Foi assim que a pessoa saiu pequena e tapada pela
logo, e nenhum ajuste de recorte resolvia, porque o problema não era o recorte: era
a FORMA da imagem entregue ao layout.

A solução não mexe no layout. A foto é entregue já na forma do espaço: tela
transparente com a mesma proporção do vão, pessoa colada no topo e centralizada.
Com a proporção certa o navegador nunca precisa encolher nada, o encaixe pelo
rodapé deixa de ter efeito, e quem manda na altura da pessoa passa a ser este
arquivo — não o acaso do formato que a banda mandou.

É também o que as referências do kit mostram: a pessoa recortada começa no alto do
espaço e desce ocupando tudo, com as pernas se dissolvendo no escurecido do rodapé.
"""
import numpy as np
from PIL import Image

# Largura útil e altura do espaço da foto em cada peça, lidos do render3.js.
# São os números do formato STORY, que é o mais estreito dos dois: uma foto que
# serve no story sobra de largura no feed, e sobra de largura não atrapalha — o
# que atrapalha é faltar. Ao contrário, se fosse pelo feed, no story a foto seria
# encolhida e voltaria o defeito que este módulo existe para evitar.
#   A  — tarja rasgada: foto centrada sobre o fundo preto, 1080 x 840
#   B  — coluna vermelha + caixa com meio-tom: o vão vai da coluna à borda
#   C  — polaroide inclinada: o retrato dentro do cartão
ESPACOS = {
    "A": (1080, 840),
    "B": (830, 1050),
    "C": (816, 640),
}

# Como a foto se comporta dentro do espaço. São duas coisas diferentes, e tratar as
# duas do mesmo jeito foi o erro que deixou a polaroide com cara de colagem.
#
#   "solto"   — peças A e B. Não existe moldura: a pessoa recortada aparece sobre o
#               fundo da própria arte (o preto com o facho vermelho, na A; o escuro
#               com meio-tom, na B). Folga escura em volta é o normal, e é assim nas
#               referências do kit: a figura inteira cabe, e o fundo da peça respira
#               em volta dela.
#
#   "moldura" — peça C, a polaroide. Aqui existe um quadro visível, com borda branca
#               e fundo escuro próprio. Se a pessoa só couber dentro dele, o que
#               aparece é um retângulo escuro com um recorte boiando no meio — foi
#               exatamente a reclamação: "foto flutuando" e "foto quadrada dentro do
#               quadro". Na referência do kit a banda PREENCHE a polaroide de ponta a
#               ponta e é cortada pelas bordas dela, como fotografia em porta-retrato.
#               Então aqui a foto cobre o quadro e sobra para fora.
MODO = {"A": "solto", "B": "solto", "C": "moldura"}

# Numa foto deitada demais, cobrir o quadro da polaroide custa cortar os lados. A
# referência do kit corta mesmo — o baixista continua para fora da borda — mas há
# limite: passar disto começa a jogar gente inteira para fora.
CORTE_LATERAL_MAXIMO = 0.18

# E numa foto estreita demais, cobrir custa cortar em cima e embaixo. Também tem
# limite: aproximar demais deixa de ser retrato e vira detalhe. Abaixo disto é
# melhor aceitar um pouco de fundo nas laterais do que picar a pessoa.
ALTURA_MINIMA_VISIVEL = 0.5

# Respiro acima da cabeça, em fração da altura do espaço. Sem nenhum, a cabeça
# encosta na borda do vão e a arte fica sufocada; com demais, a banda afunda.
# Os valores saem de medir as referências do kit: na peça A, onde a foto flutua
# solta sobre o fundo preto e tem o cabeçalho logo acima, o exemplo deixa cerca de
# 14% de respiro. Nas peças B e C a foto está dentro de uma caixa com borda
# própria — a coluna e a polaroide —, e aí o exemplo encosta a banda quase no alto,
# porque é a moldura que faz o papel do respiro.
FOLGA_TOPO = {"A": 0.13, "B": 0.04, "C": 0.05}

# Abaixo disto a pessoa ficou pequena demais dentro do espaço e a arte sai vazia.
# Acontece quando chega uma foto muito deitada para um vão alto e estreito.
ALTURA_POBRE = 0.55


def caixa_do_sujeito(imagem, minimo=24):
    """
    A moldura de quem realmente aparece na imagem, ou None se não aparece ninguém.

    A conta é feita só no canal de transparência, de propósito. O `getbbox` do
    Pillow olha todos os canais e conta um pixel como ocupado se qualquer um deles
    não for zero — então um pixel totalmente invisível, mas que carrega uma cor
    sobrando do fundo antigo, entraria na conta e esticaria a moldura para fora da
    pessoa. Quem mede com ele acha a banda mais larga do que ela é: na hora de
    encaixar, ela sai menor do que podia, empurrada por um resto que ninguém vê; na
    hora de escolher qual foto vai para qual peça, a conta de deitada ou em pé sai
    trocada. O corte em 24 ainda descarta a poeira quase invisível que o matting
    deixa em volta.
    """
    alfa = np.array(imagem.convert("RGBA").split()[3])
    linhas = np.where((alfa > minimo).any(axis=1))[0]
    colunas = np.where((alfa > minimo).any(axis=0))[0]
    if not len(linhas) or not len(colunas):
        return None
    return (int(colunas.min()), int(linhas.min()),
            int(colunas.max()) + 1, int(linhas.max()) + 1)


def _sujeito(imagem):
    """A parte que realmente aparece, sem as margens transparentes em volta."""
    caixa = caixa_do_sujeito(imagem)
    if not caixa:
        raise RuntimeError("a imagem está vazia: não há nada para encaixar")
    return dissolver_corte_reto(imagem.crop(caixa))


def dissolver_corte_reto(pessoa, cheio=0.6, dissolver=0.10):
    """
    Apaga por baixo o corte reto que a borda da fotografia deixou no corpo.

    Quando a foto original já vinha cortada na cintura, o recorte termina numa linha
    reta e horizontal: o tronco simplesmente acaba, como papel cortado com tesoura.
    Sobre o fundo da arte isso é o que mais denuncia colagem — a pessoa não termina,
    ela é interrompida.

    Dissolvendo os últimos por cento do corpo num degradê, o tronco passa a sumir no
    escuro em vez de acabar numa aresta. É o mesmo efeito que as peças A e B já
    fazem por conta própria com o escurecido do rodapé; aqui ele passa a valer
    também para a polaroide, que não tem esse recurso.

    Pé de pessoa em pé NÃO é corte reto: dois pés ocupam uma fatia estreita da
    largura. Por isso a conta olha o quanto da silhueta chega à última linha — corpo
    cortado chega quase inteiro, pé chega pouco.
    """
    alfa = np.array(pessoa.split()[3])
    presente = alfa > 40
    if not presente.any():
        return pessoa
    larguras = presente.sum(axis=1)
    if larguras[-1] < larguras.max() * cheio:
        return pessoa                      # termina em pé, pose ou instrumento

    alto = alfa.shape[0]
    faixa = max(2, int(alto * dissolver))
    rampa = np.ones(alto, float)
    rampa[-faixa:] = np.linspace(1, 0, faixa)
    pessoa = pessoa.copy()
    pessoa.putalpha(Image.fromarray((alfa * rampa[:, None]).astype("uint8"), "L"))
    return pessoa


def encaixar(entrada, saida, peca, cabeca=None):
    """
    Entrega a foto na forma exata do espaço da peça.

    Devolve a fração da altura do espaço que a pessoa ocupou — é a medida que
    denuncia arte vazia antes de ela ser publicada.
    """
    if MODO[peca] == "moldura":
        return _preencher_quadro(entrada, saida, peca, cabeca)

    largura, altura = ESPACOS[peca]
    pessoa = _sujeito(Image.open(entrada).convert("RGBA"))

    topo = int(altura * FOLGA_TOPO[peca])
    escala = min(largura / pessoa.width, (altura - topo) / pessoa.height)
    nova = (max(1, round(pessoa.width * escala)), max(1, round(pessoa.height * escala)))
    pessoa = pessoa.resize(nova, Image.LANCZOS)

    tela = Image.new("RGBA", (largura, altura), (0, 0, 0, 0))
    tela.alpha_composite(pessoa, ((largura - nova[0]) // 2, topo))
    casar_com_fundo(tela).save(saida)
    return nova[1] / altura


def casar_com_fundo(tela, fundir=0.26, sumir=0.12, resta=0.12):
    """
    Faz a figura recortada emergir do escuro, em vez de ficar pousada sobre ele.

    Recorte com opacidade igual de cima a baixo tem sempre um ar de adesivo: a
    pessoa acaba, de uma vez, num contorno. Nas referências do kit não é assim —
    o corpo vai escurecendo até se confundir com o fundo da peça, e o olho não
    encontra onde a foto termina. É o que esta função reproduz, e por isso ela faz
    DUAS coisas, não uma:

      - escurece o tom do rodapé da figura, para o corpo virar sombra antes de
        sumir. Só apagar a opacidade deixa a pessoa transparente, e dá para ver que
        há uma silhueta sumindo; escurecer junto faz dela parte do escuro;
      - e só então apaga a opacidade, no finzinho.

    As três peças têm o rodapé escuro, então isso casa em todas. O que sobra de
    brilho no fim (`resta`) existe para a transição não virar um corte preto.
    """
    alto = tela.height
    faixa = max(2, int(alto * fundir))
    rampa_tom = np.ones(alto, float)
    rampa_tom[-faixa:] = np.linspace(1.0, resta, faixa)

    faixa_alfa = max(2, int(alto * sumir))
    rampa_alfa = np.ones(alto, float)
    rampa_alfa[-faixa_alfa:] = np.linspace(1.0, 0.0, faixa_alfa)

    rgb = np.array(tela.convert("RGB"), float) * rampa_tom[:, None, None]
    alfa = np.array(tela.split()[3], float) * rampa_alfa[:, None]
    saida = Image.fromarray(np.clip(rgb, 0, 255).astype("uint8"), "RGB")
    saida.putalpha(Image.fromarray(alfa.astype("uint8"), "L"))
    return saida


def _preencher_quadro(entrada, saida, peca, cabeca=None):
    """
    Põe a imagem dentro do quadro da peça, INTEIRA, do maior tamanho que couber.

    A polaroide é deitada e a foto de banda quase sempre é em pé, então sobra
    altura. Houve três tentativas de escolher que faixa mostrar, e as três cortaram
    artista fora da arte:

      - pela faixa do meio: numa foto de alguém curvado, apareceu o tronco e a
        cabeça ficou acima do corte;
      - pelo alto da imagem: quem ergue a guitarra teve a cravelha enquadrada e o
        rosto cortado embaixo;
      - pela largura da silhueta, procurando a cabeça: a cravelha de uma guitarra
        também é larga — são seis tarraxas — e continuou sendo confundida com ela.

    Achar o rosto resolveria, mas exigiria um detector de rosto, que é peso novo
    para instalar em toda execução e mais uma coisa para errar.

    Então a regra passou a ser a que nunca erra: **não cortar**. A imagem entra
    completa, do maior tamanho que caiba, centralizada. O que sobra nas laterais é o
    fundo escuro do próprio porta-retrato — e porta-retrato com foto em pé dentro é
    coisa que todo mundo reconhece. Perder um pedaço da pessoa, não.

    O parâmetro `cabeca` continua aceito porque quem chama ainda o calcula para
    outras decisões; aqui ele não é mais necessário.
    """
    largura, altura = ESPACOS[peca]
    foto = _sujeito(Image.open(entrada).convert("RGBA"))

    escala = min(largura / foto.width, altura / foto.height)
    nova = (max(1, round(foto.width * escala)), max(1, round(foto.height * escala)))
    foto = foto.resize(nova, Image.LANCZOS)

    tela = Image.new("RGBA", (largura, altura), (0, 0, 0, 0))
    tela.alpha_composite(foto, ((largura - nova[0]) // 2, (altura - nova[1]) // 2))
    tela.save(saida)
    return nova[1] / altura


def _centro_do_interesse(foto):
    """
    Onde está o assunto da foto, para o escurecido das bordas não comer a pessoa.

    Num fundo de estúdio, o que tem detalhe é a pessoa: parede e degradê quase não
    mudam de um pixel para o vizinho, e rosto, roupa e instrumento mudam muito. A
    conta é a média das posições pesada por esse detalhe.
    """
    from scipy import ndimage

    cinza = np.array(foto.convert("L"), float)
    media = ndimage.uniform_filter(cinza, 9)
    media2 = ndimage.uniform_filter(cinza * cinza, 9)
    detalhe = np.sqrt(np.clip(media2 - media * media, 0, None))
    detalhe = np.clip(detalhe - np.median(detalhe), 0, None)
    if detalhe.sum() <= 0:
        return foto.width / 2, foto.height / 2
    ys, xs = np.indices(detalhe.shape)
    return (float((xs * detalhe).sum() / detalhe.sum()),
            float((ys * detalhe).sum() / detalhe.sum()))


def integrar_retangulo(entrada, saida, peca, cabeca=None):
    """
    Põe no espaço uma foto que não foi recortada, sem que ela vire um retângulo.

    O destino manda no tratamento, e são dois casos opostos:

      - PEÇA C, a polaroide. Ali existe uma moldura de verdade, com borda branca:
        o lugar é feito para receber uma fotografia, e a referência do kit mostra a
        banda preenchendo a polaroide de ponta a ponta. A foto entra cheia e
        limpa — esfumar as bordas dentro de um porta-retrato pareceria mancha.

      - PEÇAS A e B. Ali NÃO existe moldura: a foto cai direto sobre o fundo da
        arte. Uma fotografia inteira posta assim é um quadrado no meio do layout, e
        é o que não pode acontecer de jeito nenhum. Então a foto entra com as bordas
        escurecidas até o preto e apagadas antes de chegar à margem: o fundo de
        estúdio vira o fundo da peça, e não há aresta nenhuma para o olho achar.
        O escurecido é centrado em quem está na foto, não no meio do arquivo, para
        não comer a pessoa quando ela está de lado.
    """
    if MODO[peca] == "moldura":
        return _preencher_quadro(entrada, saida, peca, cabeca)
    return _dissolver_no_fundo(entrada, saida, peca)


def _dissolver_no_fundo(entrada, saida, peca, miolo=0.40, borda=0.98, resta=0.05):
    """
    Dissolve a foto no fundo da peça, de dentro para fora.

    A foto preenche o espaço e depois vai escurecendo e sumindo do assunto para as
    bordas, num degradê oval. O que sobra na arte é a pessoa emergindo do escuro da
    própria peça — sem aresta, sem quadrado, sem lugar onde o olho perceba que ali
    começou uma fotografia.

    São duas coisas somadas, e as duas são necessárias. Escurecer sozinho deixaria
    um retângulo cinza-escuro, mais claro que o fundo da arte: o quadrado continua
    lá, só que discreto. Apagar sozinho deixaria a foto virar fantasma translúcido,
    e dá para ver a forma sumindo. Escurecendo e apagando junto, a foto vira o
    próprio fundo.

    O centro do degradê é quem está na foto, não o meio do arquivo: numa foto em que
    a pessoa está de lado, escurecer a partir do meio comeria metade dela.
    """
    largura, altura = ESPACOS[peca]
    foto = Image.open(entrada).convert("RGBA")

    escala = max(largura / foto.width, altura / foto.height)
    foto = foto.resize((max(1, round(foto.width * escala)),
                        max(1, round(foto.height * escala))), Image.LANCZOS)
    cx, cy = _centro_do_interesse(foto)
    # A janela acompanha o assunto, para o corte não decepar a pessoa.
    x = int(min(max(cx - largura / 2, 0), foto.width - largura))
    y = int(min(max(cy - altura / 2, 0), foto.height - altura))
    foto = foto.crop((x, y, x + largura, y + altura))
    cx, cy = cx - x, cy - y

    # Distância até o assunto, medida em "raios": 0 em cima dele, 1 na borda.
    ys, xs = np.indices((altura, largura))
    raio = np.sqrt(((xs - cx) / (largura / 2)) ** 2 + ((ys - cy) / (altura / 2)) ** 2)
    queda = np.clip((raio - miolo) / max(borda - miolo, 1e-6), 0, 1)
    veu = np.cos(queda * np.pi / 2) ** 2          # suave nas duas pontas

    rgb = np.array(foto.convert("RGB"), float) * (resta + (1 - resta) * veu)[..., None]
    alfa = np.array(foto.split()[3], float) * veu
    pronta = Image.fromarray(np.clip(rgb, 0, 255).astype("uint8"), "RGB")
    pronta.putalpha(Image.fromarray(alfa.astype("uint8"), "L"))
    pronta.save(saida)
    return saida
