"""
Testes da preparação das imagens.

O gabarito é o próprio exemplo do kit: nele, a foto DEITADA do trio vai para as
opções A e C, e a foto EM PÉ vai para a opção B. Inverter isso deixa metade da
peça B vazia — já aconteceu, e é o que este teste impede de voltar.

Desde a revisão da composição, cada peça recebe um arquivo com a forma exata do
espaço dela, e a banda colada no topo. Os testes daqui medem as duas coisas que
isso garante e que antes falhavam: a foto nunca é encolhida pelo navegador, e a
banda nunca desce para debaixo do logotipo.

uso: python tests/testar_imagens.py
"""
import os
import shutil
import sys
import tempfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(RAIZ, "worker"))

import numpy as np  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

import composicao  # noqa: E402
import preparar_imagens as pi  # noqa: E402

passou = falhou = 0


def conferir(ok, oque):
    global passou, falhou
    if ok:
        passou += 1
        print("   ok   " + oque)
    else:
        falhou += 1
        print("   FALHA " + oque)


def pasta_com(*copias):
    destino = tempfile.mkdtemp()
    for origem, nome in copias:
        shutil.copy(os.path.join(RAIZ, "gerador", "bands", origem),
                    os.path.join(destino, nome))
    return destino


def preparar(entrada, ident, juntar=False):
    gerador = tempfile.mkdtemp()
    os.makedirs(os.path.join(gerador, "bands"))
    for n in ("tratar_foto.py", "tratar_logo.py"):
        shutil.copy(os.path.join(RAIZ, "gerador", n), os.path.join(gerador, n))
    return pi.preparar(entrada, gerador, ident, juntar=juntar), gerador


def banda_em(gerador, rel):
    """Onde a banda está dentro do espaço entregue, e qual a forma dela."""
    im = Image.open(os.path.join(gerador, rel)).convert("RGBA")
    visivel = np.array(im.split()[3]) > 40
    linhas = np.where(visivel.any(axis=1))[0]
    colunas = np.where(visivel.any(axis=0))[0]
    if not len(linhas):
        return {"espaco": im.size, "ocupa": 0.0, "topo": 1.0, "forma": 0.0}
    alta = linhas.max() - linhas.min() + 1
    larga = colunas.max() - colunas.min() + 1
    return {"espaco": im.size, "ocupa": alta / im.height,
            "topo": linhas.min() / im.height, "forma": larga / alta}


print("\nTESTES DA PREPARAÇÃO DAS IMAGENS")

print("\n• Toda peça recebe a foto na forma exata do espaço dela")
# É isto que impede o navegador de encolher a foto. Com `object-fit: contain` e a
# altura travada, foto mais deitada que o vão é reduzida até a largura caber — e,
# como o encaixe é pelo rodapé, a banda desce para debaixo do logotipo. Entregando
# a foto já na proporção do vão, não há o que encolher.
r, g = preparar(pasta_com(("kundera_trio_bw.png", "foto1.png"),
                          ("kundera_solo_bw.png", "foto2.png")), "teste1")
for peca, chave in (("A", "photo"), ("B", "photoB"), ("C", "photoC")):
    conferir(chave in r, "a peça %s recebeu a foto dela" % peca)
    if chave in r:
        conferir(banda_em(g, r[chave])["espaco"] == composicao.ESPACOS[peca],
                 "e o arquivo da peça %s tem o tamanho do espaço %s"
                 % (peca, composicao.ESPACOS[peca]))

print("\n• A banda começa no alto do espaço, nunca no rodapé")
# A polaroide fica de fora desta conta: lá a imagem entra INTEIRA e centralizada,
# justamente para não cortar ninguém, então ela não começa colada no alto.
for peca, chave in (("A", "photo"), ("B", "photoB")):
    topo = banda_em(g, r[chave])["topo"]
    conferir(topo <= composicao.FOLGA_TOPO[peca] + 0.02,
             "na peça %s a banda começa a %.0f%% da altura, dentro do respiro de %.0f%%"
             % (peca, topo * 100, composicao.FOLGA_TOPO[peca] * 100))

print("\n• Num vão alto a banda entra em duas fileiras, para não boiar")
# Três pessoas lado a lado formam uma figura larga e baixa. No vão alto e estreito
# da peça B, para caber na largura ela encolhe na altura e vira uma tirinha boiando
# num vazio — foi a reclamação de "recortes flutuando no meio do layout". Em duas
# fileiras a banda fica mais alta que larga e passa a ocupar o espaço.
tres = [os.path.join(RAIZ, "gerador", "bands", n)
        for n in ("kundera_solo_bw.png", "pelada_bw.png", "kundera_trio_bw.png")]
ocupacoes = {}
for nome, fileiras in (("fila", 1), ("duas fileiras", 2)):
    alvo = os.path.join(tempfile.mkdtemp(), "m.png")
    pi.juntar_integrantes(tres, alvo, fileiras=fileiras)
    posta = os.path.join(tempfile.mkdtemp(), "b.png")
    ocupacoes[nome] = composicao.encaixar(alvo, posta, "B")
conferir(ocupacoes["duas fileiras"] > ocupacoes["fila"] * 1.2,
         "em duas fileiras a banda ocupa bem mais da peça alta (%.0f%% contra %.0f%%)"
         % (ocupacoes["duas fileiras"] * 100, ocupacoes["fila"] * 100))

# E a fileira da frente tem de ficar POR CIMA, senão as pessoas se cortam.
alvo = os.path.join(tempfile.mkdtemp(), "duas.png")
pi.juntar_integrantes(tres, alvo, fileiras=2)
duas = Image.open(alvo).convert("RGBA")
conferir(duas.height > duas.width * 0.8,
         "a montagem em duas fileiras é alta (%dx%d)" % duas.size)

print("\n• Integrantes montados numa banda: a banda vai em TODAS as peças")
# O defeito: a montagem é larga, então ia para as peças A e C, e a peça B ficava
# com a foto de um integrante sozinho — um show de banda anunciado com o retrato
# de uma pessoa só.
juntos = pasta_com(("kundera_solo_bw.png", "foto1.png"), ("pelada_bw.png", "foto2.png"))
rj, gj = preparar(juntos, "montagem", juntar=True)
pessoas_por_peca = {}
for peca, chave in (("A", "photo"), ("B", "photoB"), ("C", "photoC")):
    im = Image.open(os.path.join(gj, rj[chave])).convert("RGBA")
    colunas = (np.array(im.split()[3]) > 40).any(axis=0)
    # Conta blocos de colunas ocupadas: duas pessoas lado a lado dão dois blocos,
    # ou um só quando se encostam — o que não pode é a peça ter metade do conteúdo.
    pessoas_por_peca[peca] = int(colunas.sum())
conferir(any("montei" in a for a in rj["_avisos"]), "a montagem aconteceu")
larguras = list(pessoas_por_peca.values())
conferir(max(larguras) and min(larguras) / max(larguras) > 0.55,
         "as três peças mostram a mesma banda (colunas ocupadas: %s)" % pessoas_por_peca)

print("\n• Cada peça recebe a foto com o formato certo")
# O gabarito do kit: a foto deitada vai para A e C, a em pé para B.
forma_a = banda_em(g, r["photo"])["forma"]
forma_b = banda_em(g, r["photoB"])["forma"]
conferir(forma_a > 1, "a foto da peça A é deitada (proporção %.2f)" % forma_a)
conferir(forma_b < 1, "a foto da peça B é em pé (proporção %.2f)" % forma_b)
conferir(forma_a > forma_b, "e a de A é mais deitada que a da B")

print("\n• Com uma foto só, todas as peças são servidas mesmo assim")
r3, g3 = preparar(pasta_com(("pelada_bw.png", "foto1.png")), "teste3")
conferir(all(k in r3 for k in ("photo", "photoB", "photoC")),
         "as três peças receberam arquivo")
conferir(any("já veio recortada" in a for a in r3["_avisos"]),
         "o sistema avisou que usou a foto transparente direto")

print("\n• Foto muito deitada num vão alto sobe, em vez de descer")
# O caso que estragava a peça B: uma foto de grupo bem deitada não tem como
# preencher um vão alto e estreito. O que não pode é ela acabar no rodapé.
deitada = Image.new("RGBA", (1600, 400), (0, 0, 0, 0))
ImageDraw.Draw(deitada).rectangle((0, 0, 1599, 399), fill=(200, 200, 200, 255))
larga = os.path.join(tempfile.mkdtemp(), "larga.png")
deitada.save(larga)
encaixada = os.path.join(tempfile.mkdtemp(), "b.png")
ocupa = composicao.encaixar(larga, encaixada, "B")
alfa = np.array(Image.open(encaixada).convert("RGBA").split()[3])
conferir(Image.open(encaixada).size == composicao.ESPACOS["B"],
         "o arquivo saiu no tamanho do espaço da peça B")
conferir(ocupa < composicao.ALTURA_POBRE,
         "o sistema mediu que a banda ficou pequena (%.0f%% da altura)" % (ocupa * 100))
conferir((alfa[:int(alfa.shape[0] * 0.1)] > 40).any(),
         "e mesmo assim ela está no alto do espaço")
conferir(not (alfa[int(alfa.shape[0] * 0.75):] > 40).any(),
         "com o rodapé livre, onde o logotipo é escrito")

print("\n• Foto que não deu para recortar entra dissolvida, não como retângulo")
# A regra que o padrão do kit não abre mão: fotografia retangular parada dentro da
# arte se denuncia pelas quatro arestas retas. Se recortar falhou, as bordas são
# apagadas num degradê para a foto encostar no fundo em vez de ser colada nele.
bruta = Image.new("RGB", (1200, 1600), (180, 180, 180))
crua = os.path.join(tempfile.mkdtemp(), "crua.png")
bruta.save(crua)
dissolvida = os.path.join(tempfile.mkdtemp(), "dis.png")
composicao.integrar_retangulo(crua, dissolvida, "A")
d = np.array(Image.open(dissolvida).convert("RGBA").split()[3])
conferir(Image.open(dissolvida).size == composicao.ESPACOS["A"],
         "a foto dissolvida preenche o espaço todo da peça A")
conferir(d[:, 0].max() < 20 and d[:, -1].max() < 20,
         "as laterais sumiram no fundo")
conferir(d[-1, :].max() < 20, "o rodapé também")
conferir(d[int(d.shape[0] * 0.4), int(d.shape[1] // 2)] > 240,
         "e o meio da foto continua inteiro")

print("\n• A altura da logo acompanha o formato dela")
alta = pi.altura_da_logo(os.path.join(RAIZ, "gerador", "bands", "pelada_logo.png"))
conferir(alta == {"A_feed": 300, "A_story": 360, "B_feed": 330, "B_story": 400,
                  "C_feed": 300, "C_story": 360},
         "a logo em pé recebeu os mesmos valores que o autor do kit ajustou à mão")

print("\n• Logo sem fundo transparente é tratada")
r4, g4 = preparar(pasta_com(("pelada_bw.png", "foto1.png"),
                            ("pelada_logo.png", "logo.png")), "teste4")
conferir("bandLogo" in r4 and "logoH" in r4,
         "a logo entrou junto com a altura calculada")

print("\n• Logo com conteúdo branco sobre fundo claro não perde as letras")
# A armadilha que estragou a logo do Toca Rock: o fundo é quase branco E parte do
# desenho é branca. Decidir o modo pela cor dos cantos apaga as letras junto.
fundo_claro = Image.new("RGB", (400, 400), (247, 247, 247))
d = ImageDraw.Draw(fundo_claro)
d.ellipse((40, 40, 360, 360), fill=(110, 10, 10))
d.rectangle((110, 170, 290, 230), fill=(255, 255, 255))   # "letras" brancas
d.ellipse((150, 100, 250, 160), fill=(255, 255, 255))
armadilha = os.path.join(tempfile.mkdtemp(), "logo.png")
fundo_claro.save(armadilha)

destino = os.path.join(tempfile.mkdtemp(), "logo_ok.png")
modo, medidas = pi.recortar_logo(armadilha, destino,
                                 os.path.join(RAIZ, "gerador", "tratar_logo.py"))
conferir(pi.medir_recorte(destino)["buracos"] < 0.05,
         "o modo escolhido (%s) não deixou o desenho vazado" % modo)
brancos = np.array(Image.open(destino).convert("RGBA"))
visivel = brancos[..., 3] > 128
conferir(int((((brancos[..., :3] > 200).all(axis=2)) & visivel).sum()) > 2000,
         "as partes brancas do desenho continuam lá")

print("\n• A trava reprova o recorte que come o desenho")
ruim = os.path.join(tempfile.mkdtemp(), "ruim.png")
pi.executar([sys.executable, os.path.join(RAIZ, "gerador", "tratar_logo.py"),
             armadilha, ruim, "--fundo", "branco"])
try:
    pi.conferir_logo(armadilha, ruim, [])
    conferir(False, "deveria ter reprovado o recorte que apaga o branco")
except Exception as e:
    conferir("vazado" in str(e), "reprovou: %s" % str(e)[:60])

print("\n• A borda do recorte sai esfumada, não em degrau")
dura = Image.new("L", (200, 200), 0)
ImageDraw.Draw(dura).ellipse((50, 50, 150, 150), fill=255)
suave = pi.suavizar_borda(dura)
vals = np.array(suave)
meio_tom = ((vals > 20) & (vals < 235)).sum()
conferir(meio_tom > 200, "a borda ganhou %d pixels de transição" % meio_tom)
conferir(vals.max() > 240 and vals.min() == 0, "o miolo continua sólido e o fora, vazio")

print("\n• Integrantes separados viram uma banda, não uma fila de retratos colados")
montada = os.path.join(tempfile.mkdtemp(), "banda.png")
fontes = [os.path.join(RAIZ, "gerador", "bands", n)
          for n in ("kundera_solo_bw.png", "pelada_bw.png")]
caminho, quantos = pi.juntar_integrantes(fontes, montada)
junta = Image.open(caminho).convert("RGBA")
alfa = np.array(junta.split()[3])
conferir(quantos == 2, "juntou as 2 fotos")
vazio = float((alfa <= 128).mean())
conferir(vazio > 0.10,
         "a montagem tem fundo transparente (%.0f%% vazado), não sólido" % (vazio * 100))

meio = junta.width // 2
metades = [junta.crop((0, 0, meio, junta.height)),
           junta.crop((meio, 0, junta.width, junta.height))]
cabecas = [pi.topo_da_cabeca(m) for m in metades]
conferir(abs(cabecas[0] - cabecas[1]) < junta.height * 0.05,
         "as cabeças dos dois lados estão na mesma linha (%d e %d)" % tuple(cabecas))

# E a linha é a da CABEÇA, não a do ponto mais alto do recorte: quem ergue a
# guitarra tem o instrumento no alto, e alinhar por ele afunda a cabeça da pessoa.
com_mastro = Image.new("RGBA", (300, 700), (0, 0, 0, 0))
d2 = ImageDraw.Draw(com_mastro)
d2.rectangle((145, 0, 155, 260), fill=(200, 200, 200, 255))   # mastro fino
d2.ellipse((110, 260, 190, 350), fill=(200, 200, 200, 255))   # cabeça
d2.rectangle((95, 350, 205, 699), fill=(200, 200, 200, 255))  # tronco
conferir(abs(pi.topo_da_cabeca(com_mastro) - 260) < 20,
         "a cabeça foi achada em %d, abaixo do mastro que começa em 0"
         % pi.topo_da_cabeca(com_mastro))

# O tamanho é o da PESSOA, não o do arquivo: foto de perto e foto de longe têm de
# sair com gente do mesmo tamanho. Sem isto, quem mandou foto da cintura para cima
# vira um gigante ao lado de quem mandou de corpo inteiro.
metades = [junta.crop((0, 0, meio, junta.height)), junta.crop((meio, 0, junta.width, junta.height))]
troncos = [pi.largura_do_tronco(m) for m in metades]
conferir(max(troncos) / max(min(troncos), 1) < 1.6,
         "os dois têm tronco de largura parecida (%.0f e %.0f pixels)" % tuple(troncos))

# E a mesma luz: quem veio de uma foto escura não pode virar a sombra do grupo.
luzes = []
for m in metades:
    dentro = np.array(m.split()[3]) > 128
    if dentro.sum() > 100:
        luzes.append(float(np.median(np.array(m.convert("RGB"), float)[dentro])))
conferir(len(luzes) == 2 and max(luzes) / max(min(luzes), 1) < 1.7,
         "os dois estão na mesma luz (brilho %s)" % [round(x) for x in luzes])

# Encostados, não espalhados: grupo reunido ocupa um bloco só. Se houvesse um vão
# vazio entre as pessoas, haveria uma coluna inteira sem ninguém.
colunas_vazias = int((alfa.max(axis=0) <= 40).sum())
conferir(colunas_vazias < junta.width * 0.04,
         "não sobrou vão vazio entre as pessoas (%d colunas de %d)"
         % (colunas_vazias, junta.width))

print("\n• E a banda montada entra no espaço com as cabeças no alto")
# O defeito que isto guarda é a banda afundar para o rodapé, onde o logotipo é
# escrito — foi o "a pessoa ficou baixa, tampada pela logo". A garantia não é o
# rodapé ficar vazio: nas referências do kit o logotipo passa por cima das pernas,
# e isso é o certo. A garantia é a banda COMEÇAR no alto, que é o que mantém os
# rostos longe do logotipo.
posta = os.path.join(tempfile.mkdtemp(), "montada_B.png")
ocupa = composicao.encaixar(caminho, posta, "B")
am = np.array(Image.open(posta).convert("RGBA").split()[3])
primeira = int(np.where((am > 40).any(axis=1))[0].min())
conferir(primeira / am.shape[0] <= composicao.FOLGA_TOPO["B"] + 0.02,
         "a banda começa a %.0f%% da altura" % (primeira / am.shape[0] * 100))
conferir(ocupa > 0.5,
         "e ocupa o espaço de verdade (%.0f%% da altura), em vez de encolher"
         % (ocupa * 100))

print("\n• A polaroide nunca corta a cabeça de quem está na foto")
# O defeito que isto guarda: a polaroide é deitada e a foto costuma ser em pé, então
# sobra altura e é preciso cortar. Cortando pelo meio, numa foto de alguém curvado,
# a arte saiu com o tronco e SEM o rosto. A cabeça é o que não pode faltar.
def fazer_pessoa(alto=1600, largo=900, cabeca_em=0.08, opaca=False):
    im = Image.new("RGBA", (largo, alto), (40, 40, 40, 255) if opaca else (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    topo = int(alto * cabeca_em)
    d.ellipse((largo * 0.38, topo, largo * 0.62, topo + alto * 0.12),
              fill=(220, 220, 220, 255))                                   # cabeça
    d.rectangle((largo * 0.30, topo + alto * 0.12, largo * 0.70, alto - 1),
                fill=(200, 200, 200, 255))                                 # corpo
    return im


for recortada, oque in ((True, "foto recortada"), (False, "foto inteira, sem recorte")):
    origem = os.path.join(tempfile.mkdtemp(), "p.png")
    fazer_pessoa(opaca=not recortada).save(origem)
    saida = os.path.join(tempfile.mkdtemp(), "c.png")
    composicao.encaixar(origem, saida, "C")

    arte = np.array(Image.open(saida).convert("RGB"))
    claro = (arte > 190).all(axis=2)          # a cabeça é a parte mais clara
    linhas_cabeca = np.where(claro.any(axis=1))[0]
    conferir(len(linhas_cabeca) > 0, "%s: a cabeça aparece na polaroide" % oque)
    if len(linhas_cabeca):
        conferir(linhas_cabeca.min() < arte.shape[0] * 0.35,
                 "%s: e aparece no alto, a %.0f%% da altura"
                 % (oque, linhas_cabeca.min() / arte.shape[0] * 100))

print("\n• Refazer tenta um caminho diferente, não repete o mesmo")
# O recorte é determinístico: a mesma foto sai igual todas as vezes. Um "refazer"
# que repetisse o mesmo cálculo devolveria a mesma arte, e o botão seria mentira.
caminhos = [pi.caminho_da_tentativa(n) for n in (1, 2, 3, 4)]
conferir(caminhos[0] == {}, "a 1ª tentativa é o caminho normal")
conferir(caminhos[1].get("inverter_decisao") is True,
         "a 2ª inverte a decisão de recortar")
conferir(bool(caminhos[2].get("modelo")), "a 3ª troca o recortador")
conferir(caminhos[3].get("nunca_recortar") is True,
         "a 4ª usa a foto inteira, sem recortar")
conferir(len({str(c) for c in caminhos}) == 4, "os quatro caminhos são diferentes entre si")

# E a decisão de recortar obedece ao caminho, não só à leitura do fundo.
estudio = os.path.join(RAIZ, "tmp", "toka_final", "entrada", "foto1.jpg")
if os.path.exists(estudio):
    conferir(pi.decidiu_nao_recortar(estudio, {}) is True,
             "no caminho normal, a foto de estúdio não é recortada")
    conferir(pi.decidiu_nao_recortar(estudio, caminhos[1]) is False,
             "no caminho que inverte, a mesma foto passa a ser recortada")

print("\n• Pedaço solto sai do recorte, mas pessoa afastada fica")
# O microfone no pedestal que o recortador acha, mas cujo pedestal se perde no
# escuro: sobra o microfone boiando ao lado da pessoa, e na arte isso salta.
# O que este teste guarda é o outro lado: numa foto de dois músicos afastados,
# cada um é uma ilha separada, e apagar a menor seria apagar uma pessoa.
tela = Image.new("RGBA", (600, 600), (0, 0, 0, 0))
d3 = ImageDraw.Draw(tela)
d3.rectangle((60, 100, 240, 560), fill=(200, 200, 200, 255))    # pessoa grande
d3.rectangle((330, 180, 450, 560), fill=(200, 200, 200, 255))   # pessoa menor, afastada
d3.ellipse((500, 90, 530, 130), fill=(200, 200, 200, 255))      # microfone solto
com_solto = os.path.join(tempfile.mkdtemp(), "solto.png")
tela.save(com_solto)

apagados = pi.tirar_pedacos_soltos(com_solto)
depois = np.array(Image.open(com_solto).convert("RGBA").split()[3]) > 40
conferir(apagados == 1, "apagou 1 pedaço solto (apagou %d)" % apagados)
conferir(depois[300, 150], "a pessoa grande continua")
conferir(depois[300, 390], "a pessoa menor, afastada, também continua")
conferir(not depois[110, 515], "e o microfone solto sumiu")

print("\n• Foto de fundo neutro não é recortada; foto de palco é")
# Recorte existe para SEPARAR a pessoa do que está atrás. Numa foto de estúdio não
# há o que separar, e recortar só troca um fundo que já combinava por uma silhueta
# com cara de adesivo. Estas são fotos reais que já passaram pelo sistema.
for arquivo, esperado, oque in (
        ("tmp/toka_final/entrada/foto1.jpg", True, "estúdio com degradê azul"),
        ("tmp/toka_final/entrada/foto2.jpg", True, "parede lisa"),
        ("tmp/job/entrada/foto1.jpg", True, "degradê roxo de estúdio"),
        ("tmp/t3_rep/entrada/foto1.jpeg", False, "palco com gente atrás"),
        ("tmp/t3_rep/entrada/foto3.jpeg", False, "palco com amplificador")):
    caminho = os.path.join(RAIZ, arquivo)
    if not os.path.exists(caminho):
        continue
    neutro, medida = pi.fundo_neutro(caminho)
    conferir(neutro == esperado,
             "%s: %s (%s)" % (oque, "não recorta" if neutro else "recorta", medida))

print("\n• A trava da montagem recusa só o recorte perdido, não o apenas difícil")
# A linha ficou em 0,60 enquanto o recorte era por máscara dura. Com matting, a
# foto mais difícil do acervo mede 33% de concordância e a arte montada sai boa —
# sem bloco de fundo e com as cordas da guitarra inteiras. Manter 0,60 recusava
# inscrição que hoje sai bem. Este teste prende a linha nova: 33% passa, e a trava
# continua existindo para o recorte que se perdeu de vez.
# A linha desceu para 0,25 e voltou. O que a fez voltar: a foto de concordância
# 0,33 saía bem SOZINHA, mas na banda montada arrastou um bloco do fundo dela para
# dentro do grupo, ao lado de dois recortes limpos. Recorte duvidoso sozinho some
# no escuro; ao lado de recortes bons, é escancarado.
conferir(pi.CONCORDANCIA_MONTAGEM > 0.33,
         "33%% de concordância NÃO entra numa montagem (a linha está em %.0f%%)"
         % (pi.CONCORDANCIA_MONTAGEM * 100))
conferir(pi.CONCORDANCIA_RESGATE >= pi.CONCORDANCIA_MONTAGEM,
         "e fora da montagem a mesma foto continua aproveitada, pela rede de segurança")


def recorte_falso(concordancia):
    """
    Finge um recorte com a concordância pedida, para provar a decisão da trava.

    Substitui o recorte em processo separado, que é a fronteira que a preparação
    usa de verdade. Trocar a função de dentro não adiantaria: ela roda noutro
    processo, onde nada que este teste mude chega.
    """
    def fingido(entrada, saida, modelo=None):
        Image.open(entrada).convert("RGBA").save(saida)
        return None, concordancia
    return fingido


original = pi.recortar_em_processo_proprio
try:
    opacas = tempfile.mkdtemp()
    for n in ("foto1.png", "foto2.png"):
        Image.open(os.path.join(RAIZ, "gerador", "bands", "pelada_bw.png")) \
            .convert("RGB").save(os.path.join(opacas, n))

    pi.recortar_em_processo_proprio = recorte_falso(0.80)
    gerador = tempfile.mkdtemp()
    os.makedirs(os.path.join(gerador, "bands"))
    for n in ("tratar_foto.py", "tratar_logo.py"):
        shutil.copy(os.path.join(RAIZ, "gerador", n), os.path.join(gerador, n))
    pi.preparar(opacas, gerador, "monta33", juntar=True)
    conferir(True, "com 80% a montagem é feita")

    pi.recortar_em_processo_proprio = recorte_falso(0.33)
    try:
        pi.preparar(opacas, tempfile.mkdtemp(), "monta33", juntar=True)
        conferir(False, "com 33% deveria ter recusado a montagem")
    except Exception as e:
        conferir("não dá para juntar" in str(e),
                 "com 33%% recusa, em vez de pôr um bloco de fundo no meio da banda")
finally:
    pi.recortar_em_processo_proprio = original

print("\n• Foto vazia é recusada em vez de virar arte quebrada")
vazia = tempfile.mkdtemp()
Image.new("RGBA", (400, 400), (0, 0, 0, 0)).save(os.path.join(vazia, "foto1.png"))
try:
    preparar(vazia, "teste5")
    conferir(False, "deveria ter recusado a foto vazia")
except Exception as e:
    conferir(True, "recusou com: %s" % str(e)[:70])

print("\n======================================")
print("%d verificações passaram, %d falharam\n" % (passou, falhou))
sys.exit(1 if falhou else 0)
