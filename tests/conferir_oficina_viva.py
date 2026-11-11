"""
Conferência diária: a oficina ainda consegue produzir uma arte?

Por que isto existe. As bibliotecas de imagem eram instaladas sem versão escrita, e a
oficina só roda quando uma banda se inscreve. Juntando as duas coisas, uma atualização
de biblioteca quebrava a produção e o primeiro a descobrir era quem estava esperando a
arte — sem nenhum aviso antes. Esta conferência roda todo dia de manhã, de graça, e o
GitHub manda e-mail quando ela falha. A quebra passa a aparecer num dia qualquer.

O que ela NÃO é: não é um teste de qualidade de recorte. Ela não olha se a arte ficou
bonita — isso é olho humano, e é a aprovação peça a peça no painel. Ela responde uma
pergunta só, e de sim ou não: as ferramentas ainda funcionam e as seis peças ainda saem?

Nada de material de banda entra aqui. As imagens são desenhadas na hora, com formas
geométricas, e jogadas fora no fim. O repositório é público.
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
WORKER = os.path.join(RAIZ, "worker")
GERADOR = os.path.join(RAIZ, "gerador")
PYTHON = sys.executable

passou = []
falhou = []


def conferir(ok, oque, detalhe=""):
    (passou if ok else falhou).append(oque)
    print(("   ok   " if ok else "   FALHA ") + oque + (" — " + detalhe if detalhe else ""),
          flush=True)


# ---------------------------------------------------------------- as versões

def registrar_versoes():
    """
    Escreve o que está instalado de verdade.

    É o registro que permite travar tudo no número exato depois, e é a primeira coisa
    a olhar quando a conferência falhar: compare com a execução de ontem e a biblioteca
    que mudou aparece sozinha.
    """
    print("\nO QUE ESTÁ INSTALADO")
    import numpy
    import PIL
    import rembg
    import scipy
    for nome, versao in [("rembg", rembg.__version__), ("pillow", PIL.__version__),
                         ("numpy", numpy.__version__), ("scipy", scipy.__version__)]:
        print("   %-8s %s" % (nome, versao))


# ---------------------------------------------------------------- as imagens falsas

def figura_sobre_fundo(caminho):
    """Uma figura escura sobre fundo claro — o bastante para o recortador ter o que separar."""
    from PIL import Image, ImageDraw

    im = Image.new("RGB", (900, 1200), (232, 232, 236))
    d = ImageDraw.Draw(im)
    d.ellipse((360, 170, 540, 350), fill=(40, 40, 46))          # cabeça
    d.rounded_rectangle((320, 350, 580, 900), 40, fill=(40, 40, 46))  # tronco
    d.rounded_rectangle((250, 400, 330, 760), 30, fill=(40, 40, 46))  # braço
    d.rounded_rectangle((570, 400, 650, 760), 30, fill=(40, 40, 46))  # braço
    im.save(caminho, quality=92)


def figura_ja_recortada(caminho):
    """
    A mesma figura, já com fundo transparente.

    Serve para conferir a parte de montar e desenhar a arte sem depender de o
    recortador achar uma pessoa num desenho geométrico — o que daria alarme falso.
    """
    from PIL import Image, ImageDraw

    im = Image.new("RGBA", (900, 1200), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((360, 170, 540, 350), fill=(60, 60, 68, 255))
    d.rounded_rectangle((320, 350, 580, 900), 40, fill=(60, 60, 68, 255))
    d.rounded_rectangle((250, 400, 330, 760), 30, fill=(60, 60, 68, 255))
    d.rounded_rectangle((570, 400, 650, 760), 30, fill=(60, 60, 68, 255))
    im.save(caminho)


def logo_falsa(caminho):
    from PIL import Image, ImageDraw

    im = Image.new("RGBA", (600, 240), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((10, 40, 590, 200), 24, fill=(255, 255, 255, 255))
    d.rounded_rectangle((40, 70, 560, 170), 16, fill=(20, 20, 24, 255))
    im.save(caminho)


# ---------------------------------------------------------------- as conferências

def conferir_recortador(pasta):
    """
    O recortador roda com os MESMOS parâmetros que a produção usa.

    É aqui que uma versão nova de biblioteca é pega. Os parâmetros `vitmatte` e
    `decontaminate` são o que entrega borda sem contorno cinza; se uma atualização
    renomear qualquer um deles, esta chamada quebra — e é exatamente o que se quer
    descobrir num dia qualquer, em vez de no dia da banda.

    O que NÃO é conferido aqui: se o recorte ficou bom. Numa figura geométrica essa
    pergunta não tem resposta, e exigi-la daria alarme falso.
    """
    import io

    from PIL import Image
    from rembg import new_session, remove

    foto = os.path.join(pasta, "figura.jpg")
    figura_sobre_fundo(foto)

    with open(foto, "rb") as f:
        bruto = f.read()

    try:
        sessao = new_session("birefnet-general")
    except Exception as e:
        conferir(False, "o recortador principal carregou", str(e)[:140])
        return
    conferir(True, "o recortador principal carregou (birefnet-general)")

    try:
        saida = remove(bruto, session=sessao, post_process_mask=True,
                       vitmatte=True, decontaminate=True)
    except Exception as e:
        conferir(False, "o recorte rodou com os parâmetros da produção", str(e)[:200])
        return
    conferir(True, "o recorte rodou com os parâmetros da produção "
                   "(post_process_mask, vitmatte, decontaminate)")

    im = Image.open(io.BytesIO(saida))
    conferir(im.mode == "RGBA", "o recorte voltou com canal de transparência",
             "veio em " + im.mode)

    alfa = im.getchannel("A")
    minimo, maximo = alfa.getextrema()
    conferir(minimo == 0 and maximo == 255,
             "o recorte tem parte transparente e parte opaca",
             "alfa de %d a %d" % (minimo, maximo))

    meios = sum(alfa.histogram()[8:248])
    conferir(meios > 0,
             "a borda saiu dissolvida, e não em degrau "
             "(%d pixels de transição)" % meios,
             "zero pixel de meio-tom: o matting parou de funcionar" if not meios else "")


def conferir_a_arte_inteira(pasta):
    """
    Da foto às seis peças, pelo mesmo caminho que a produção usa.

    Entra com a figura JÁ recortada, de propósito: assim esta conferência mede montar,
    desenhar e converter, sem depender de o recortador achar uma pessoa num desenho —
    que é o que a conferência anterior já mediu, do jeito certo.
    """
    entrada = os.path.join(pasta, "entrada")
    saida_png = os.path.join(pasta, "saida")
    publico = os.path.join(pasta, "publico")
    os.makedirs(entrada, exist_ok=True)

    figura_ja_recortada(os.path.join(entrada, "foto1.png"))
    logo_falsa(os.path.join(entrada, "logo.png"))

    ident = "CONFERENCIA_DIARIA"
    json_imagens = os.path.join(pasta, "imagens.json")
    r = subprocess.run(
        [PYTHON, os.path.join(WORKER, "preparar_imagens.py"),
         entrada, GERADOR, ident, "--json", json_imagens],
        capture_output=True, text=True)
    if r.returncode != 0:
        conferir(False, "a preparação das imagens terminou",
                 (r.stderr or r.stdout or "").strip().splitlines()[-1][:220]
                 if (r.stderr or r.stdout).strip() else "sem saída")
        return
    conferir(True, "a preparação das imagens terminou")

    with open(json_imagens, encoding="utf-8") as f:
        imagens = json.load(f)
    conferir(bool(imagens.get("photo")), "saiu a imagem da peça de tarja")
    conferir(bool(imagens.get("photoB")), "saiu a imagem da peça de coluna")
    conferir(bool(imagens.get("photoC")), "saiu a imagem da polaroide")

    show = dict(imagens)
    for chave in ("_avisos", "_fotos"):
        show.pop(chave, None)
    show.update({"slug": ident, "band": "CONFERENCIA", "day": "28",
                 "weekday": "SÁBADO", "mes": "NOVEMBRO", "mesAbrev": "NOV",
                 "couvert": "15"})
    arquivo_show = os.path.join(pasta, "show.json")
    with open(arquivo_show, "w", encoding="utf-8") as f:
        json.dump([show], f, ensure_ascii=False)

    r = subprocess.run(["node", "render3.js", arquivo_show, saida_png],
                       cwd=GERADOR, capture_output=True, text=True)
    if r.returncode != 0:
        conferir(False, "o desenho das peças terminou",
                 (r.stderr or r.stdout or "").strip()[-220:])
        return
    conferir(True, "o desenho das peças terminou")

    pecas = [n for n in os.listdir(saida_png) if n.endswith(".png")]
    conferir(len(pecas) == 6, "saíram as seis peças (3 de feed e 3 de story)",
             "saíram %d" % len(pecas))

    r = subprocess.run([PYTHON, os.path.join(WORKER, "para_jpeg.py"), saida_png, publico],
                       capture_output=True, text=True)
    if r.returncode != 0:
        conferir(False, "a conversão para JPEG terminou",
                 (r.stderr or r.stdout or "").strip()[-220:])
        return
    conferir(True, "a conversão para JPEG terminou")

    jpgs = [n for n in os.listdir(publico) if n.endswith(".jpg") and "_mini" not in n]
    minis = [n for n in os.listdir(publico) if n.endswith("_mini.jpg")]
    conferir(len(jpgs) == 6, "as seis peças viraram JPEG", "viraram %d" % len(jpgs))
    conferir(len(minis) == 6, "e cada uma ganhou sua miniatura", "saíram %d" % len(minis))


def principal():
    registrar_versoes()
    pasta = tempfile.mkdtemp(prefix="conferencia_")
    try:
        print("\nO RECORTADOR AINDA RESPONDE?")
        conferir_recortador(pasta)
        print("\nAS SEIS PEÇAS AINDA SAEM?")
        conferir_a_arte_inteira(pasta)
    finally:
        shutil.rmtree(pasta, ignore_errors=True)

    print("\n" + "=" * 54)
    print("%d conferência(s) passaram, %d falharam" % (len(passou), len(falhou)))
    if falhou:
        print("\nO que falhou:")
        for f in falhou:
            print("  - " + f)
        print("\nA lista de versões está no começo desta saída. Compare com a execução "
              "de ontem:\na biblioteca que mudou aparece sozinha.")
    print()
    return 1 if falhou else 0


if __name__ == "__main__":
    sys.exit(principal())
