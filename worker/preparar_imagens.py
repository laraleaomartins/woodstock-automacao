"""
Prepara as imagens de uma banda para o gerador do kit.

Faz, em ordem, o que o passo a passo do kit manda fazer à mão:
  1. recorta o fundo da foto (o kit faz isso pelo ChatGPT; aqui usa o rembg, que é
     gratuito, roda local e não depende de navegador aberto);
  2. trata em preto e branco com o tratar_foto.py do próprio kit;
  3. cria a versão cortada até a cintura para as opções A e C, quando a foto é de
     corpo inteiro;
  4. tira o fundo da logo com o tratar_logo.py do kit, escolhendo sozinho o modo.

Se a foto já vier recortada com fundo transparente, pula o rembg e usa direto —
é o que o kit manda fazer quando a cliente envia o PNG pronto.

uso: python preparar_imagens.py <pasta_entrada> <pasta_gerador> <id> [--json saida.json]
"""
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image

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


def _aplicar_mascara(entrada, mascara, saida):
    im = Image.open(entrada).convert("RGBA")
    alfa = Image.fromarray((mascara * 255).astype("uint8"), "L").resize(im.size)
    im.putalpha(suavizar_borda(alfa))
    im.save(saida)


def conferir_tem_conteudo(imagem):
    """Imagem quase toda transparente vira arte em branco — melhor recusar aqui."""
    visivel = (np.array(imagem.split()[3]) > 128).mean()
    if visivel < 0.02:
        raise RuntimeError("a imagem está praticamente vazia (só %.1f%% dela aparece)"
                           % (visivel * 100))


def recortar_fundo(entrada, saida):
    """
    Recorta o fundo e diz o quanto dá para confiar no resultado.

    Devolve (caminho, aviso) — aviso é None quando o recorte é confiável.

    O modelo bom (birefnet) é lento mas é o único que não engole um integrante da
    banda: medido numa foto de 4 pessoas, o modelo rápido apagou um deles inteiro.
    O modelo rápido ainda é rodado em seguida, só para comparar: quando os dois
    discordam muito, é sinal de que a foto é ambígua e o recorte provavelmente
    comeu alguma coisa. Medido: fotos que recortam bem dão 96–97% de concordância;
    a foto problemática deu 56%.
    """
    from rembg import remove, new_session

    with open(entrada, "rb") as f:
        bruto = f.read()

    cortado = remove(bruto, session=new_session(MODELO_BOM), post_process_mask=True)
    with open(saida, "wb") as f:
        f.write(cortado)
    if not tem_transparencia_real(saida):
        raise RuntimeError("o recorte saiu sem transparência — foto provavelmente ruim")

    # Mesmo o recorte bom sai com uma carreirinha do fundo antigo na borda.
    pronta = Image.open(saida).convert("RGBA")
    pronta.putalpha(suavizar_borda(pronta.split()[3]))
    pronta.save(saida)

    principal = _mascara(saida)
    if principal.sum() < principal.size * 0.04:
        raise RuntimeError("sobrou quase nada da foto depois do recorte (%.1f%% da imagem)"
                           % (principal.sum() / principal.size * 100))

    aviso = None
    try:
        outra = _mascara_de_bytes(remove(bruto, session=new_session(MODELO_CONFERENCIA),
                                         post_process_mask=True))
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
            terceira = _mascara_de_bytes(remove(bruto, session=new_session(MODELO_RESGATE),
                                                post_process_mask=True))
            _aplicar_mascara(entrada, principal | outra | terceira, saida)
            aviso = ("o recorte de fundo desta foto é duvidoso (os recortadores "
                     "discordaram em %.0f%% da área, e juntei o que cada um achou). "
                     "Confira a arte antes de aprovar; se estiver faltando alguém ou algum "
                     "pedaço, envie a foto já recortada em PNG com fundo transparente."
                     % ((1 - concordancia) * 100))
    except Exception as e:
        aviso = "não consegui conferir a qualidade do recorte: %s" % e

    return saida, aviso


def corpo_inteiro(caminho):
    """Foto bem mais alta que larga quase sempre é de corpo inteiro."""
    im = Image.open(caminho)
    cx = im.convert("RGBA").getbbox()
    if not cx:
        return False
    largura, altura = cx[2] - cx[0], cx[3] - cx[1]
    return altura / max(largura, 1) > 1.55


def proporcao(caminho):
    """Largura dividida por altura da parte visível. Acima de 1 a foto é deitada."""
    im = Image.open(caminho).convert("RGBA")
    cx = im.getbbox()
    if not cx:
        return 0
    return (cx[2] - cx[0]) / max(cx[3] - cx[1], 1)


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


def preparar(pasta_entrada, pasta_gerador, ident):
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
    recortadas = []
    for i, foto in enumerate(fotos):
        destino = os.path.join(trabalho, "cortada%d.png" % (i + 1))
        try:
            if tem_transparencia_real(foto):
                pronta = Image.open(foto).convert("RGBA")
                conferir_tem_conteudo(pronta)
                pronta.save(destino)
                avisos.append("foto%d já veio recortada; usada direto" % (i + 1))
            else:
                _, aviso = recortar_fundo(foto, destino)
                if aviso:
                    avisos.append("foto%d: %s" % (i + 1, aviso))
            recortadas.append(destino)
        except Exception as e:  # uma foto ruim não derruba a programação inteira
            avisos.append("foto%d descartada: %s" % (i + 1, e))

    if not recortadas:
        raise RuntimeError("nenhuma das fotos pôde ser recortada; " + " | ".join(avisos))

    # Cada layout tem um espaço com formato diferente, e é o próprio kit que mostra
    # qual foto vai em qual: no exemplo dele, a foto DEITADA do trio vai nas opções A
    # e C, e a foto EM PÉ vai na opção B — que tem uma área alta e estreita ao lado da
    # coluna vermelha. Mandar uma foto deitada para a B deixa metade da peça vazia.
    recortadas.sort(key=proporcao, reverse=True)
    foto_principal = recortadas[0]   # a mais deitada: opções A e C
    foto_em_pe = recortadas[-1]      # a mais em pé: opção B

    saida = {}
    tratar = os.path.join(pasta_gerador, "tratar_foto.py")

    principal_bw = os.path.join(bands, ident + "_bw.png")
    executar([sys.executable, tratar, foto_principal, principal_bw])
    saida["photo"] = "bands/" + os.path.basename(principal_bw)

    if foto_em_pe != foto_principal:
        em_pe_bw = os.path.join(bands, ident + "_empe_bw.png")
        executar([sys.executable, tratar, foto_em_pe, em_pe_bw])
        saida["photoB"] = "bands/" + os.path.basename(em_pe_bw)

    if corpo_inteiro(foto_principal):
        crop = os.path.join(bands, ident + "_crop.png")
        executar([sys.executable, tratar, foto_principal, crop, "--crop", "0.66"])
        saida["photoC"] = "bands/" + os.path.basename(crop)
        avisos.append("foto de corpo inteiro: criada a versão cortada na cintura para A e C")

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
    resultado = preparar(entrada, gerador, ident)
    destino = None
    if "--json" in sys.argv:
        destino = sys.argv[sys.argv.index("--json") + 1]
    texto = json.dumps(resultado, ensure_ascii=False)
    if destino:
        with open(destino, "w", encoding="utf-8") as f:
            f.write(texto)
    print(texto)
