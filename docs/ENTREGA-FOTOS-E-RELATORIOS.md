# Relatório de entrega — fotos, edição de artes e relatórios em PDF

Fecha o pedido de 10/11/2026. Escrito para ser lido sem abrir código: cada defeito vem
com o que acontecia na tela, por que acontecia e o que passou a acontecer.

---

## 1. Os problemas que existiam

### 1.1 Não havia como consertar uma foto ruim

O tratamento automático acerta na maioria das fotos, mas não em todas. Quando errava
numa, não havia saída: ou a programação inteira ficava com o resultado ruim, ou a banda
tinha de preencher o formulário de novo. Pedir foto nova a quem já se inscreveu é o tipo
de atrito que faz a banda desistir de divulgar.

### 1.2 O painel dizia "deu erro", sem dizer onde

O recado de falha era um só para a programação toda. Com quatro fotos enviadas, quem
precisava consertar tinha de adivinhar qual era a culpada — e a mensagem que chegava era
literalmente `Command failed: python /home/runner/.../preparar_imagens.py`, que não diz
nada a quem não escreveu o programa.

### 1.3 A banda não sabia que foto mandar

Nada na tela de inscrição dizia o que faz uma foto render arte boa. Chegavam prints de
tela, foto de foto, gente de costas e imagens de 300 pixels. Nenhum tratamento
automático conserta uma pessoa que nem aparece.

### 1.4 O campo do couvert parecia já preenchido

Havia um `15` cinza dentro do campo, como exemplo de formato. Sugestão em cinza claro
dentro de um campo se confunde com valor digitado: a banda podia enviar pensando que o
preço do show era quinze reais.

### 1.5 Os relatórios em PDF saíam quebrados

Quatro defeitos somados, todos visíveis a olho:

- a tabela do resumo era **decepada** no fim da página, e as linhas seguintes
  simplesmente não existiam no documento;
- o rodapé ficava **por cima** das últimas linhas;
- a numeração de página estava **errada** (o conversor do Google não conta as páginas que
  ele mesmo cria ao quebrar o conteúdo);
- as miniaturas das artes saíam **desalinhadas**, cada uma com uma altura.

---

## 2. A causa dos defeitos dos PDFs

Uma causa só, e não quatro. O documento era montado com **altura fixa por folha** e
`overflow:hidden`, mais um rodapé posicionado de forma absoluta. Isso funciona na tela,
onde a folha é uma caixa. Não funciona no PDF, onde o conversor **reparte o conteúdo em
páginas por conta própria**: a altura fixa não acompanha a repartição, então o que não
cabia era escondido em vez de continuar na folha seguinte, e o rodapé — grudado na caixa,
não na página — caía no meio do texto.

A correção foi parar de desenhar folhas e passar a escrever um documento que **flui**:
quebra de página pedida antes de cada show (`page-break-before`), cabeçalho de tabela
repetido em cada página (`display:table-header-group`), linha que não se parte no meio
(`page-break-inside:avoid`), rodapé como último parágrafo do fluxo, e miniatura com
**altura fixa e largura livre** (`height:44mm;width:auto`), que alinha as seis peças pela
base sem distorcer nenhuma.

Um detalhe que também veio de medição e não de gosto: **a capa é clara**. O conversor do
Google escurece toda cor clara da página em cerca de um terço — branco `#ffffff` sai
`#ababab` —, provavelmente para que texto branco não desapareça em papel branco. Uma capa
escura, no modelo do documento de referência, saía ilegível. Não há como compensar,
porque não existe cor mais clara que o branco para pedir.

E os relatórios chegavam a **20 MB** porque embutiam as artes em tamanho cheio: as 66
artes antigas não tinham miniatura. Gerei as que faltavam (1.217 KB no total) e o
relatório mensal com 14 shows e 84 peças passou a ter **16 páginas e 1,8 MB**.

---

## 3. O que passou a existir

### Na tela de inscrição

- Quadro curto orientando sobre as fotos: pessoa inteira ou do peito para cima, fundo
  simples, luz na pessoa, nítida e grande — e o que atrapalha.
- Campo do couvert sem exemplo dentro; a explicação do formato ficou embaixo, onde é texto
  e não parece resposta.

### No painel, por foto

- Cada foto aparece, uma a uma, com prévia, nome do arquivo e um selo do que o tratamento
  fez com ela: **ok**, **duvidoso**, **erro** (com o motivo em português), **editada** ou
  **sem informação** (artes produzidas antes desta versão).
- **Baixar** a original em tamanho cheio, e **Baixar as fotos** para levar todas num
  `.zip`.
- **Substituir** pela sua versão editada, conferida no navegador antes de subir: PNG ou
  JPEG, mínimo de 600 pixels no lado menor, máximo de 15 MB, com prévia e confirmação.
- **Desfazer**, que volta a usar a foto da banda.
- **Histórico**, com data, hora e qual foto em cada troca.

A original **nunca** é apagada: as três versões convivem — a da banda, o resultado do
tratamento automático e a sua editada.

### A regra de prioridade

**Havendo versão editada, é ela que vai para a arte** — inclusive quando se clica em
Refazer. Produzir de novo não desfaz uma edição manual: seria jogar fora o trabalho de
quem editou justamente no momento em que o sistema tenta de novo porque errou antes.

Trocar uma foto **não refaz a arte sozinha**. Ao confirmar a troca, o painel pergunta se
quer refazer agora. A escolha é de quem opera por dois motivos concretos: trocando três
fotos, refazer a cada troca rodaria a produção três vezes, e cada uma leva cerca de três
minutos; e refazer **tira da fila as publicações já agendadas** daquela banda, o que não
pode acontecer em silêncio.

### O motivo da falha, legível

O erro que chega ao painel é agora a última linha útil do que o programa reclamou, sem o
prefixo técnico — "não consegui separar ninguém do fundo nesta foto" em vez de
`Command failed: python ...`.

---

## 4. Os arquivos alterados

| Arquivo | O que mudou |
| --- | --- |
| `apps-script/12_Fotos.gs` | **Novo.** Toda a gestão das fotos: listar com estado, baixar, substituir, desfazer, histórico, e a regra de prioridade da versão editada. |
| `apps-script/10_Painel.gs` | Fotos entram no carregamento do painel; relatório reescrito para fluir entre páginas. |
| `apps-script/07_Api.gs` | Cinco ações novas (`fotos`, `baixar_foto`, `substituir_foto`, `restaurar_foto`, `historico_fotos`) e a versão editada entrando na fila de produção. |
| `apps-script/06_Rotinas.gs` | O estado de cada foto é gravado quando as artes chegam. |
| `apps-script/Painel.html` | Galeria das fotos com os selos, as quatro ações, a janela de confirmação e a oferta de refazer. |
| `apps-script/Inscricao.html` | Orientação sobre as fotos; couvert sem exemplo dentro do campo. |
| `worker/produzir.mjs` | Captura o que o programa reclamou e manda o estado de cada foto junto com as artes. |
| `worker/preparar_imagens.py` | Anota, para cada foto, o que aconteceu e por quê. |
| `worker/para_jpeg.py`, `worker/gerar_miniaturas.py` | Miniatura de 260 px por arte; o segundo preencheu as 66 que faltavam. |
| `docs/OPERACAO.md` | As fotos no painel, a orientação da inscrição e o campo do couvert. |

---

## 5. O que mudou na forma de guardar os dados

Nada foi apagado e nenhuma coluna nova foi criada. A lista de arquivos recebidos, que já
era guardada em `Artes.recebidos`, passou a levar três informações por foto:

- `estado` — `ok`, `duvidoso` ou `erro`, o que o tratamento mediu;
- `motivo` — a explicação em português, quando há;
- `manual` — a versão editada, quando existe: identificador no Drive, nome e quando
  chegou.

As versões editadas ficam numa subpasta **`EDITADAS`** dentro da pasta da programação,
criada quando a primeira chega. As originais seguem onde sempre estiveram.

Programações produzidas antes desta versão não têm `estado`, e o painel mostra **sem
informação** em vez de inventar um resultado.

---

## 6. Os testes

| Bateria | Verificações | Resultado |
| --- | --- | --- |
| `tests/testar_cerebro.mjs` | 176 | passaram |
| `tests/testar_imagens.py` | 66 | passaram |
| `tests/testar_oficina.mjs` | 7 | passaram |
| `tests/conferir_relatorio.py` | margem, sobreposição e corte do PDF | sem corte, sem sobreposição |
| Cenários do pedido, **contra o sistema no ar** | 13 | passaram |

Os cenários pedidos foram exercitados no sistema publicado, pela mesma porta que o painel
usa — simulador prova a lógica, só a integração prova a entrega:

```
ok   o painel lista 3 foto(s)
ok   todas têm prévia para olhar
ok   a original veio: foto1.jpeg
ok   e veio inteira, com 1068 KB — não é miniatura
ok   a substituição foi aceita
ok   a foto 2 passou a usar a editada
ok   a original da foto 2 continua guardada
ok   e as outras não foram tocadas
ok   recusou o que não é imagem
ok   e a edição que existia continua lá
ok   o histórico registrou 1 mexida(s)
ok   a foto 2 voltou para a original
```

E a última ligação, medida numa produção real (execução 42914137449, programação
`28NOV_testeeeee`): o estado de cada foto chegou ao painel preenchido —

```
foto 1 · ok · recortei do fundo para montar a banda
foto 2 · ok · recortei do fundo para montar a banda
foto 3 · ok · recortei do fundo para montar a banda
```

---

## 7. O que ficou de fora, e por quê

- **O sistema não julga se a arte ficou bonita.** O selo diz o que a máquina mediu. Ela
  sabe dizer que não conseguiu separar alguém do fundo; não sabe dizer que a composição
  ficou feia. Um selo "ok" numa arte ruim é possível, e é por isso que a aprovação peça a
  peça continua sendo de quem opera.
- **Refazer não é automático depois da troca.** É oferecido na hora, com o aviso do que
  custa. O motivo está na seção 3.
- **Programações antigas não ganham estado retroativo.** Não há como saber o que o
  tratamento achou de uma foto processada antes de o sistema registrar isso — e inventar
  seria pior que admitir.
- **Repetir o refazer na mesma foto tem limite.** O tratamento é determinístico: a mesma
  foto produz sempre a mesma arte. Cada refazer tenta um caminho diferente (inverter a
  decisão de recortar, trocar o recortador, usar a foto inteira), e da quarta vez em
  diante volta ao começo. Quando os três caminhos falham, a saída é a foto editada à mão —
  que é justamente o que esta entrega passou a permitir.

---

## 8. Onde ver funcionando

No painel, abra qualquer programação e role até **Fotos da banda**. A programação
`28NOV_testeeeee` tem os três selos preenchidos pela produção real. Em
**Relatórios → Mensal** sai o PDF com a capa clara, a tabela que atravessa as páginas e as
miniaturas alinhadas.

Publicado na versão **42** do web app.
