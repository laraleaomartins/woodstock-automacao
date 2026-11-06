"""
Converte as peças de PNG para JPEG.

A API da Meta só aceita JPEG, e os arquivos ainda precisam caber no limite de 8 MB
dela. O tamanho em pixels não muda: feed continua 1080x1350 e story 1080x1920.

uso: python para_jpeg.py <pasta_png> <pasta_jpeg>
"""
import os
import sys

from PIL import Image

LIMITE_BYTES = 7 * 1024 * 1024


def converter(origem, destino):
    im = Image.open(origem)
    if im.mode != "RGB":
        fundo = Image.new("RGB", im.size, (10, 10, 10))
        im = im.convert("RGBA")
        fundo.paste(im, mask=im.split()[3])
        im = fundo
    for qualidade in (92, 86, 80, 72):
        im.save(destino, "JPEG", quality=qualidade, subsampling=0, optimize=True,
                progressive=False)
        if os.path.getsize(destino) <= LIMITE_BYTES:
            return qualidade
    return qualidade


if __name__ == "__main__":
    pasta_png, pasta_jpeg = sys.argv[1], sys.argv[2]
    os.makedirs(pasta_jpeg, exist_ok=True)
    for nome in sorted(os.listdir(pasta_png)):
        if not nome.lower().endswith(".png"):
            continue
        saida = os.path.join(pasta_jpeg, nome[:-4] + ".jpg")
        q = converter(os.path.join(pasta_png, nome), saida)
        print("  %s  (qualidade %d, %.1f MB)" % (
            os.path.basename(saida), q, os.path.getsize(saida) / 1048576))
