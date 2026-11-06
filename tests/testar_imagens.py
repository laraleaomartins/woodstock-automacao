"""
Testes da preparação das imagens.

O gabarito é o próprio exemplo do kit: nele, a foto DEITADA do trio vai para as
opções A e C, e a foto EM PÉ vai para a opção B. Inverter isso deixa metade da
peça B vazia — já aconteceu, e é o que este teste impede de voltar.

uso: python tests/testar_imagens.py
"""
import os
import shutil
import sys
import tempfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(RAIZ, "worker"))

from PIL import Image  # noqa: E402

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


def preparar(entrada, ident):
    gerador = tempfile.mkdtemp()
    os.makedirs(os.path.join(gerador, "bands"))
    for n in ("tratar_foto.py", "tratar_logo.py"):
        shutil.copy(os.path.join(RAIZ, "gerador", n), os.path.join(gerador, n))
    return pi.preparar(entrada, gerador, ident), gerador


print("\nTESTES DA PREPARAÇÃO DAS IMAGENS")

print("\n• Cada layout recebe a foto com o formato certo")
r, _ = preparar(pasta_com(("kundera_trio_bw.png", "foto1.png"),
                          ("kundera_solo_bw.png", "foto2.png")), "teste1")
conferir("_bw.png" in r["photo"] and "empe" not in r["photo"],
         "a opção A/C recebeu uma foto")
conferir("photoB" in r, "a opção B recebeu uma foto própria")


def forma(caminho_rel, gerador=None):
    p = os.path.join(RAIZ, "gerador", caminho_rel)
    im = Image.open(p).convert("RGBA")
    bb = im.getbbox()
    return (bb[2] - bb[0]) / (bb[3] - bb[1])


r2, gerador2 = preparar(pasta_com(("kundera_trio_bw.png", "foto1.png"),
                                  ("kundera_solo_bw.png", "foto2.png")), "teste2")


def forma_em(gerador, rel):
    im = Image.open(os.path.join(gerador, rel)).convert("RGBA")
    bb = im.getbbox()
    return (bb[2] - bb[0]) / (bb[3] - bb[1])


a_c = forma_em(gerador2, r2["photo"])
b = forma_em(gerador2, r2["photoB"])
conferir(a_c > 1, "a foto das opções A e C é deitada (proporção %.2f)" % a_c)
conferir(b < 1, "a foto da opção B é em pé (proporção %.2f)" % b)
conferir(a_c > b, "e a de A/C é mais deitada que a da B")

print("\n• Foto já recortada passa direto, sem recortar de novo")
r3, g3 = preparar(pasta_com(("pelada_bw.png", "foto1.png")), "teste3")
conferir("photo" in r3, "a foto transparente foi aceita")
conferir(any("já veio recortada" in a for a in r3["_avisos"]),
         "o sistema avisou que usou direto")
conferir("photoB" not in r3, "com uma foto só, não inventa uma segunda")

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
from PIL import ImageDraw  # noqa: E402

fundo_claro = Image.new("RGB", (400, 400), (247, 247, 247))
d = ImageDraw.Draw(fundo_claro)
d.ellipse((40, 40, 360, 360), fill=(110, 10, 10))
d.rectangle((110, 170, 290, 230), fill=(255, 255, 255))   # "letras" brancas
d.ellipse((150, 100, 250, 160), fill=(255, 255, 255))
armadilha = os.path.join(tempfile.mkdtemp(), "logo.png")
fundo_claro.save(armadilha)

destino = os.path.join(tempfile.mkdtemp(), "logo_ok.png")
modo, medidas = pi.recortar_logo(armadilha, destino, os.path.join(RAIZ, "gerador", "tratar_logo.py"))
conferir(pi.medir_recorte(destino)["buracos"] < 0.05,
         "o modo escolhido (%s) não deixou o desenho vazado" % modo)
brancos = __import__("numpy").array(Image.open(destino).convert("RGBA"))
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
vals = __import__("numpy").array(suave)
meio_tom = ((vals > 20) & (vals < 235)).sum()
conferir(meio_tom > 200, "a borda ganhou %d pixels de transição" % meio_tom)
conferir(vals.max() > 240 and vals.min() == 0, "o miolo continua sólido e o fora, vazio")

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
