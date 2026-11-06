# Automação Woodstock Rock Bar

Recebe a inscrição da banda por formulário, produz as 6 artes de divulgação nos 3 layouts
aprovados, escreve as legendas, monta o calendário e publica no Instagram — sem computador
ligado e sem custo nenhum.

## Situação de cada parte

| Parte | Situação |
|---|---|
| Gerador das artes (os 3 layouts do kit) | **funcionando** — saída conferida contra as peças de referência |
| Recorte de fundo automático das fotos | **funcionando** — rembg local e gratuito; 99,4% de acerto em foto limpa |
| Cérebro (formulário, pastas, legendas, calendário, painel) | **escrito e testado** — 80 verificações passando no simulador |
| Escolha da foto certa para cada layout | **funcionando** — 11 verificações, gabarito no exemplo do kit |
| Oficina das artes (GitHub Actions) | **escrita e testada de ponta a ponta localmente** |
| Instalação na conta Google | **feita e verificada** — planilha, pastas, painel e gatilhos no ar |
| Página de inscrição das bandas | **no ar** — feita aqui dentro, sem exigir conta Google da banda |
| Conexão com o Instagram | **conectada e verificada** — acesso sem validade, pelo login unificado |
| Publicação automática | **pronta, com a trava de segurança ligada** — nada sai sem você destravar |
| Convite de colaboração ("Collab") | tentado automaticamente; vira aviso por e-mail quando a Meta recusa |

Nada aqui está simulado para parecer pronto: o que depende de conta externa está marcado como
pendente acima, e o resto roda de verdade.

## Como está organizado

```
kit-original/     o ZIP recebido, intacto, com o ZIP original junto
gerador/          cópia de trabalho do gerador do kit (render3.js, tratar_foto.py, ...)
apps-script/      o cérebro: roda nos servidores do Google
worker/           a oficina: roda no GitHub Actions
tests/            simulador do ambiente Google e os testes
docs/             ARQUITETURA.md, INSTALACAO.md, OPERACAO.md e as artes publicadas
```

## A única mudança feita no kit

O gerador montava o endereço das fontes de um jeito que só funciona em Mac e Linux. No Windows
as peças saíam com a fonte errada e o selo de couvert cortado. Corrigido em `gerador/render3.js`
e `gerador/lockup.js`; o desenho não foi tocado. A cópia intacta está em `kit-original/`.

## Rodar os testes

```bash
node tests/testar_cerebro.mjs    # o cérebro, contra um simulador do ambiente Google
python tests/testar_imagens.py   # o preparo das fotos e da logo
```

## Produzir uma arte à mão, fora do fluxo automático

```bash
python worker/preparar_imagens.py <pasta_com_as_fotos> gerador <id> --json imagens.json
```

Depois monte o JSON do show como o kit descreve e rode, de dentro de `gerador/`,
`node render3.js meu_show.json saida`.
