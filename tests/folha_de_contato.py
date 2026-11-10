"""
Junta as artes de um ou mais cenários numa folha só, para serem olhadas de uma vez.

Nenhuma medida substitui olhar a arte. Esta folha existe para tornar o olhar
barato: as peças lado a lado, com o nome do cenário em cima.

uso: python tests/folha_de_contato.py [feed|story] [pedaço_do_nome ...]
"""
import glob
import os
import sys

from PIL import Image, ImageDraw

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BATERIA = os.path.join(RAIZ, "tmp", "bateria")
ALTURA = 520
TITULO = 30


def folha(formato, filtros):
    cenarios = sorted(d for d in os.listdir(BATERIA)
                      if os.path.isdir(os.path.join(BATERIA, d))
                      and (not filtros or any(f in d for f in filtros)))
    blocos = []
    for cenario in cenarios:
        pecas = sorted(glob.glob(os.path.join(BATERIA, cenario, "*_%s.jpg" % formato)) +
                       glob.glob(os.path.join(BATERIA, cenario, "*_%s.png" % formato)))
        if not pecas:
            continue
        ims = []
        for p in pecas:
            im = Image.open(p).convert("RGB")
            ims.append(im.resize((int(im.width * ALTURA / im.height), ALTURA)))
        larg = sum(i.width for i in ims) + 8 * (len(ims) - 1)
        bloco = Image.new("RGB", (larg, ALTURA + TITULO), "white")
        ImageDraw.Draw(bloco).text((4, 8), cenario, fill="black")
        x = 0
        for i in ims:
            bloco.paste(i, (x, TITULO))
            x += i.width + 8
        blocos.append(bloco)

    if not blocos:
        raise SystemExit("nenhuma arte encontrada em " + BATERIA)
    largura = max(b.width for b in blocos)
    tela = Image.new("RGB", (largura, sum(b.height + 14 for b in blocos)), "white")
    y = 0
    for b in blocos:
        tela.paste(b, (0, y))
        y += b.height + 14
    destino = os.path.join(BATERIA, "_folha_%s.png" % formato)
    tela.save(destino)
    print(destino, tela.size, "—", len(blocos), "cenários")
    return destino


if __name__ == "__main__":
    args = sys.argv[1:]
    formato = args[0] if args and args[0] in ("feed", "story") else "feed"
    folha(formato, [a for a in args if a != formato])
