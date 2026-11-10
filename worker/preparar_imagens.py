"""
Prepara as imagens de uma banda para o gerador do kit.

Faz, em ordem:
  1. decide se aquela foto precisa ser recortada (ver abaixo);
  2. recorta, quando precisa (o kit faz isso à mão pelo ChatGPT; aqui usa o rembg,
     que é gratuito, roda sozinho e não depende de navegador aberto);
  3. trata em preto e branco com o tratar_foto.py do próprio kit;
  4. entrega cada peça com a foto já na forma do espaço dela (ver composicao.py);
  5. tira o fundo da logo com o tratar_logo.py do kit, escolhendo sozinho o modo.

Se a foto já vier recortada com fundo transparente, pula o rembg e usa direto —
é o que o kit manda fazer quando a banda envia o PNG pronto.

Quando recortar, e quando não
-----------------------------
Recorte não é um bem em si: ele existe para SEPARAR a pessoa do que está atrás
dela. Se não há o que separar, recortar só pode piorar — gasta minutos, arrisca
comer um pedaço de quem está na foto, e troca um fundo que já combinava com a arte
por uma silhueta com cara de adesivo.

A maioria das fotos que uma banda manda é de estúdio, com parede lisa ou degradê.
Essas entram INTEIRAS: no tamanho do espaço, em preto e branco, com as bordas
dissolvidas no fundo da arte. Medido no acervo do projeto, cinco de sete fotos
estavam nesse caso.

Recorta-se em dois casos, e só neles:
  - quando a inscrição traz integrantes em fotos separadas, para montar uma banda
    só. Aí separar é obrigatório: sem tirar o fundo de cada um, as pessoas não
    encaixam lado a lado;
  - quando o fundo atrapalha de verdade — palco com plateia, equipamento, luz
    quebrada —, caso em que deixá-lo seria pior que recortar.

Essa decisão já esteve errada duas vezes, nos dois sentidos, e as duas versões
produziram arte ruim. Primeiro o sistema só recortava fundo bagunçado, mas colava a
foto como um retângulo duro dentro do layout. Depois passou a recortar sempre, e aí
fotos de estúdio — que não precisavam de nada — viravam silhueta recortada boiando
num fundo escuro. O que faltava nas duas era a outra metade do trabalho: foto que
não é recortada precisa ser INTEGRADA, e recorte precisa CASAR com o fundo em vez
de parecer colado (composicao.integrar_retangulo e composicao.casar_com_fundo).

A leitura do fundo acerta as fotos do acervo, mas é uma medida com margem estreita.
Por isso há uma rede de segurança: fora da montagem, recorte que não sair confiável
é descartado e a foto entra inteira. Errar para o lado de não recortar custa pouco;
errar para o lado de publicar um recorte comido custa a arte.

uso: python preparar_imagens.py <pasta_entrada> <pasta_gerador> <id> [--json saida.json]
"""
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import composicao  # noqa: E402

AQUI = os.path.dirname(os.path.abspath(__file__))


def executar(args):
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(" ".join(args) + " falhou: " + (r.stderr or r.stdout)[-800:])
    return r.stdout.strip()


def tem_transparencia_real(caminho):
    """Alfa de verdade é fundo já recortado; alfa todo opaco não conta."""
    im = Image.open(caminho)
    if im.mode not in ("RGBA", "LA", "P"):
        return False
    im = im.convert("RGBA")
    a = np.array(im.split()[3])
    return bool((a < 16).mean() > 0.05)


MODELO_BOM = os.environ.get("REMBG_MODELO", "birefnet-general")
MODELO_CONFERENCIA = os.environ.get("REMBG_MODELO_CONFERENCIA", "u2net")
MODELO_RESGATE = os.environ.get("REMBG_MODELO_RESGATE", "isnet-general-use")
CONCORDANCIA_MINIMA = 0.88   # abaixo disso, junta o que cada modelo achou
CONCORDANCIA_RESGATE = 0.60  # abaixo disso, juntar cola fundo: fica só o melhor

# Abaixo disto a montagem de integrantes é recusada: o recorte está tão incerto
# que pôr essa pessoa ao lado das outras não vai dar certo.
#
# O número foi refeito depois que o recorte passou a usar matting. Antes a linha
# ficava em 0,60, herdada da época da máscara dura, quando discordância alta
# significava mesmo um bloco de fundo colado na pessoa. Medido agora, na foto mais
# difícil do acervo (a pessoa dentro da luz azul): concordância de 33%, e a arte
# montada saiu boa — sem bloco de fundo, com as cordas da guitarra inteiras e só o
# contorno do cabelo um pouco irregular. Com a linha em 0,60 essa inscrição era
# recusada e a banda mandada refazer trabalho à toa.
#
# A trava não foi removida, só recalibrada bem abaixo do pior caso que se provou
# aceitável. Fotos boas medem de 96% a 97%.
CONCORDANCIA_MONTAGEM = 0.25

# Resolução em que o recorte é calculado. O maior espaço de foto em qualquer peça
# tem 1080 de largura e 1050 de altura, então passar disso é detalhe que ninguém
# vai ver — e custa caro duas vezes: tempo e memória crescem com o número de
# pixels, e o recortador pede um bloco contínuo grande de uma vez só. Foto de
# celular chega com 3000 e poucos pixels; reduzir antes é o que mantém o recorte
# dentro do orçamento.
#
# Já esteve em 1280, e a oficina do GitHub morria por falta de memória — sem erro,
# sem mensagem, o processo simplesmente desaparecia. Em 1024 o número de pixels cai
# para dois terços, e a arte não perde nada que se veja: o recorte ainda é
# calculado acima do tamanho em que vai aparecer.
LADO_TRABALHO = int(os.environ.get("LADO_TRABALHO", "1024"))


_sessoes = {}


def sessao(modelo):
    """
    Guarda na memória UM recortador de cada vez.

    Carregar o modelo custa quase tanto quanto usá-lo, e uma banda manda até quatro
    fotos: guardar o principal entre as fotos economiza minutos.

    O que não dá é guardar todos. Houve uma versão que guardava — e os três
    recortadores mais o modelo de matting ficavam residentes ao mesmo tempo, somando
    mais de um giga só de pesos, antes de contar o espaço de trabalho de cada
    imagem. Na oficina do GitHub isso estourava a memória e o sistema operacional
    MATAVA o processo. Morte por falta de memória não é erro que dê para pegar: não
    há exceção, o programa simplesmente deixa de existir — então a tentativa de
    refazer menor nem chegava a rodar, a execução caía sempre aos três minutos, e a
    programação ficava presa em "gerando artes".

    Então só o modelo principal fica guardado — é ele que roda em toda foto, e é
    dele que vem a economia. Os de conferência passam por `conferidor`, que os
    carrega na hora e os descarta logo depois.
    """
    from rembg import new_session

    if modelo not in _sessoes:
        _sessoes.clear()
        _sessoes[modelo] = new_session(modelo)
    return _sessoes[modelo]


def conferidor(modelo, usar):
    """
    Empresta um recortador de conferência e o devolve à memória em seguida.

    `usar` recebe a sessão e devolve o resultado. Descartar explicitamente, em vez
    de esperar a faxina automática da linguagem, importa aqui: o peso do modelo vive
    fora do controle do Python, dentro do motor que executa a rede, e só some quando
    a sessão é solta. Guardar os três ao mesmo tempo foi o que matou a oficina.
    """
    import gc

    from rembg import new_session

    sessao_temporaria = new_session(modelo)
    try:
        return usar(sessao_temporaria)
    finally:
        del sessao_temporaria
        gc.collect()


def _mascara_de_bytes(dados):
    import io as _io
    return np.array(Image.open(_io.BytesIO(dados)).convert("RGBA").split()[3]) > 128


def _mascara(caminho):
    return np.array(Image.open(caminho).convert("RGBA").split()[3]) > 128


def suavizar_borda(alfa, encolher=1, esfumar=1.4):
    """
    Esfuma a borda do recorte.

    Recorte feito por máscara sai com borda em degrau, e ainda carrega uma
    carreirinha de pixels do fundo antigo — que sobre o preto da arte aparece como
    contorno claro. Encolher um fio e desfocar a borda tira as duas coisas: o
    contorno some e o encaixe na arte fica macio em vez de recortado a tesoura.
    """
    from PIL import ImageFilter
    from scipy import ndimage

    solido = np.array(alfa) > 128
    if encolher > 0:
        solido = ndimage.binary_erosion(solido, iterations=int(encolher))
    suave = Image.fromarray((solido * 255).astype("uint8"), "L")
    if esfumar > 0:
        suave = suave.filter(ImageFilter.GaussianBlur(float(esfumar)))
    return suave


def recuperar_com(recortada, mascara):
    """
    Traz de volta o pedaço que o recorte principal jogou fora, sem desmanchar o
    que o matting já acertou.

    O que entra aqui é a soma do que cada recortador achou, e ela é uma máscara
    dura — serve para dizer "isto também é gente", não para redesenhar a borda.
    Por isso o alfa final é o MAIOR entre os dois: onde o matting já tinha
    transição de cabelo, ela fica; onde ele tinha apagado um integrante inteiro,
    o pedaço volta com a borda esfumada.
    """
    im = Image.open(recortada).convert("RGBA")
    atual = np.array(im.split()[3])
    volta = Image.fromarray((mascara * 255).astype("uint8"), "L").resize(im.size)
    im.putalpha(Image.fromarray(np.maximum(atual, np.array(suavizar_borda(volta))), "L"))
    im.save(recortada)


def largura_do_tronco(pessoa):
    """
    A largura típica do tronco de quem está na foto.

    É a medida que diz o TAMANHO DA PESSOA, e não o tamanho do arquivo. Serve para
    o problema que estraga qualquer montagem: uma foto vem de corpo inteiro e a
    outra da cintura para cima. Igualando a altura dos dois arquivos, o da cintura
    vira um gigante ao lado do outro — cabeça o dobro do tamanho, e ninguém acredita
    que as duas pessoas estavam no mesmo lugar. Igualando o tronco, as duas pessoas
    ficam do mesmo tamanho, que é o que o olho confere.

    A conta é feita entre o pescoço e a cintura, onde a silhueta é mais estável;
    cabeça e pernas variam demais com pose e instrumento.
    """
    alfa = np.array(pessoa.split()[3]) > 40
    faixa = alfa[int(alfa.shape[0] * 0.15):max(int(alfa.shape[0] * 0.55), 2)]
    larguras = faixa.sum(axis=1)
    larguras = larguras[larguras > 0]
    return float(np.median(larguras)) if len(larguras) else float(pessoa.width)


def topo_da_cabeca(pessoa, fatia=0.22):
    """
    A linha onde a cabeça da pessoa começa, em pixels do recorte.

    NÃO é o alto do recorte. Quem segura a guitarra erguida, o microfone ou a
    baqueta tem o instrumento como ponto mais alto, e alinhar a banda por ele põe a
    cabeça dessa pessoa bem mais baixa que a dos outros — o grupo deixa de parecer
    um grupo. A conta desce de cima procurando a primeira linha em que a silhueta
    fica larga o bastante para ser cabeça, e não haste de microfone.
    """
    larguras = (np.array(pessoa.split()[3]) > 40).sum(axis=1)
    if not larguras.max():
        return 0
    cabeca = np.where(larguras >= larguras.max() * fatia)[0]
    return int(cabeca[0]) if len(cabeca) else 0


def igualar_a_luz(pessoa, alvo, limite=(0.6, 1.8)):
    """
    Põe todo mundo na mesma luz.

    Fotos tiradas em noites diferentes chegam com luzes diferentes: uma no claro do
    palco, outra num canto escuro. Lado a lado, quem veio do escuro parece uma
    sombra entre duas pessoas, e a montagem não convence. Aqui o brilho de cada um
    é puxado para o mesmo ponto, por multiplicação — que mantém o contraste da foto
    em vez de achatá-la como somar um valor faria.

    O ganho é limitado de propósito: foto muito escura, forçada até o alvo, vira
    uma mancha cinza sem preto nenhum. Melhor ficar um pouco mais escura que os
    outros do que virar neblina.
    """
    alfa = np.array(pessoa.split()[3])
    dentro = alfa > 128
    if dentro.sum() < 100:
        return pessoa
    rgb = np.array(pessoa.convert("RGB"), float)
    atual = float(np.median(rgb[dentro]))
    if atual <= 1:
        return pessoa
    ganho = min(max(alvo / atual, limite[0]), limite[1])
    ajustada = Image.fromarray(np.clip(rgb * ganho, 0, 255).astype("uint8"), "RGB")
    ajustada.putalpha(pessoa.split()[3])
    return ajustada


def juntar_integrantes(recortadas, destino, encosto=0.03):
    """
    Monta uma foto de banda a partir de fotos separadas de cada integrante.

    Cada pessoa já vem recortada. O trabalho aqui não é enfileirar: é fazer as fotos
    conversarem, para o resultado parecer uma banda e não três retratos colados lado
    a lado. Três coisas fazem essa diferença, e são as três que esta função resolve:

      1. TAMANHO — todos ficam com o tronco da mesma largura, não com o arquivo da
         mesma altura (ver largura_do_tronco). É o que impede alguém de virar
         gigante só porque mandou uma foto de perto.
      2. LUZ — todos vão para o mesmo brilho (ver igualar_a_luz), senão quem veio de
         uma foto escura parece uma sombra no meio dos outros.
      3. LINHA DOS OLHOS — o alinhamento é pela cabeça, não pelos pés. Em foto de
         banda as cabeças ficam mais ou menos na mesma altura, porque as pessoas têm
         mais ou menos a mesma altura; o que varia é onde a foto foi cortada. Alinhar
         pelos pés faria o enquadramento de cada foto virar altura de pessoa.

    E eles se encostam de leve, em vez de ficarem com um vão entre cada um: grupo
    reunido ocupa um bloco só, e espaço vazio entre as pessoas denuncia a colagem.

    Nada é inventado: ninguém é redesenhado, só redimensionado, clareado e posto no
    lugar.
    """
    pessoas = []
    for caminho in recortadas:
        im = Image.open(caminho).convert("RGBA")
        caixa = composicao.caixa_do_sujeito(im)
        if caixa:
            pessoas.append(im.crop(caixa))
    if len(pessoas) < 2:
        raise RuntimeError("preciso de pelo menos duas fotos para montar a banda")

    # 1. Mesmo tamanho de gente. O tronco de referência é a mediana do grupo, para
    # a montagem não ser arrastada por uma foto fora do padrão.
    troncos = [largura_do_tronco(p) for p in pessoas]
    alvo_tronco = float(np.median(troncos))
    ajustadas = []
    for p, tronco in zip(pessoas, troncos):
        escala = alvo_tronco / max(tronco, 1)
        escala = min(max(escala, 0.25), 4.0)
        ajustadas.append(p.resize((max(1, round(p.width * escala)),
                                   max(1, round(p.height * escala))), Image.LANCZOS))

    # Com todo mundo do mesmo tamanho, a montagem cresce conforme o número de
    # pessoas. Limitar a altura aqui evita um arquivo gigante sem ganho nenhum: a
    # arte não passa de 1050 pixels de altura no maior dos espaços.
    mais_alta = max(p.height for p in ajustadas)
    if mais_alta > 1800:
        reduzir = 1800 / mais_alta
        ajustadas = [p.resize((max(1, round(p.width * reduzir)),
                               max(1, round(p.height * reduzir))), Image.LANCZOS)
                     for p in ajustadas]
        mais_alta = max(p.height for p in ajustadas)

    # 2. Mesma luz para todos.
    alvos = []
    for p in ajustadas:
        alfa = np.array(p.split()[3]) > 128
        if alfa.sum() > 100:
            alvos.append(float(np.median(np.array(p.convert("RGB"), float)[alfa])))
    if alvos:
        alvo_luz = float(np.median(alvos))
        ajustadas = [igualar_a_luz(p, alvo_luz) for p in ajustadas]

    # 3. Cabeças na mesma linha, com os ombros se encostando. O alinhamento é pela
    # cabeça de cada um (ver topo_da_cabeca), não pelo alto do arquivo: quem ergue a
    # guitarra tem o instrumento no alto, e alinhar por ele afunda a cabeça da
    # pessoa em relação às outras.
    cabecas = [topo_da_cabeca(p) for p in ajustadas]
    mais_fundo = max(cabecas)
    deslocamentos = [mais_fundo - c for c in cabecas]
    altura_total = max(p.height + d for p, d in zip(ajustadas, deslocamentos))

    encaixe = int(alvo_tronco * encosto)
    largura = sum(p.width for p in ajustadas) - encaixe * (len(ajustadas) - 1)
    tela = Image.new("RGBA", (max(largura, 1), altura_total), (0, 0, 0, 0))
    x = 0
    for p, desloca in zip(ajustadas, deslocamentos):
        tela.alpha_composite(p, (x, desloca))
        x += p.width - encaixe
    tela.save(destino)
    return destino, len(ajustadas)


def conferir_tem_conteudo(imagem):
    """Imagem quase toda transparente vira arte em branco — melhor recusar aqui."""
    visivel = (np.array(imagem.split()[3]) > 128).mean()
    if visivel < 0.02:
        raise RuntimeError("a imagem está praticamente vazia (só %.1f%% dela aparece)"
                           % (visivel * 100))


# Limites da decisão "precisa recortar?". Calibrados sobre as fotos que já passaram
# pelo sistema: fundo de estúdio e parede lisa ficaram em 0,5 a 2,1 de rugosidade e
# até 61 de diferença de tom entre os cantos; palco com gente atrás e amplificador
# ficaram em 1,1 a 2,8 e 67 a 115. A margem é estreita, e é por isso que errar aqui
# não pode custar caro — ver a rede de segurança em preparar().
RUGOSIDADE_DE_FUNDO_SUJO = 2.5
DIFERENCA_DE_TOM_SUJA = 65.0


def fundo_neutro(caminho, lado=700, parte=0.18):
    """
    Diz se o fundo da foto é neutro — estúdio, parede lisa, degradê.

    Foto de banda com fundo neutro NÃO precisa ser recortada: basta entrar no
    tamanho certo do espaço, tratada em preto e branco, com as bordas dissolvidas no
    fundo da arte. Recortar nesse caso é trabalho que só pode piorar: gasta minutos,
    arrisca comer um pedaço da pessoa e troca um fundo que já combinava por uma
    silhueta com cara de recorte. Recorte existe para quando é preciso SEPARAR a
    pessoa — para juntá-la com outras numa banda, ou para tirá-la de um fundo que
    atrapalha.

    A conta é feita nos cantos, que é onde o fundo costuma aparecer sozinho, e usa
    dois sinais porque nenhum dos dois sozinho separa:
      - rugosidade: o quanto a imagem muda de um pixel para o vizinho. Parede e
        degradê quase não mudam de perto, mesmo variando muito de um lado ao outro;
        plateia, instrumento e luz de palco mudam muito.
      - diferença de tom entre os cantos: num fundo neutro os quatro cantos são
        parecidos; num palco, um canto tem refletor e o outro é breu.

    Os dois cantos mais calmos é que mandam na rugosidade: assim, uma pessoa que
    invada um canto da foto não faz o fundo inteiro parecer bagunçado.
    """
    from scipy import ndimage

    im = Image.open(caminho).convert("L")
    im.thumbnail((lado, lado), Image.LANCZOS)
    cinza = np.array(im, float)
    alto, largo = cinza.shape
    ch, cl = max(int(alto * parte), 2), max(int(largo * parte), 2)

    media = ndimage.uniform_filter(cinza, 9)
    media2 = ndimage.uniform_filter(cinza * cinza, 9)
    local = np.sqrt(np.clip(media2 - media * media, 0, None))

    cantos = [(slice(0, ch), slice(0, cl)),
              (slice(0, ch), slice(largo - cl, largo)),
              (slice(alto - ch, alto), slice(0, cl)),
              (slice(alto - ch, alto), slice(largo - cl, largo))]
    rugosidades = sorted(float(np.median(local[a, b])) for a, b in cantos)
    tons = [float(np.median(cinza[a, b])) for a, b in cantos]

    rugosidade = float(np.mean(rugosidades[:2]))
    diferenca = max(tons) - min(tons)
    neutro = (rugosidade <= RUGOSIDADE_DE_FUNDO_SUJO
              and diferenca <= DIFERENCA_DE_TOM_SUJA)
    return neutro, {"rugosidade": round(rugosidade, 2), "tom": round(diferenca, 1)}


def em_resolucao_de_trabalho(caminho, lado=None):
    """Reduz a foto ao tamanho em que o recorte é calculado. Ver LADO_TRABALHO."""
    import io as _io

    lado = lado or LADO_TRABALHO
    im = Image.open(caminho).convert("RGB")
    if max(im.size) > lado:
        im.thumbnail((lado, lado), Image.LANCZOS)
    dados = _io.BytesIO()
    im.save(dados, "PNG")
    return im, dados.getvalue()


def recortar_fundo(entrada, saida, obrigatorio=False):
    """
    Recorta o fundo e diz o quanto dá para confiar no resultado.

    Devolve (caminho, aviso, concordância). O aviso é None quando o recorte é
    confiável; a concordância é a medida crua, de 0 a 1, para quem precisa decidir
    por ela — a montagem de integrantes decide. Ela vem como número, e não como
    palavra dentro do aviso, porque quem lê o aviso para decidir fica refém da
    redação dele: mudar uma frase mudaria o comportamento do sistema sem que
    ninguém percebesse.

    O modelo bom (birefnet) é lento mas é o único que não engole um integrante da
    banda: medido numa foto de 4 pessoas, o modelo rápido apagou um deles inteiro.
    O modelo rápido ainda é rodado em seguida, só para comparar: quando os dois
    discordam muito, é sinal de que a foto é ambígua e o recorte provavelmente
    comeu alguma coisa. Medido: fotos que recortam bem dão 96–97% de concordância;
    a foto problemática deu 56%.

    O recorte é tirado com matting, não com máscara dura. A diferença aparece no
    cabelo e nas cordas do instrumento: a máscara dura decide pixel a pixel se é
    pessoa ou fundo, então fio de cabelo e corda de guitarra — que são mais finos
    que um pixel e deixam o fundo aparecer através — ou somem ou vêm com um naco
    do fundo colado em volta. Sobre o preto da arte, esse naco aparece como
    contorno claro: foi o "contorno cinza" que apareceu nas primeiras artes.
    O matting mede o quanto de cada pixel é pessoa, em vez de decidir sim ou não,
    e a `decontaminate` ainda tira a cor do fundo antigo que ficou misturada na
    borda. Medido na foto mais difícil (pessoa diluída na luz azul): a máscara
    dura entregou 0 pixel de transição; o matting entregou 37 mil — são os fios de
    cabelo e as cordas que antes eram jogados fora.
    """
    from rembg import remove

    # O recortador pede um bloco de memória proporcional ao tamanho da foto — numa
    # foto grande, perto de 800 MB de uma vez só. Quando a máquina está apertada,
    # ele falha, e falhar aqui tem consequência séria: numa montagem de banda, o
    # integrante daquela foto some do grupo. Então, antes de desistir, tenta de novo
    # menor. Foto menor recorta pior nos fios de cabelo, e é muito melhor que um
    # integrante faltando.
    cortado = None
    ultimo_erro = None
    for lado in (LADO_TRABALHO, int(LADO_TRABALHO * 0.7), int(LADO_TRABALHO * 0.5)):
        try:
            _, bruto = em_resolucao_de_trabalho(entrada, lado)
            cortado = remove(bruto, session=sessao(MODELO_BOM), post_process_mask=True,
                             vitmatte=True, decontaminate=True)
            break
        except Exception as erro:
            ultimo_erro = erro
    if cortado is None:
        raise RuntimeError("o recortador não conseguiu processar esta foto nem "
                           "reduzindo o tamanho: %s" % ultimo_erro)
    with open(saida, "wb") as f:
        f.write(cortado)
    if not tem_transparencia_real(saida):
        raise RuntimeError("o recorte saiu sem transparência — foto provavelmente ruim")

    principal = _mascara(saida)
    if principal.sum() < principal.size * 0.04:
        raise RuntimeError("sobrou quase nada da foto depois do recorte (%.1f%% da imagem)"
                           % (principal.sum() / principal.size * 100))

    aviso = None
    concordancia = 1.0
    try:
        outra = conferidor(MODELO_CONFERENCIA, lambda ses: _mascara_de_bytes(
            remove(bruto, session=ses, post_process_mask=True)))
        uniao = (principal | outra).sum()
        concordancia = (principal & outra).sum() / uniao if uniao else 1.0

        if concordancia < CONCORDANCIA_RESGATE:
            # Discordância grande demais: os recortadores não estão achando a mesma
            # coisa, e juntar o que cada um achou cola fundo na arte — foi o que
            # deixou um bloco cinza em volta do guitarrista do Toca Rock. Fica só o
            # melhor modelo, e o aviso sobe.
            aviso = ("os recortadores discordaram muito nesta foto (%.0f%% da área). "
                     "Usei só o melhor deles. Confira a arte: se faltar alguém ou algum "
                     "pedaço, envie a foto já recortada em PNG com fundo transparente."
                     % ((1 - concordancia) * 100))
        elif concordancia < CONCORDANCIA_MINIMA:
            # Os recortadores erram de formas opostas: um perde um integrante, o outro
            # perde a mesa ou o instrumento. Juntando o que cada um achou, recupera-se
            # boa parte do que seria jogado fora. Medido na foto problemática: sozinho o
            # melhor modelo perdia 27% da imagem; juntando os três, perde 17%.
            terceira = conferidor(MODELO_RESGATE, lambda ses: _mascara_de_bytes(
                remove(bruto, session=ses, post_process_mask=True)))
            recuperar_com(saida, principal | outra | terceira)
            aviso = ("o recorte de fundo desta foto é duvidoso (os recortadores "
                     "discordaram em %.0f%% da área, e juntei o que cada um achou). "
                     "Confira a arte antes de aprovar; se estiver faltando alguém ou algum "
                     "pedaço, envie a foto já recortada em PNG com fundo transparente."
                     % ((1 - concordancia) * 100))
    except Exception as e:
        aviso = "não consegui conferir a qualidade do recorte: %s" % e

    return saida, aviso, concordancia


def corpo_inteiro(caminho):
    """Foto bem mais alta que larga quase sempre é de corpo inteiro."""
    forma = proporcao(caminho)
    return bool(forma) and forma < 1 / 1.55


def proporcao(caminho):
    """
    Largura dividida por altura de quem aparece. Acima de 1 a pessoa está deitada
    na foto; abaixo de 1, em pé. É esta conta que decide qual foto vai para qual
    peça, e ela mede a pessoa, não o arquivo: depois do recorte, uma foto deitada
    de alguém em pé tem um sujeito em pé, e é o sujeito que precisa caber no vão.
    """
    caixa = composicao.caixa_do_sujeito(Image.open(caminho))
    if not caixa:
        return 0
    return (caixa[2] - caixa[0]) / max(caixa[3] - caixa[1], 1)


def conferir_logo(origem, recortada, avisos):
    """
    Trava de qualidade da logo. Reprova recorte que comeu parte do desenho.

    O sintoma é vazado no meio da silhueta: foi assim que as letras brancas do
    Toca Rock sumiram, porque o fundo também era quase branco. Medido: o recorte
    certo deixa 0% de buraco; o que apagou as letras deixou 39%.
    """
    m = medir_recorte(recortada)
    if m["visivel"] < 0.02:
        raise RuntimeError("o recorte apagou a logo inteira")
    if m["buracos"] > 0.15:
        raise RuntimeError(
            "o recorte da logo deixou %.0f%% do desenho vazado — provavelmente apagou "
            "parte dela junto com o fundo. Envie a logo em PNG com fundo transparente."
            % (m["buracos"] * 100))
    if m["buracos"] > 0.05:
        avisos.append("a logo ficou com %.0f%% de vazado no meio; confira a arte"
                      % (m["buracos"] * 100))


def altura_da_logo(caminho):
    """
    Escolhe a altura com que a logo entra em cada peça.

    É a regra que o kit manda seguir à mão: logo alta ou quadrada ocupa cerca de 300
    no feed e 360 no story; logo deitada, em faixa, pede bem menos para não atravessar
    a arte. Sem isso a logo sai minúscula e encosta nos textos.
    """
    im = Image.open(caminho).convert("RGBA")
    cx = im.getbbox() or (0, 0, im.width, im.height)
    largura, altura = max(cx[2] - cx[0], 1), max(cx[3] - cx[1], 1)
    proporcao = altura / largura
    if proporcao >= 0.95:        # quadrada ou em pé
        feed, story, extra = 300, 360, 30
    elif proporcao >= 0.45:      # levemente deitada
        feed, story, extra = 240, 290, 20
    else:                        # faixa comprida
        feed, story, extra = 170, 210, 10
    return {
        "A_feed": feed, "A_story": story,
        "B_feed": feed + extra, "B_story": story + extra + 10,
        "C_feed": feed, "C_story": story,
    }


def medir_recorte(caminho):
    """
    Mede um recorte: quanto sobrou e quanto virou buraco dentro do desenho.

    "Buraco" é o sinal que denuncia recorte que comeu conteúdo: quando o fundo e
    parte do desenho têm a mesma cor, o que some vira vazado no meio da silhueta.
    Pela cor isso é invisível — branco sobre branco é branco. Pela forma, não.
    """
    from scipy import ndimage

    visivel = np.array(Image.open(caminho).convert("RGBA").split()[3]) > 128
    if not visivel.any():
        return {"visivel": 0.0, "buracos": 1.0}
    cheio = ndimage.binary_fill_holes(visivel)
    return {
        "visivel": float(visivel.mean()),
        "buracos": float((cheio.sum() - visivel.sum()) / max(cheio.sum(), 1)),
    }


def recortar_logo(origem, destino, tratar_logo_py):
    """
    Tira o fundo da logo escolhendo o modo por medição, não por palpite.

    Testa os três modos do kit e fica com o melhor. "Bordas" vem primeiro porque
    remove só o fundo que encosta na margem: ele é o único que preserva branco
    DENTRO do desenho. Olhar a cor dos cantos e decidir "fundo branco" apagava as
    letras brancas junto com o fundo — foi o que aconteceu com a logo do Toca Rock,
    que ficou só com o símbolo vermelho e as letras vazadas.
    """
    im = Image.open(origem).convert("RGB")
    w, h = im.size
    cantos = [im.getpixel(p) for p in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1))]
    claro = sum(sum(c) / 3 for c in cantos) / 4 > 128

    ordem = ["bordas", "branco" if claro else "preto", "preto" if claro else "branco"]
    tentativas = []
    for modo in ordem:
        saida = destino + "." + modo + ".png"
        try:
            executar([sys.executable, tratar_logo_py, origem, saida, "--fundo", modo])
            tentativas.append((modo, saida, medir_recorte(saida)))
        except Exception:
            continue
    if not tentativas:
        raise RuntimeError("não consegui tirar o fundo da logo")

    # Sobrou quase tudo = não removeu o fundo. Sobrou quase nada = comeu o desenho.
    bons = [t for t in tentativas if 0.05 <= t[2]["visivel"] <= 0.90]
    candidatos = bons or tentativas
    # Entre os plausíveis, o que deixou menos buraco no meio do desenho.
    escolhido = min(candidatos, key=lambda t: (round(t[2]["buracos"], 2), -t[2]["visivel"]))

    Image.open(escolhido[1]).save(destino)
    for _m, caminho, _v in tentativas:
        if os.path.exists(caminho):
            os.remove(caminho)
    medidas = {m: {"visivel": round(v["visivel"], 3), "buracos": round(v["buracos"], 3)}
               for m, _c, v in tentativas}
    return escolhido[0], medidas


def preparar(pasta_entrada, pasta_gerador, ident, juntar=False):
    bands = os.path.join(pasta_gerador, "bands")
    os.makedirs(bands, exist_ok=True)
    trabalho = os.path.join(pasta_entrada, "_trabalho")
    os.makedirs(trabalho, exist_ok=True)

    fotos = sorted(
        os.path.join(pasta_entrada, n)
        for n in os.listdir(pasta_entrada)
        if n.lower().startswith("foto")
    )
    logos = sorted(
        os.path.join(pasta_entrada, n)
        for n in os.listdir(pasta_entrada)
        if n.lower().startswith("logo")
    )
    if not fotos:
        raise RuntimeError("nenhuma foto chegou nesta programação")

    avisos = []
    houve_montagem = False
    duvidosas = []
    recortadas = []
    inteiras = set()     # as que entram sem recorte, dissolvidas no fundo
    for i, foto in enumerate(fotos):
        destino = os.path.join(trabalho, "cortada%d.png" % (i + 1))
        try:
            if tem_transparencia_real(foto):
                pronta = Image.open(foto).convert("RGBA")
                conferir_tem_conteudo(pronta)
                pronta.save(destino)
                avisos.append("foto%d já veio recortada; usada direto" % (i + 1))
            elif not juntar and fundo_neutro(foto)[0]:
                # Fundo neutro e a pessoa aparece sozinha nesta peça: não há o que
                # separar. A foto entra inteira, no tamanho do espaço, tratada em
                # P&B e com as bordas dissolvidas no fundo da arte. Recortar aqui
                # só poderia piorar — gasta minutos, arrisca comer um pedaço da
                # pessoa e troca um fundo que já combinava por uma silhueta com
                # cara de recorte.
                inteira = Image.open(foto).convert("RGBA")
                conferir_tem_conteudo(inteira)
                inteira.save(destino)
                inteiras.add(destino)
                medida = fundo_neutro(foto)[1]
                avisos.append("foto%d tem fundo neutro (%s); usei inteira, sem "
                              "recortar" % (i + 1, medida))
            else:
                # Ou vai entrar numa montagem — e aí separar é obrigatório, senão
                # as pessoas não encaixam lado a lado — ou o fundo atrapalha.
                _, aviso, concordancia = recortar_fundo(foto, destino,
                                                        obrigatorio=juntar)
                if aviso:
                    avisos.append("foto%d: %s" % (i + 1, aviso))
                if juntar:
                    if concordancia < CONCORDANCIA_MONTAGEM:
                        duvidosas.append(i + 1)
                elif concordancia < CONCORDANCIA_RESGATE:
                    # Rede de segurança: fora da montagem, recorte duvidoso não vai
                    # para a arte. A foto inteira, com o fundo dissolvido, é sempre
                    # melhor do que uma silhueta que comeu um pedaço da pessoa — e
                    # é o que protege a arte quando a leitura do fundo erra.
                    Image.open(foto).convert("RGBA").save(destino)
                    inteiras.add(destino)
                    avisos.append("foto%d: o recorte não ficou confiável, então usei "
                                  "a foto inteira com as bordas dissolvidas no fundo "
                                  "da arte" % (i + 1))
            recortadas.append(destino)
        except Exception as e:
            # Recorte falhou. Se a foto tem conteúdo, ela não é descartada: entra
            # inteira, mas dissolvida nas bordas, porque fotografia retangular
            # colada dentro da arte é o único resultado que o padrão do kit não
            # admite de jeito nenhum. Descartar seria pior: a arte sairia sem banda.
            # Mas foto sem conteúdo nenhum é descartada mesmo — aproveitá-la só
            # produziria uma arte vazia, que é o que estas travas existem para
            # impedir que chegue ao Instagram.
            try:
                inteira = Image.open(foto).convert("RGBA")
                conferir_tem_conteudo(inteira)
                inteira.save(destino)
                recortadas.append(destino)
                inteiras.add(destino)
                avisos.append("foto%d não pôde ser recortada (%s); entrou inteira, com "
                              "as bordas dissolvidas no fundo da arte" % (i + 1, e))
            except Exception as vazia:
                avisos.append("foto%d descartada: %s" % (i + 1, vazia))

    if not recortadas:
        raise RuntimeError("nenhuma das fotos pôde ser usada; " + " | ".join(avisos))

    if juntar:
        # Numa montagem, o recorte de cada um fica exposto lado a lado com o dos
        # outros: quem saiu mal não se esconde, aparece como a pessoa estranha do
        # meio. Por isso a montagem recusa antes de o recorte ficar ruim de verdade
        # — ver CONCORDANCIA_MONTAGEM, que foi recalibrada olhando a arte montada.
        if duvidosas:
            raise RuntimeError(
                "não dá para juntar os integrantes: na foto %s não dá para saber onde "
                "a pessoa termina e o fundo começa, e ela sairia muito diferente das "
                "outras na foto montada. Mande essa foto já recortada em PNG com fundo "
                "transparente, ou troque por uma com o fundo mais separado da pessoa."
                % ", ".join("nº %d" % n for n in duvidosas))
        # Só entra na montagem quem foi recortado: uma foto retangular colada ao
        # lado de pessoas recortadas vira um bloco de fundo no meio da banda.
        para_juntar = [c for c in recortadas if c not in inteiras]
        if len(para_juntar) < len(recortadas):
            # Integrante que não pôde ser recortado não pode simplesmente sair da
            # foto: a arte iria para o Instagram com a banda incompleta, e ninguém
            # perceberia — nem a banda, até ver a publicação. Melhor não publicar.
            raise RuntimeError(
                "%d das %d fotos de integrantes não puderam ser recortadas, e sem "
                "recorte elas não entram na foto da banda. Publicar assim deixaria "
                "integrante de fora, então não fiz nada. Reenvie essas fotos já "
                "recortadas em PNG com fundo transparente, ou com o fundo mais "
                "separado da pessoa."
                % (len(recortadas) - len(para_juntar), len(recortadas)))
        if len(para_juntar) < 2:
            avisos.append("veio só uma foto recortada; não havia o que juntar")
        else:
            montada = os.path.join(trabalho, "banda_montada.png")
            try:
                _, quantos = juntar_integrantes(para_juntar, montada)
                houve_montagem = True
                avisos.append("montei %d integrantes lado a lado numa foto só da banda"
                              % quantos)
                recortadas = [montada] + recortadas
            except Exception as e:
                avisos.append("não consegui montar a banda (%s); usei as fotos separadas" % e)

    # Cada peça tem um espaço com formato diferente, e é o próprio kit que mostra
    # qual foto vai em qual: no exemplo dele, a foto DEITADA do trio vai nas opções A
    # e C, e a foto EM PÉ vai na opção B — que tem uma área alta e estreita ao lado da
    # coluna vermelha. A proporção medida aqui é a de quem aparece na foto, não a do
    # arquivo: depois do recorte, uma foto deitada de uma pessoa em pé tem um sujeito
    # em pé, e é ele que precisa caber.
    recortadas.sort(key=proporcao, reverse=True)
    mais_deitada = recortadas[0]    # peças A e C: vão largo e baixo
    mais_em_pe = recortadas[-1]     # peça B: vão alto e estreito

    saida = {}
    tratar = os.path.join(pasta_gerador, "tratar_foto.py")

    def entregar(peca, origem, chave, crop=None):
        """Trata em P&B e entrega a foto já na forma do espaço desta peça."""
        bw = os.path.join(trabalho, "%s_%s_bw.png" % (ident, peca))
        argumentos = [sys.executable, tratar, origem, bw]
        if crop:
            argumentos += ["--crop", str(crop)]
        executar(argumentos)

        destino = os.path.join(bands, "%s_%s.png" % (ident, peca))
        if origem in inteiras:
            composicao.integrar_retangulo(bw, destino, peca)
        else:
            ocupacao = composicao.encaixar(bw, destino, peca)
            if ocupacao < composicao.ALTURA_POBRE:
                avisos.append(
                    "na peça %s a banda ocupou só %.0f%% da altura do espaço: a foto é "
                    "muito mais deitada que o vão, e sobrou fundo vazio. Uma foto em pé "
                    "(ou uma foto a mais, em pé) resolve." % (peca, ocupacao * 100))
        saida[chave] = "bands/" + os.path.basename(destino)

    entregar("A", mais_deitada, "photo")
    entregar("B", mais_em_pe, "photoB")
    # A polaroide é um retrato: de corpo inteiro ela mostraria a pessoa de longe,
    # com o rosto do tamanho de uma unha. Cortar na cintura é o que o kit faz.
    entregar("C", mais_deitada, "photoC",
             crop=0.66 if corpo_inteiro(mais_deitada) else None)

    if logos:
        logo = logos[0]
        destino_logo = os.path.join(bands, ident + "_logo.png")
        try:
            if tem_transparencia_real(logo):
                Image.open(logo).convert("RGBA").save(destino_logo)
            else:
                modo, medidas = recortar_logo(
                    logo, destino_logo, os.path.join(pasta_gerador, "tratar_logo.py"))
                avisos.append("logo recortada no modo '%s' (medidas: %s)" % (modo, medidas))
            conferir_logo(logo, destino_logo, avisos)
            saida["bandLogo"] = "bands/" + os.path.basename(destino_logo)
            saida["logoH"] = altura_da_logo(destino_logo)
        except Exception as e:
            avisos.append("logo descartada (o nome entra escrito na arte): %s" % e)

    saida["_avisos"] = avisos
    return saida


if __name__ == "__main__":
    entrada, gerador, ident = sys.argv[1], sys.argv[2], sys.argv[3]
    resultado = preparar(entrada, gerador, ident, juntar="--juntar" in sys.argv)
    destino = None
    if "--json" in sys.argv:
        destino = sys.argv[sys.argv.index("--json") + 1]
    texto = json.dumps(resultado, ensure_ascii=False)
    if destino:
        with open(destino, "w", encoding="utf-8") as f:
            f.write(texto)
    print(texto)
