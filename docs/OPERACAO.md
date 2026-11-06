# Como usar no dia a dia

## O caminho normal

1. A banda preenche o formulário.
2. Você recebe um e-mail: *"Nova banda inscrita"*.
3. Em até 15 minutos chega outro: *"Artes prontas, esperando sua aprovação"*.
4. Você abre o painel, olha as 6 peças e clica em **Aprovar e agendar**.
5. O sistema publica sozinho, na hora certa, e registra o resultado.

Se você mudar o modo para **automático**, o passo 4 desaparece: as artes prontas já entram no
calendário.

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
