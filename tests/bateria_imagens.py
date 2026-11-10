"""
Bateria de cenários do tratamento de imagem, de ponta a ponta.

Cada cenário monta uma pasta de entrada como a que chega de uma banda de verdade,
roda a preparação das imagens e o gerador do kit, e guarda as seis peças (A, B e C,
em feed e story). No fim imprime um quadro com o que cada cenário produziu — tempo,
quanto da altura a banda ocupou em cada peça e os avisos que subiriam para o painel.

As artes ficam em tmp/bateria/<cenário>/, para serem olhadas. Nenhum número aqui
substitui olhar: eles dizem que a peça não está vazia nem com a banda no chão, não
que ela ficou bonita.

uso: python tests/bateria_imagens.py [nome_do_cenário ...]
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(RAIZ, "worker"))

import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

import composicao  # noqa: E402
import preparar_imagens as pi  # noqa: E402

SAIDA = os.path.join(RAIZ, "tmp", "bateria")
TMP = os.path.join(RAIZ, "tmp")
BANDS = os.path.join(RAIZ, "gerador", "bands")

# Fotos de bandas de verdade, as mesmas que já passaram pelo sistema em produção.
F = {
    "pe_bar":      f"{TMP}/toka_final/entrada/foto1.jpg",     # 1 pessoa em pé, bar
    "grupo_deit":  f"{TMP}/toka_final/entrada/foto2.jpg",     # grupo, foto deitada
    "luz_azul":    f"{TMP}/t3_rep/entrada/foto2.jpeg",        # pessoa diluída na luz
    "corpo":       f"{TMP}/t3_rep/entrada/foto1.jpeg",        # corpo inteiro
    "palco":       f"{TMP}/t3_rep/entrada/foto3.jpeg",        # no palco
    "larga":       f"{TMP}/job/entrada/foto1.jpg",            # bem deitada
    "retrato":     f"{TMP}/job/entrada/foto2.jpg",
    "ja_pronta":   f"{BANDS}/pelada_bw.png",                  # PNG já recortado
    "trio_pronto": f"{BANDS}/kundera_trio_bw.png",
    "solo_pronto": f"{BANDS}/kundera_solo_bw.png",
}
L = {
    "fundo_branco": f"{TMP}/toka_final/entrada/logo.jpg",     # a armadilha do Toca Rock
    "quadrada":     f"{TMP}/t3_rep/entrada/logo.jpeg",
    "transparente": f"{TMP}/job/entrada/logo.png",
}

# (nome, fotos, logo, juntar, o que este cenário põe à prova)
CENARIOS = [
    ("1-uma-pessoa-em-pe", ["pe_bar"], "fundo_branco", False,
     "o caso mais comum: uma foto só, pessoa em pé, fundo de bar"),
    ("2-duas-fotos", ["grupo_deit", "pe_bar"], "fundo_branco", False,
     "duas fotos: a deitada vai para A e C, a em pé para B"),
    ("3-tres-separados-juntar", ["corpo", "luz_azul", "palco"], "quadrada", True,
     "três integrantes em fotos separadas, montados numa banda só"),
    ("4-quatro-fotos", ["corpo", "palco", "pe_bar", "retrato"], "quadrada", False,
     "o limite de quatro fotos, sem montagem"),
    ("5-ja-recortada", ["ja_pronta"], "transparente", False,
     "PNG que já chega com fundo transparente: não pode ser recortado de novo"),
    ("6-so-foto-deitada", ["larga"], "quadrada", False,
     "uma foto muito mais deitada que o vão alto da peça B"),
    ("7-sem-logo", ["pe_bar"], None, False,
     "sem logotipo: o nome da banda é escrito na arte"),
    ("8-logo-letras-brancas", ["corpo"], "fundo_branco", False,
     "logo branca sobre fundo branco, que já apagou as letras uma vez"),
    ("9-corpo-inteiro", ["corpo"], "quadrada", False,
     "corpo inteiro: a polaroide precisa cortar na cintura"),
    ("10-luz-dificil", ["luz_azul"], "quadrada", False,
     "a foto mais difícil de todas: a pessoa se mistura com a luz do fundo"),
    ("11-mistura-pronta-e-crua", ["ja_pronta", "pe_bar"], "quadrada", False,
     "uma foto já recortada junto com uma crua"),
    ("12-dois-prontos-juntar", ["trio_pronto", "solo_pronto"], "transparente", True,
     "montagem a partir de PNGs que já vieram recortados"),
]


def montar_entrada(fotos, logo):
    pasta = tempfile.mkdtemp(prefix="bateria_")
    for i, chave in enumerate(fotos):
        origem = F[chave]
        shutil.copy(origem, os.path.join(pasta, "foto%d%s"
                                         % (i + 1, os.path.splitext(origem)[1])))
    if logo:
        shutil.copy(L[logo], os.path.join(pasta, "logo" + os.path.splitext(L[logo])[1]))
    return pasta


def ocupacao(caminho_rel):
    """Quanto da altura do espaço a banda ocupou, no arquivo entregue ao layout."""
    im = Image.open(os.path.join(RAIZ, "gerador", caminho_rel)).convert("RGBA")
    visivel = np.array(im.split()[3]) > 40
    linhas = np.where(visivel.any(axis=1))[0]
    if not len(linhas):
        return 0.0
    return (linhas.max() - linhas.min() + 1) / im.height


def topo_da_banda(caminho_rel):
    """A que altura do espaço começa a banda. Perto de 0 é o certo."""
    im = Image.open(os.path.join(RAIZ, "gerador", caminho_rel)).convert("RGBA")
    visivel = np.array(im.split()[3]) > 40
    linhas = np.where(visivel.any(axis=1))[0]
    return (linhas.min() / im.height) if len(linhas) else 1.0


def rodar(nome, fotos, logo, juntar, proposito):
    print(f"\n=== {nome} — {proposito}", flush=True)
    entrada = montar_entrada(fotos, logo)
    destino = os.path.join(SAIDA, nome)
    shutil.rmtree(destino, ignore_errors=True)
    os.makedirs(destino, exist_ok=True)

    relogio = time.time()
    try:
        imagens = pi.preparar(entrada, os.path.join(RAIZ, "gerador"), nome, juntar=juntar)
    except Exception as e:
        print(f"  RECUSADO: {e}")
        return {"nome": nome, "recusado": str(e), "segundos": time.time() - relogio}
    preparo = time.time() - relogio

    avisos = imagens.pop("_avisos", [])
    show = dict(slug=nome, band="BANDA DE TESTE", day="27", weekday="SEXTA-FEIRA",
                mes="NOVEMBRO", mesAbrev="NOV", **imagens)
    arquivo = os.path.join(entrada, "show.json")
    with open(arquivo, "w", encoding="utf-8") as f:
        json.dump([show], f, ensure_ascii=False)

    subprocess.run(["node", "render3.js", arquivo, destino],
                   cwd=os.path.join(RAIZ, "gerador"), check=True,
                   capture_output=True, text=True)

    medidas = {p: (round(ocupacao(imagens[k]), 3), round(topo_da_banda(imagens[k]), 3))
               for p, k in (("A", "photo"), ("B", "photoB"), ("C", "photoC"))
               if k in imagens}
    print(f"  {preparo:.0f}s de preparo, {len(os.listdir(destino))} peças")
    for peca, (ocup, topo) in medidas.items():
        marca = "  " if ocup >= composicao.ALTURA_POBRE else "<-"
        print(f"   {marca} {peca}: ocupa {ocup * 100:4.0f}% da altura, começa a {topo * 100:3.0f}%")
    for a in avisos:
        print(f"      aviso: {a}")
    return {"nome": nome, "segundos": preparo, "medidas": medidas, "avisos": avisos}


if __name__ == "__main__":
    pedidos = sys.argv[1:]
    escolhidos = [c for c in CENARIOS if not pedidos
                  or any(p in c[0] for p in pedidos)]
    os.makedirs(SAIDA, exist_ok=True)
    resultados = [rodar(*c) for c in escolhidos]
    with open(os.path.join(SAIDA, "resultados.json"), "w", encoding="utf-8") as f:
        json.dump(resultados, f, ensure_ascii=False, indent=1)
    print(f"\n{len(resultados)} cenários. Artes em {SAIDA}")
