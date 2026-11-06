# Arquitetura — Automação Woodstock

## Como o sistema se divide

Duas metades, porque nenhuma das duas sozinha dá conta — e as duas são gratuitas.

**Google Apps Script** é o cérebro. Fica hospedado nos servidores do Google, roda sozinho com o
computador desligado, e faz: receber o formulário, criar as pastas no Drive, escrever as legendas,
calcular o calendário de publicação, publicar no Instagram, mandar os e-mails de aviso e servir o
painel. Tudo isso ele consegue fazer.

**GitHub Actions** é a oficina das artes. O Apps Script *não* consegue rodar o gerador do kit
(`render3.js` precisa de Node + um navegador sem tela, e o recorte de fundo precisa de Python com
um modelo de IA local). O GitHub Actions roda isso de graça, a cada 15 minutos, também sem
computador ligado.

## Quem faz o quê

| Peça | Serviço | Custo | Limite relevante |
|---|---|---|---|
| Formulário das bandas | Google Forms | R$0 | upload exige login Google (ver limitação) |
| Banco de dados | Google Sheets | R$0 | 10 milhões de células |
| Arquivos | Google Drive | R$0 | 15 GB da conta |
| Cérebro, gatilhos, painel, e-mails, publicação | Google Apps Script | R$0 | 90 min de execução/dia, 20 mil chamadas externas/dia |
| Produção das artes | GitHub Actions (repositório público) | R$0 | minutos ilimitados em repositório público |
| Endereço público das artes | GitHub Pages | R$0 | 1 GB, 100 GB de tráfego/mês |
| Publicar no Instagram | Instagram Graph API | R$0 | 100 publicações por conta a cada 24h |
| Recorte de fundo das fotos | rembg (modelo u2net, roda local) | R$0 | licença MIT, sem API, sem crédito |

Nenhum item pede cartão de crédito e nenhum vira pago depois.

## O caminho de uma programação

1. A banda preenche o formulário. Resposta cai na planilha, fotos e logo caem no Drive.
2. O gatilho do Apps Script dispara na hora (roda no Google, sem PC): valida os campos, cria a pasta
   `PROGRAMACOES/DDMES_BANDA/`, guarda os arquivos em `RECEBIDOS/`, cria um identificador único,
   escreve a linha na planilha com situação `AGUARDANDO_ARTES` e avisa por e-mail.
3. A cada 15 minutos o GitHub Actions pergunta ao Apps Script se há programação esperando arte.
   Havendo: baixa as fotos, recorta o fundo com o rembg, trata em preto e branco com o
   `tratar_foto.py` do kit, roda o `render3.js` do kit e produz as 6 peças (A, B e C, em feed e
   story). Converte para JPEG — a API da Meta só aceita JPEG — publica os arquivos no GitHub Pages
   (que é o endereço público que a Meta exige) e devolve tudo ao Apps Script, que guarda cópia no
   Drive.
4. O Apps Script escreve as legendas e monta o calendário: começa 2 dias antes do show, respeita o
   intervalo entre posts e nunca passa do horário do show.
5. No modo com aprovação, para aqui e espera o clique no painel. No modo automático, já agenda.
6. A cada 15 minutos o Apps Script publica o que venceu e registra o resultado real devolvido pelo
   Instagram.

## Decisões e o porquê

**Por que o gerador do kit, e não uma IA de imagem.** O kit já traz os 3 layouts aprovados prontos
em código. Ele é determinístico: a mesma entrada dá sempre a mesma peça, idêntica às de referência.
Pedir a uma IA para "desenhar igual" seria mais caro, mais frágil e mudaria a identidade visual.

**Por que rembg no lugar do ChatGPT.** O passo 2 do prompt original manda recortar o fundo da foto
no ChatGPT, à mão. Isso não automatiza: depende de navegador aberto e de uma conta logada. O rembg
faz o mesmo recorte, de graça, sem API e sem computador ligado. O caminho do ChatGPT continua
descrito e disponível para os casos que o rembg não resolve (juntar vários músicos de fotos
diferentes numa foto só, por exemplo) — nesses casos a pessoa sobe o PNG já recortado e o sistema
usa direto.

**Por que repositório público no GitHub.** Duas razões: minutos de execução ilimitados (repositório
privado teria teto de 2.000 min/mês, com risco de cobrança ao estourar) e porque a Meta exige que a
imagem esteja num endereço público para conseguir baixá-la. Só as artes finais ficam públicas — e
elas vão para o Instagram de qualquer jeito. As fotos cruas enviadas pelas bandas ficam só no Drive,
privadas.

**Por que a publicação sai do Apps Script e não do GitHub.** O token do Instagram fica guardado nas
propriedades do projeto Apps Script, que não aparecem em log nem em repositório público.
