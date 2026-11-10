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

# Largura da miniatura que acompanha cada peça. Ela existe para o relatório em PDF:
# ali a arte aparece pequena, só para se reconhecer o que foi publicado, e embutir
# a peça inteira no arquivo faria um relatório trimestral passar de 30 MB — grande
# demais para o Apps Script montar e para alguém abrir no celular. Gerada aqui, e
# não na hora do relatório, porque aqui já existe uma ferramenta que redimensiona
# imagem; no Apps Script não existe.
LARGURA_MINIATURA = 260


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


def miniatura(origem, destino, largura=LARGURA_MINIATURA):
    """Versão pequena da peça, para o relatório. Ver LARGURA_MINIATURA."""
    im = Image.open(origem).convert("RGB")
    altura = max(1, round(im.height * largura / im.width))
    im.resize((largura, altura), Image.LANCZOS).save(
        destino, "JPEG", quality=76, optimize=True)
    return os.path.getsize(destino)


if __name__ == "__main__":
    pasta_png, pasta_jpeg = sys.argv[1], sys.argv[2]
    os.makedirs(pasta_jpeg, exist_ok=True)
    for nome in sorted(os.listdir(pasta_png)):
        if not nome.lower().endswith(".png"):
            continue
        saida = os.path.join(pasta_jpeg, nome[:-4] + ".jpg")
        q = converter(os.path.join(pasta_png, nome), saida)
        mini = os.path.join(pasta_jpeg, nome[:-4] + "_mini.jpg")
        bytes_mini = miniatura(saida, mini)
        print("  %s  (qualidade %d, %.1f MB; miniatura %d KB)" % (
            os.path.basename(saida), q, os.path.getsize(saida) / 1048576,
            round(bytes_mini / 1024)))
