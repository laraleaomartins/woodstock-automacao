# Como usar no dia a dia

## O caminho normal

1. A banda preenche o formulário.
2. Você recebe um e-mail: *"Nova banda inscrita"*.
3. Em até 15 minutos chega outro: *"Artes prontas, esperando sua aprovação"*.
4. Você abre o painel, olha as 6 peças e clica em **Aprovar e agendar**.
5. O sistema publica sozinho, na hora certa, e registra o resultado.

Se você mudar o modo para **automático**, o passo 4 desaparece: as artes prontas já entram no
calendário.

## O que a banda preenche

Além do nome, contato, data, horário, @ do Instagram, fotos e logotipo, a tela de
inscrição pede mais duas coisas — e orienta a banda sobre as fotos.

### Como a tela orienta sobre as fotos

Em cima do campo das fotos há um quadro curto explicando o que faz uma foto render
arte boa: **pessoa inteira ou do peito para cima**, **fundo simples** (parede lisa,
céu, palco escuro), **luz na pessoa**, **nítida e grande** — e o que atrapalha:
print de tela, foto de foto, muita gente atrás, filtro forte.

Isso não é enfeite. A maior parte dos problemas que chegavam ao painel era foto
ruim, e nenhum tratamento automático conserta uma pessoa que nem aparece.
Explicando na hora do envio, o problema é evitado em vez de remediado.

**O campo do couvert vem vazio, sem exemplo escrito dentro dele.** Havia um "15"
cinza ali, como sugestão de formato, e sugestão em cinza claro dentro do campo se
confunde com valor já preenchido — a banda podia enviar pensando que o preço do
show era aquele. A explicação do formato ficou embaixo do campo, onde é texto e não
parece resposta.

### O valor do couvert

A banda digita só o valor. Pode escrever do jeito que quiser — `15`, `R$ 15`,
`15,00`, `20.00` — que o sistema entende e escreve certo na arte.

**Deixando em branco, a arte sai sem couvert**, e a faixa de informação se
reorganiza sozinha, sem buraco. É o certo para show de entrada franca: antes o
valor estava escrito fixo como R$15 e a arte anunciava entrada paga em show que
podia ser de graça.

O mesmo valor vai para a arte **e para a legenda do post**. Os dois vêm do mesmo
lugar de propósito: escrito fixo em um dos dois, a peça diria um preço e o texto
diria outro — e quem lesse acreditaria na legenda.

### A publicação em colaboração

Marcando a opção, a banda escolhe até **três perfis** que vão aparecer como autores
da publicação junto com o bar. O @ da banda já vem preenchido no primeiro campo,
que é o caso mais comum; ela pode trocar ou acrescentar, por exemplo o perfil de um
integrante.

Três limites são do Instagram, não do sistema, e estão escritos na própria tela
para a banda ler antes de marcar:

- **Story não aceita colaboração.** Vale só para a publicação de feed; os stories
  saem normais.
- **O perfil convidado precisa aceitar.** O Instagram manda um convite, e a
  colaboração só aparece publicamente depois que a banda aceita pelo aplicativo
  dela. Publicar com sucesso não quer dizer que a colaboração já está no ar.
- **Só perfil aberto pode ser marcado.** Banda com perfil fechado não entra.

Se a API recusar um convite, o sistema **publica assim mesmo, sem a colaboração**, e
manda um aviso para você fazer à mão — perder a publicação por causa de um convite
recusado seria pior.

## O painel

É um endereço só, que abre no celular também. O link completo (com a chave no fim) chega no
e-mail de instalação — guarde como favorito.

- **Programações** — cada banda inscrita, as artes, as legendas e os botões de aprovar,
  reprovar, pausar, cancelar, refazer, mudar data/hora e trocar o modo daquela programação.
- **Calendário** — tudo que está na fila, o que já saiu e o que falhou; dá para tirar uma peça
  específica da fila.
- **Configurações** — antecedência, intervalos, janela de horário, ligar/desligar feed e
  stories, modo de operação e a trava de publicação. Nada disso exige mexer em código.
- **Histórico** — o que aconteceu, em ordem, com os erros.

A lista vem em **ordem de inscrição**, a mais nova no topo — não por data do show.
É a ordem de quem trabalha no painel: o que acabou de entrar é o que precisa de
atenção. Cada cartão mostra quando a banda se inscreveu.

### Os três filtros

São independentes e podem ser usados sozinhos ou juntos: **banda ou artista**,
**data da inscrição** e **data do show**. Cada um fica na sua caixa, com o nome em
cima e um "×" que limpa só ele. Usados juntos, eles cruzam — "banda X **e** que
toca em dezembro".

### Aprovar peça a peça

Esperando aprovação, cada arte ganha uma marca "publicar" no próprio canto da
imagem. Todas vêm marcadas; desmarque a que não ficou boa e clique em **Aprovar as
marcadas**. Só as marcadas entram no calendário, e o que ficou de fora é registrado
na programação e no e-mail.

Antes isso era tudo ou nada: uma arte torta derrubava as outras cinco junto.

### Refazer

Há um **Refazer** embaixo de cada arte e um **Refazer todas**.

Uma coisa importante sobre esse botão: **repetir não adianta**. O recorte é
determinístico — a mesma foto produz sempre a mesma arte. Por isso cada pedido de
refazer tenta um **caminho diferente**, nesta ordem:

1. inverter a decisão de recortar (o erro mais comum: fundo que parecia neutro e
   não era, ou o contrário);
2. recortar com outro recortador, que erra de forma diferente;
3. usar a foto inteira, dissolvida, sem tentar recortar.

Da quarta vez em diante volta ao começo: já se esgotou o que dá para variar sem
inventar.

As seis peças são refeitas juntas, mesmo pedindo por uma só — elas saem do mesmo
tratamento das fotos, e não existe refazer uma sem refazer o tratamento. O painel
avisa isso antes de confirmar.

### As legendas

Para cada show o sistema escreve **três legendas**, uma por layout. Cada uma tem a
mesma estrutura: frase de abertura, dados do show (data, dia, bar abre, horário,
couvert, endereço), chamada para ação e hashtags. Tudo vem da inscrição — o sistema
não inventa preço, promoção nem atração que não foi informada.

A legenda acompanha a **publicação de feed** daquele layout. **Story não leva
legenda**: o Instagram não aceita texto em story por esse caminho. Das seis peças,
três levam legenda e três não.

Em **Ver legendas** dá para **reescrever** qualquer uma e salvar. Se as publicações
já estiverem na fila, o texto delas é trocado junto — guardar só na programação
faria o painel mostrar o texto novo e o Instagram receber o antigo, que é o pior
tipo de erro, porque parece ter funcionado. Publicação que já saiu não é mexida:
ali o texto já está no ar.

As frases de abertura **variam de show para show**. Houve um período em que não
variavam: as nove frases estavam escritas, mas a escolha usava o número do layout,
então toda banda saía com as mesmas três, semana após semana, só trocando o nome.
A escolha agora parte do identificador da programação — e é estável, para que
refazer uma arte não troque o texto das outras sem ninguém pedir.

### Baixar todas

Um botão por banda junta as seis peças num `.zip`. As artes vêm do endereço
público — o mesmo arquivo que o Instagram recebeu —, e não da cópia no Drive, que
pode ter falhado sem ninguém notar.

### As fotos da banda, no painel

Cada programação mostra as fotos que a banda enviou, uma por uma, com o nome do
arquivo e um selo dizendo o que o tratamento automático fez com ela:

- **ok** — separou a pessoa do fundo (ou usou a foto inteira, quando o fundo já
  combinava) sem encontrar problema;
- **duvidoso** — conseguiu, mas desconfiando: as medidas ficaram no limite, e vale
  olhar a arte antes de aprovar;
- **erro** — não conseguiu usar esta foto, e o motivo vem escrito ao lado;
- **editada** — está valendo uma versão que você mandou, não a da banda;
- **sem informação** — a arte foi produzida antes de o sistema passar a registrar
  isso (programações de novembro de 2026 para trás).

O selo diz o que a **máquina mediu**, não o que uma pessoa achou. O sistema sabe
dizer que não conseguiu separar alguém do fundo; não sabe dizer que a arte ficou
feia. Para isso existem os olhos de quem aprova.

Três ações por foto:

- **Baixar** traz a original em tamanho cheio, do jeito que a banda enviou (e
  **Baixar as fotos** junta todas num `.zip`);
- **Substituir** manda a sua versão editada no lugar. O navegador confere o arquivo
  antes de subir: precisa ser PNG ou JPEG, ter no mínimo 600 pixels no lado menor e
  no máximo 15 MB — assim o erro aparece na hora, e não depois da espera. Você vê a
  imagem e confirma antes de valer;
- **Desfazer** volta a usar a foto da banda.

**A original nunca é apagada.** As três versões convivem: a que a banda enviou, o
resultado do tratamento automático (refeito a cada produção) e a sua editada. E a
regra de prioridade é uma só: **havendo editada, é ela que vai para a arte** —
inclusive quando você clica em Refazer. Produzir de novo não desfaz uma edição
manual; seria jogar fora o seu trabalho justamente quando o sistema está tentando
de novo porque errou antes.

Trocar uma foto **não refaz a arte sozinha**. Ao confirmar a troca o painel
pergunta se quer refazer agora, e a escolha é sua por dois motivos concretos:
trocando três fotos, refazer a cada troca rodaria a produção três vezes, e cada uma
leva uns três minutos; e refazer **tira da fila as publicações já agendadas**
daquela banda, o que não pode acontecer em silêncio. Trocando várias, troque todas
e refaça uma vez só.

**Histórico das fotos** registra cada troca e cada desfazer, com data, hora e qual
foto — para quando a dúvida for "que imagem está valendo aqui, afinal".

### Relatórios em PDF

**Semanal**, **mensal** e **trimestral**, no desenho da prestação de contas da
casa: capa com a marca e os números, resumo com a tabela do que foi entregue, e uma
página por show com as peças em miniatura e o que aconteceu com cada publicação.

O período é o do **calendário corrente** — a semana de segunda a domingo, o mês do
dia 1 ao último, o trimestre inteiro —, e não "os últimos N dias". A diferença
importa: a agenda de uma casa de show é feita para a frente, e contando para trás
um relatório tirado no dia 10 não encontra os shows do dia 15 e sai vazio.

Medido: um relatório mensal com 14 shows e 84 peças tem 16 páginas e 1,8 MB.

**A capa é clara, e não escura como o documento que serviu de modelo.** Não é
escolha de gosto: o conversor de PDF do Google escurece toda cor clara da página em
cerca de um terço — branco sai cinza-chumbo, vermelho claro sai marrom —,
provavelmente para que texto branco não suma em papel branco. Não há como
compensar, porque não existe cor mais clara que o branco para pedir.

## A trava de segurança

`PUBLICAR_DE_VERDADE` começa em **NAO**. Com ela assim, o sistema faz tudo menos enviar para o
Instagram, e cada publicação fica marcada como SIMULADO. É o modo de teste.

Quando estiver confiante, mude para **SIM** em Configurações. A partir daí ele publica de
verdade.

## As configurações, em português

| Configuração | O que muda na prática |
|---|---|
| `MODO_OPERACAO` | `APROVACAO` espera seu clique; `AUTOMATICO` publica sozinho. |
| `ANTECEDENCIA_DIAS` | Quantos dias antes do show a divulgação começa. Começa em 2. |
| `INTERVALO_FEED_HORAS` | Distância entre um post de feed e o próximo. Começa em 5. |
| `INTERVALO_STORIES_HORAS` | O mesmo, para os stories. Conta separado do feed. |
| `HORARIO_INICIAL` / `HORARIO_LIMITE` | A janela do dia em que o sistema pode publicar. |
| `FEED_ATIVO` / `STORIES_ATIVO` | Desligue um canal e ele para de ser agendado. |
| `NAO_PUBLICAR_APOS_SHOW` | Com SIM, nada sai depois da hora em que o show começa. |
| `CONVITE_COLAB` | Tentar convidar a banda como colaboradora do post de feed. |
| `MAX_TENTATIVAS` | Quantas vezes insistir quando uma publicação falha. |

Mudança de intervalo vale para as **próximas** programações. Para aplicar numa que já está
agendada, use **Recalcular horários** no cartão dela.

## Quando algo dá errado

Você recebe e-mail em todos os casos abaixo, e tudo fica registrado no Histórico.

| E-mail | O que aconteceu | O que fazer |
|---|---|---|
| *Resposta do formulário com problema* | Faltou foto, data no passado, telefone incompleto | Pedir o reenvio à banda |
| *Não consegui produzir as artes* | Foto ruim, arquivo que não é imagem | **Produzir de novo** no painel, ou subir uma foto melhor na pasta do Drive |
| *Uma publicação falhou* | A Meta recusou | A arte está pronta; dá para publicar à mão. Costuma ser token vencido |
| *O acesso ao Instagram precisa ser renovado* | A renovação automática falhou | Me chamar para gerar um acesso novo |
| *Convide a banda como colaboradora* | O Collab não entrou automático | 20 segundos no aplicativo, o e-mail traz o passo a passo |

## Manutenção

Quase nenhuma. O que existe:

- **A cada 60 dias, nada.** O acesso ao Instagram se renova sozinho todo dia de madrugada.
  Só se receber o e-mail de falha é que precisa de ação.
- **De vez em quando**, olhar o espaço do Drive. Cada programação ocupa poucos megabytes;
  os 15 GB gratuitos levam anos para encher.
- **Se mudar o endereço do bar, o couvert ou o horário de abertura**: esses dados estão dentro
  do gerador do kit (`gerador/render3.js`) porque fazem parte do desenho das peças. Me chame.

## Os arquivos no Drive

```
WOODSTOCK-ARTES/
├── CONFIGURACOES/
│   ├── MATERIAIS-ORIGINAIS/
│   └── AGENDAMENTO/
├── PROGRAMACOES/
│   └── 14NOV_os-bossais/
│       ├── RECEBIDOS/        as fotos e a logo como a banda enviou
│       ├── ARTES-FEED/       as 3 peças de feed
│       ├── ARTES-STORIES/    as 3 peças de story
│       ├── LEGENDAS/         as 3 legendas em texto
│       └── AGENDAMENTOS/     o calendário daquela programação
└── LOGS/
```

Os originais nunca são apagados nem alterados.

## Por que o formulário não é o Google Forms

A conta Google do Woodstock é pessoal, não é Workspace. Nela o Google **não deixa criar campo
de envio de arquivo** no Forms — e, mesmo onde deixa, obriga quem responde a ter conta Google e
estar logado para anexar. Isso barraria bandas.

A página de inscrição foi feita dentro do próprio sistema. Ela aceita anexo de qualquer pessoa,
sem login, encolhe as fotos no navegador antes de enviar (foto de celular tem 6000 pixels; a arte
final tem 1080) e cai direto na mesma esteira. Custo zero, igual.

O formulário do Google chegou a ser criado na instalação e **não deve ser usado** — ele não tem
os campos de foto. Pode apagar.

## O acesso ao Instagram

Conectado pelo "login unificado" da Meta, que **não exige Página do Facebook** — o ativo
ligado é a própria conta do Instagram.

O acesso é um token de usuário do sistema e **não tem validade**: não vence em 60 dias e não
precisa ser renovado. A rotina diária deixou de renovar e passou a só conferir se ele continua
valendo, avisando por e-mail se alguém revogar.

A única forma de ele parar é alguém remover o aplicativo em Instagram → Configurações →
Aplicativos e sites. Se isso acontecer, você recebe o aviso e geramos outro.

Peças da conexão, para referência:

| O quê | Valor |
|---|---|
| Aplicativo na Meta | Woodstock Agenda (1519690439993683) |
| Portfólio empresarial | Woodstock Rock Bar (4019848544991728) |
| Conta conectada no teste | @laritaleao |

Para trocar para o perfil do bar: adicione `woodstockrockbar` como Testador do Instagram no
aplicativo, aceite o convite pelo perfil do bar, gere um token novo e me passe junto com o
número da conta.

## Dois defeitos encontrados no teste de publicação real

Valem registro porque os dois só apareceram rodando de verdade, e os dois têm teste
automático agora.

**O horário virava 23:18.** A planilha converte `08:00` num valor de hora e devolve ao
sistema um objeto de data de 1899. Virando texto, isso dava
`Sat Dec 30 1899 08:00:00...`, e o leitor de horário pegava os primeiros números que via —
o 30 do dia e o 18 de 1899. Resultado: início e limite iguais, posts de 24 em 24 horas e
a terceira peça caindo fora por passar do show. Corrigido em três camadas: a leitura
reconhece a data, a gravação força texto puro, e o leitor de horário ignora números de
data.

**Peças com identificador repetido.** Ao recalcular, as publicações novas nasciam com o
mesmo identificador das antigas. Cancelar ou adiantar acertava a linha errada, e a mesma
arte poderia ir ao ar duas vezes. Agora o identificador é único (vira `_r2`, `_r3`) e as
buscas preferem a linha ativa.

## O que o sistema confere sozinho antes de entregar uma arte

Você não precisa revisar peça por peça. Estas conferências rodam a cada produção e,
quando reprovam, a programação **não vira arte nem publicação** — você recebe e-mail
dizendo o motivo.

| Conferência | Reprova quando | Por que existe |
|---|---|---|
| Recorte da logo | mais de 15% do desenho vira vazado | logo com letra branca sobre fundo claro perdia as letras |
| Logo apagada | sobra menos de 2% do desenho | modo de recorte errado zerava a imagem |
| Foto vazia | menos de 4% da imagem aparece | arquivo em branco virava arte em branco |
| Foto sem recorte | o recorte sai sem transparência | foto que o recortador não entendeu |
| Nenhuma foto aproveitável | todas as fotos falharam | não produz peça quebrada |

E estas **avisam** sem reprovar, aparecendo em amarelo no cartão do painel:

- os dois recortadores discordaram entre 12% e 40% da foto (juntei o que cada um achou);
- discordaram mais de 40% (usei só o melhor; confira se não falta alguém);
- a logo ficou com algum vazado entre 5% e 15%;
- a foto já veio recortada e foi usada direto.

Além disso, a borda de todo recorte é **encolhida um fio e esfumada**, para a foto não
entrar na arte com contorno claro nem com corte de tesoura.
