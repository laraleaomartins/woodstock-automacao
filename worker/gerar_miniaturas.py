# ============================================================================
# DESATIVADO EM 12/11/2026 — o sistema nao gera mais arte.
#
# O Woodstock virou um painel de coleta: a banda manda os dados e as fotos, e as
# artes sao feitas fora do sistema. Nada aqui foi apagado nem comentado — este
# arquivo continua inteiro e funcionando. O que mudou e que ninguem o chama: o
# agendamento da oficina saiu de .github/workflows/artes.yml e a chave
# MOTOR_DE_ARTES_LIGADO, em apps-script/00_Config.gs, esta em false.
#
# Por que nao foi apagado: isto custou dezenas de defeitos reais para ficar de pe —
# a memoria que o motor dos modelos nao devolve, o contorno cinza da mascara dura,
# a polaroide que cortava o artista, o grupo que flutuava enfileirado. Reescrever
# seria pagar tudo de novo. A decisao de fazer as artes por fora pode ser revertida.
#
# PARA RELIGAR: ver o cabecalho de .github/workflows/artes.yml.
# ============================================================================

"""
Gera as miniaturas que faltam ao lado das artes já publicadas.

A oficina passou a publicar uma versão reduzida de cada peça junto com ela, porque
é essa versão que entra no relatório em PDF. As artes feitas antes dessa mudança
não têm a sua, e o relatório cai na peça inteira: medido, um relatório mensal com
14 shows saiu com 20 MB, grande demais para abrir no celular.

Este programa percorre as artes publicadas e cria a miniatura de quem não tem.
Roda uma vez; daí em diante a oficina já as produz sozinha.

uso: python worker/gerar_miniaturas.py docs/artes
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from para_jpeg import miniatura  # noqa: E402


def main(pasta):
    feitas = 0
    pulos = 0
    total_kb = 0
    for raiz, _dirs, arquivos in os.walk(pasta):
        for nome in sorted(arquivos):
            if not nome.lower().endswith(".jpg") or nome.endswith("_mini.jpg"):
                continue
            cheia = os.path.join(raiz, nome)
            pequena = os.path.join(raiz, nome[:-4] + "_mini.jpg")
            if os.path.exists(pequena):
                pulos += 1
                continue
            bytes_mini = miniatura(cheia, pequena)
            feitas += 1
            total_kb += bytes_mini / 1024
            print("  %s  %d KB" % (nome[:-4] + "_mini.jpg", round(bytes_mini / 1024)))
    print("\n%d miniaturas criadas (%d KB no total), %d já existiam"
          % (feitas, round(total_kb), pulos))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "docs/artes")
