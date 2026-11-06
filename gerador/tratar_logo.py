"""Remove o fundo da logo da banda.
uso: python3 tratar_logo.py entrada.jpg bands/logo.png --fundo branco|preto|bordas
 branco: remove fundo branco | preto: remove fundo preto (logo colorida/clara) | bordas: remove só o preto externo (símbolos pretos com contorno)"""
import sys, numpy as np
from PIL import Image, ImageDraw
src, dst = sys.argv[1], sys.argv[2]; modo = sys.argv[sys.argv.index('--fundo')+1] if '--fundo' in sys.argv else 'branco'
im = Image.open(src).convert('RGB'); a = np.array(im).astype(float)
if modo == 'branco': alpha = np.clip((255 - a.min(axis=2) - 12) * 6, 0, 255)
elif modo == 'preto': alpha = np.clip((a.max(axis=2) - 18) * 5, 0, 255)
else:
    f = im.copy(); w, h = im.size
    for p in [(0,0),(w-1,0),(0,h-1),(w-1,h-1)]: ImageDraw.floodfill(f, p, (255,0,255), thresh=60)
    b = np.array(f); alpha = (~((b[...,0]==255)&(b[...,1]==0)&(b[...,2]==255)))*255.0
o = Image.fromarray(np.dstack([a, alpha]).astype('uint8'), 'RGBA'); o = o.crop(o.getbbox()); o.save(dst); print(dst, o.size)
