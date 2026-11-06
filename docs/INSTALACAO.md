# Instalação — o que depende de você

São três contas para ligar: **Google**, **GitHub** e **Instagram/Meta**. Nenhuma delas cobra
nada neste uso. Eu faço o resto.

Você não precisa entender o que está escrito aqui para usar o sistema depois — isto é só o
roteiro de ligar as coisas uma vez.

---

## Parte 1 — Google (o cérebro do sistema)

O Google vai hospedar o formulário, a planilha, as pastas, o painel e os gatilhos que rodam
sozinhos. É a parte que faz o sistema funcionar com o computador desligado.

### 1.1 Liberar o acesso do computador ao Apps Script

Abra **https://script.google.com/home/usersettings** e ligue a chave
**"API do Google Apps Script"**.

Isso é o que me permite criar o projeto e subir o código sem você ter que colar arquivo por
arquivo. Essa chave só vale para a sua própria conta e você pode desligar depois.

### 1.2 Autorizar uma vez

No terminal, rode:

```bash
npx --yes @google/clasp login
```

Vai abrir o navegador pedindo permissão. Entre com a conta Google **que você usa para o
Woodstock** (é nessa conta que as pastas e o formulário vão ficar) e autorize.

### 1.3 Feito

Instalado e verificado em 06/11/2026.

A partir daí eu crio o projeto, subo o código e publico o painel. Você só vai precisar clicar
uma vez em **Executar** dentro do editor do Apps Script e aceitar as permissões que ele pedir —
porque é a sua conta que vai criar as pastas, mexer na planilha e mandar os e-mails de aviso,
e o Google exige que você diga sim a isso pessoalmente.

Vai aparecer um aviso dizendo que **o app não foi verificado pelo Google**. É esperado: o "app"
é o seu próprio script, que só você usa. Clique em *Avançado* e depois em *Acessar (não seguro)*.

---

## Parte 2 — GitHub (a oficina das artes)

O GitHub é quem vai rodar o gerador de artes do kit e hospedar as imagens prontas num endereço
público — a Meta só aceita publicar imagem que ela consiga baixar de um endereço público.

### 2.1 Conta

Se você já tem conta no GitHub, me diga o nome de usuário. Se não tem, crie em
**https://github.com/signup** (é gratuito, não pede cartão).

### 2.2 Repositório

Precisa ser **público**. Dois motivos:

- repositório público tem tempo de execução ilimitado e gratuito; o privado tem teto de 2.000
  minutos por mês, e passar disso começaria a cobrar;
- a Meta precisa conseguir baixar a imagem.

**O que fica público:** só as artes finais, que vão para o Instagram de qualquer jeito, e o
código. **O que não fica:** as fotos cruas que as bandas enviam, o telefone delas, a planilha
e os acessos. Isso tudo fica no Drive e no Apps Script, privados.

### 2.3 Me avise

Eu crio o repositório, subo o código, ligo o GitHub Pages e configuro os segredos
(o endereço do painel e a senha da ponte entre os dois lados).

---

## Parte 3 — Instagram (a publicação)

Esta é a parte mais burocrática, e é onde ficam as exigências da própria Meta.

### 3.1 O que a Meta exige para publicar por fora do aplicativo

1. O **@woodstockrockbar** precisa ser conta **profissional** (Comercial ou Criador de
   conteúdo) — no aplicativo, em Configurações › Tipo de conta.
2. Precisa estar **vinculado a uma Página do Facebook** do bar. Se não existir, é só criar uma
   Página, não precisa de movimento nenhum nela.
3. Precisa existir um **app** criado em https://developers.facebook.com — é um cadastro de
   desenvolvedor, gratuito, que serve só para gerar a chave de acesso. Não vira produto, não
   aparece para ninguém, e não precisa passar por análise da Meta enquanto for usado apenas na
   sua própria conta.

### 3.2 O que eu preciso receber

Uma **chave de acesso de longa duração** (o token) e o **número da conta do Instagram**.
Eu te guio tela a tela para gerar os dois, e você me passa.

Essa chave vale 60 dias. O sistema renova sozinho todo dia enquanto ela está válida, então na
prática você gera uma vez só. Se algum dia a renovação falhar, você recebe um e-mail avisando.

### 3.3 Enquanto isso

O sistema já funciona sem essa parte, com a trava `PUBLICAR_DE_VERDADE` em `NAO`: recebe as
inscrições, produz as artes, escreve as legendas e cumpre o calendário inteiro — só não envia
para o Instagram, e marca cada publicação como SIMULADO. É assim que vamos testar sem sujar o
perfil real.

---

## O que continua sendo manual, e por quê

| O quê | Por quê |
|---|---|
| Convidar a banda como colaboradora do post ("Collab") | A Meta aceita o convite junto com a publicação em alguns casos, mas não garante. Quando não dá, o sistema publica normalmente e te manda um e-mail com o passo a passo de 20 segundos para fazer no aplicativo. |
| Juntar vários músicos de fotos diferentes numa foto só | O recorte de fundo é automático, mas montar uma foto de banda a partir de fotos separadas ainda é trabalho do ChatGPT, como no kit. Quando precisar, você sobe o PNG já pronto e o sistema usa direto, sem recortar de novo. |
| Figurinhas, enquetes e links nos stories | A API da Meta não publica nenhum desses recursos. Os stories saem como imagem. |

---

## Custo

Zero, em todos os pontos. Nenhum serviço usado aqui pede cartão de crédito, nenhum tem período
de teste que vira cobrança, e nenhum cobra por execução. Os limites gratuitos (90 minutos de
script por dia, minutos ilimitados no GitHub público, 100 publicações por dia no Instagram)
estão muito acima do que uma agenda semanal de bar consome.
