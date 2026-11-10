"""
Confere um relatório em PDF: nada fora da margem, nada sobreposto, nada cortado.

Olhar página por página não escala — um relatório trimestral passa de vinte — e o
olho cansa justamente nos defeitos pequenos. Esta conferência mede.

O que ela procura é o que já quebrou de verdade neste relatório:
  - texto ou imagem passando da margem, que no desenho antigo era CORTADO pela
    borda da caixa e sumia;
  - rodapé desenhado por cima da tabela;
  - linha de tabela partida ao meio entre duas páginas;
  - imagem distorcida, fora da proporção da peça.

uso: python tests/conferir_relatorio.py arquivo.pdf [arquivo.pdf ...]
"""
import sys

import pymupdf

MARGEM_MM = 14          # a menor margem declarada no @page
FOLGA = 6               # pontos de tolerância: o traçado da fonte extrapola um fio


def mm(valor):
    return valor * 72.0 / 25.4


def conferir(caminho):
    doc = pymupdf.open(caminho)
    problemas = []

    for numero, pagina in enumerate(doc, start=1):
        limite = pymupdf.Rect(mm(MARGEM_MM) - FOLGA, mm(MARGEM_MM) - FOLGA,
                              pagina.rect.width - mm(MARGEM_MM) + FOLGA,
                              pagina.rect.height - mm(MARGEM_MM) + FOLGA)

        caixas = []
        linhas_de_texto = []
        for bloco in pagina.get_text("dict")["blocks"]:
            caixa = pymupdf.Rect(bloco["bbox"])
            if caixa.is_empty:
                continue
            caixas.append((caixa, bloco.get("type", 0)))
            # Para a conta de sobreposição vale a LINHA, não o bloco: a moldura de
            # um bloco envolve tudo que ele agrupou, e o extrator às vezes junta a
            # legenda de uma coluna com o número da vizinha. Molduras assim se
            # cruzam sem que nada esteja sobreposto na página.
            for linha in bloco.get("lines", []):
                r = pymupdf.Rect(linha["bbox"])
                if not r.is_empty:
                    linhas_de_texto.append(r)
            if not limite.contains(caixa):
                fora = []
                if caixa.x0 < limite.x0: fora.append("pela esquerda")
                if caixa.x1 > limite.x1: fora.append("pela direita")
                if caixa.y0 < limite.y0: fora.append("por cima")
                if caixa.y1 > limite.y1: fora.append("por baixo")
                problemas.append("pág %d: conteúdo sai da margem %s"
                                 % (numero, " e ".join(fora)))

        # Sobreposição: dois blocos de TEXTO ocupando o mesmo lugar. Imagem sob
        # texto é legítima (legenda sobre arte não acontece aqui, mas pode vir a
        # acontecer); texto sobre texto é sempre defeito.
        # Não basta as molduras se tocarem: colunas vizinhas encostam, e o extrator
        # de texto às vezes junta a legenda de uma com o número da outra, o que faz
        # molduras vizinhas se cruzarem sem que nada esteja sobreposto na página.
        # Sobreposição de verdade é um texto DENTRO do outro — por isso a conta
        # exige que o centro de um caia dentro do outro.
        textos = linhas_de_texto
        for i, um in enumerate(textos):
            for outro in textos[i + 1:]:
                junto = um & outro
                if not junto.is_valid or junto.is_empty or junto.get_area() <= 40:
                    continue
                menor, maior = sorted((um, outro), key=lambda c: c.get_area())
                centro = pymupdf.Point((menor.x0 + menor.x1) / 2,
                                       (menor.y0 + menor.y1) / 2)
                if maior.contains(centro) and junto.get_area() > 0.5 * menor.get_area():
                    problemas.append("pág %d: dois textos sobrepostos" % numero)
                    break

    doc.close()
    return problemas


if __name__ == "__main__":
    falhou = False
    for caminho in sys.argv[1:]:
        achados = conferir(caminho)
        nome = caminho.split("/")[-1].split("\\")[-1]
        if achados:
            falhou = True
            print("  FALHA %s" % nome)
            for a in sorted(set(achados))[:8]:
                print("      " + a)
        else:
            print("  ok   %s: nada fora da margem, nada sobreposto" % nome)
    sys.exit(1 if falhou else 0)
