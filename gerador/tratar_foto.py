"""Trata o PNG recortado (vindo do ChatGPT) para o padrão da agenda: P&B, alto contraste, nitidez.
uso: python3 tratar_foto.py entrada.png bands/saida_bw.png [--crop 0.66]
--crop corta a parte de cima da imagem (ex.: 0.66 = da cabeça até ~cintura), útil p/ fotos de corpo inteiro nos layouts A e C."""
import sys
from PIL import Image, ImageOps, ImageEnhance, ImageFilter
src, dst = sys.argv[1], sys.argv[2]
crop = float(sys.argv[sys.argv.index('--crop')+1]) if '--crop' in sys.argv else None
im = Image.open(src).convert('RGBA'); a = im.split()[3]
g = ImageOps.grayscale(im.convert('RGB')); g = ImageOps.autocontrast(g, cutoff=0.5)
g = ImageEnhance.Contrast(g).enhance(1.25).filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
o = Image.merge('RGBA', (g, g, g, a)); o = o.crop(o.getbbox())
if crop: o = o.crop((0, 0, o.width, int(o.height*crop)))
o.save(dst); print(dst, o.size)
