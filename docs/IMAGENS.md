# O tratamento das imagens

Como as fotos que as bandas mandam viram as artes publicadas.

Este documento existe por um motivo prático: **o tratamento precisa sair certo
sozinho**. Pedir ajuste manual a cada arte não é uma opção. Se uma arte sai ruim, o
conserto é uma regra nova aqui dentro, com um teste que impeça o defeito de voltar
— nunca um retoque naquela arte.

---

## 1. A regra que manda em tudo

A foto tem de ficar **harmônica com o layout**. Não "aceitável": harmônica — como
se tivesse sido feita para aquela peça.

Disso saem três proibições, e elas valem sempre:

- **Nunca uma fotografia retangular parada dentro da arte.** Nas peças A e B não
  existe moldura: ali a foto não pode ter borda, canto nem aresta.
- **Nunca um recorte com cara de adesivo.** Recorte que termina de uma vez, num
  contorno, denuncia a colagem. O corpo tem de escurecer e se confundir com o fundo.
- **Nunca uma pessoa boiando num espaço vazio.** O que aparece tem de ocupar o vão
  de forma distribuída, com o rosto longe de onde o logotipo é escrito.

---

## 2. Recortar ou não: o sistema decide sozinho

Recorte não é um bem em si. Ele serve para **separar** a pessoa do que está atrás.
Se não há o que separar, recortar só piora: gasta minutos, arrisca comer um pedaço
de quem está na foto, e troca um fundo que já combinava com a arte por uma silhueta
com cara de adesivo.

A maioria das fotos que uma banda manda é de estúdio — parede lisa, fundo de papel,
degradê. Medido no acervo do projeto: **cinco de sete fotos** estavam nesse caso.
Essas entram inteiras.

**Recorta-se em dois casos, e só neles:**

1. quando a inscrição traz integrantes em fotos separadas para montar uma banda só.
   Aí separar é obrigatório: sem tirar o fundo de cada um, as pessoas não encaixam
   lado a lado;
2. quando o fundo atrapalha de verdade — palco com plateia, equipamento à mostra,
   luz quebrada.

### Como o sistema lê o fundo

A conta é feita nos **cantos** da foto, que é onde o fundo costuma aparecer
sozinho, e usa dois sinais, porque nenhum deles sozinho separa:

- **rugosidade** — o quanto a imagem muda de um pixel para o vizinho. Parede e
  degradê quase não mudam de perto, mesmo variando muito de um lado ao outro;
  plateia, instrumento e refletor mudam muito;
- **diferença de tom entre os cantos** — num fundo neutro os quatro cantos são
  parecidos; num palco, um canto tem refletor e o outro é breu.

Os dois cantos mais calmos é que mandam na rugosidade: assim, uma pessoa que invada
um canto da foto não faz o fundo inteiro parecer bagunçado.

Medido nas fotos reais do acervo:

| foto | rugosidade | dif. de tom | decisão | confere? |
|---|---|---|---|---|
| estúdio com degradê azul | 0,74 | 33 | não recorta | sim |
| parede lisa | 2,08 | 60 | não recorta | sim |
| degradê roxo de estúdio | 0,55 | 61 | não recorta | sim |
| fundo claro, mesa | 0,48 | 32 | não recorta | sim |
| palco com gente atrás | 1,13 | 115 | recorta | sim |
| palco com amplificador | 2,81 | 67 | recorta | sim |

Acertou as sete. **Mas a margem é estreita** — 60 contra 67 no tom, 2,08 contra
2,81 na rugosidade — e calibrar um limite em sete fotos é pouco. Por isso existe a
rede de segurança da seção 6.

---

## 3. Como a foto entra em cada peça

As três peças do kit são coisas diferentes, e tratá-las igual foi o erro que
produziu a "foto quadrada dentro do quadro".

| peça | o que é | espaço | como a foto entra |
|---|---|---|---|
| A | tarja rasgada, foto solta sobre o fundo preto | 1080 × 840 | sem moldura |
| B | caixa com meio-tom, ao lado da coluna vermelha | 830 × 1050 | sem moldura |
| C | a polaroide inclinada, com borda branca e fita | 816 × 640 | **é uma moldura** |

**Nas peças A e B não existe moldura.** A foto cai direto sobre o fundo da arte.
Então:
- se foi recortada, a pessoa aparece sobre o fundo da peça, com folga escura em
  volta — é assim nas referências do kit;
- se não foi recortada, a foto preenche o espaço e vai **escurecendo e sumindo** do
  assunto para fora, num degradê oval. O fundo de estúdio vira o fundo da arte e
  não sobra aresta nenhuma.

O degradê faz duas coisas somadas, e as duas são necessárias: escurecer sozinho
deixaria um retângulo cinza-escuro — o quadrado continua lá, só que discreto;
apagar sozinho deixaria a foto virar fantasma translúcido, e dá para ver a forma
sumindo. Escurecendo e apagando junto, a foto vira o próprio fundo. O centro do
degradê é **quem está na foto**, não o meio do arquivo: numa foto em que a pessoa
está de lado, escurecer a partir do meio comeria metade dela.

**A peça C é uma moldura de verdade.** O lugar é feito para receber uma fotografia,
e a referência do kit mostra a banda preenchendo a polaroide de ponta a ponta. Ali
a foto entra cheia e limpa; esfumar as bordas dentro de um porta-retrato pareceria
mancha.

### Por que a forma da imagem importa tanto

O gerador posiciona a foto com a altura travada no tamanho do espaço e o encaixe
pelo rodapé. Traduzindo: se a foto for mais **deitada** que o vão, o navegador
encolhe a foto inteira até a largura caber — e, encaixando pelo rodapé, a banda
desce e vai parar justamente onde o logotipo é escrito.

Era por isso que "a pessoa ficou baixa, tampada pela logo" voltava por mais que se
mexesse no recorte: **o problema não era o recorte, era a forma da imagem entregue
ao layout**. A foto é entregue já na forma do vão, e aí não há o que encolher.

### O enquadramento é pelo corpo, não pelo topo

Houve uma versão que encostava a foto no topo do recorte, com o raciocínio de que
"o que não pode faltar é a cabeça". Está errado: o ponto mais alto do recorte nem
sempre é a cabeça. Quem segura a guitarra erguida tem a cravelha como ponto mais
alto — e ancorar ali enquadrou o instrumento e **cortou o rosto fora**.

Agora o enquadramento é pelo centro de massa da silhueta: ombro, tronco e braço são
largos e puxam o quadro para onde a pessoa está; guitarra, microfone e baqueta são
finos e quase não pesam, e deixam de mandar no enquadramento.

---

## 4. Quando recorta, o recorte tem de casar com o fundo

### O recorte em si: matting, não máscara dura

Uma **máscara dura** decide, pixel a pixel, se aquilo é pessoa ou é fundo. Fio de
cabelo e corda de guitarra são mais finos que um pixel e deixam o fundo aparecer
através deles: na decisão de sim ou não, ou somem, ou vêm com um naco do fundo
colado em volta. Sobre o preto da arte, esse naco aparece como contorno claro — foi
o "contorno cinza" das primeiras artes.

O **matting** mede *o quanto* de cada pixel é pessoa. A borda deixa de ser um
degrau e vira transição. Medido na foto mais difícil do acervo:

| modo | pixels de borda em transição | tempo |
|---|---|---|
| máscara dura | 0 | 62 s |
| só descontaminação | 0 | 45 s |
| matting + descontaminação | 37.526 | 91 s |

Esses 37 mil pixels são os fios de cabelo e as cordas que antes eram jogados fora.

### E depois, emergir do escuro

Recorte com opacidade igual de cima a baixo tem sempre um ar de adesivo: a pessoa
acaba, de uma vez, num contorno. Nas referências do kit não é assim — o corpo vai
escurecendo até se confundir com o fundo, e o olho não encontra onde a foto termina.

Então o rodapé da figura primeiro **escurece**, virando sombra, e só depois a
opacidade some. São duas coisas, não uma: só apagar a opacidade deixa a silhueta
visível sumindo, e isso ainda denuncia.

### O corte reto

Quando a foto original já vinha cortada na cintura, o recorte termina numa linha
reta e horizontal: o tronco não acaba, é interrompido. Sobre o fundo da arte é o
que mais denuncia colagem. Esse corte agora se dissolve.

Pé de pessoa em pé **não** é confundido com corte reto: a conta olha o quanto da
silhueta chega à última linha — corpo cortado chega quase inteiro, pé chega pouco.

---

## 5. Fotos separadas viram uma banda

Quando a inscrição traz um integrante por foto, o trabalho não é enfileirar: é
fazer as fotos **conversarem**, para o resultado parecer uma banda e não três
retratos colados lado a lado. Três coisas fazem essa diferença:

1. **Tamanho da pessoa, não do arquivo.** Antes todas as fotos ficavam com a mesma
   altura — então quem mandasse foto de perto virava gigante ao lado de quem mandou
   de corpo inteiro, com a cabeça do dobro do tamanho. Agora todos ficam com o
   **tronco da mesma largura**, que é o que o olho confere. A medida é tirada entre
   o pescoço e a cintura, onde a silhueta é estável; cabeça e pernas variam demais
   com pose e instrumento.
2. **Mesma luz.** Fotos tiradas em noites diferentes chegam com luzes diferentes, e
   lado a lado quem veio do escuro parece uma sombra entre duas pessoas. O brilho de
   cada um é puxado para o mesmo ponto, por multiplicação — que mantém o contraste
   em vez de achatar a foto. O ajuste é limitado de propósito: foto muito escura,
   forçada até o alvo, viraria uma mancha cinza sem preto nenhum.
3. **Cabeças na mesma linha, ombros se encostando.** O alinhamento é pela cabeça,
   não pelos pés. Em foto de banda as cabeças ficam mais ou menos na mesma altura,
   porque as pessoas têm mais ou menos a mesma altura; o que varia é onde a foto foi
   cortada. Alinhar pelos pés faria o enquadramento de cada foto virar altura de
   pessoa. E eles se encostam de leve: grupo reunido ocupa um bloco só, e vão vazio
   entre as pessoas denuncia a colagem.

Nada é inventado: ninguém é redesenhado, só redimensionado, clareado e posto no
lugar.

---

## 6. As travas automáticas

Nenhuma depende de alguém olhar a arte. Todas escrevem no painel, e as que reprovam
impedem a publicação.

| trava | o que mede | o que faz |
|---|---|---|
| foto vazia | menos de 2% da imagem aparece | recusa a foto |
| recorte comeu tudo | sobrou menos de 4% da imagem | recusa a foto |
| recorte sem transparência | o recorte não vazou fundo nenhum | recusa a foto |
| **recorte duvidoso fora da montagem** | concordância abaixo de 0,60 | **usa a foto inteira no lugar do recorte** |
| recortadores discordam | concordância abaixo de 0,88 | junta o que cada um achou e avisa |
| montagem com recorte perdido | concordância abaixo de 0,25 num integrante | **reprova a programação** |
| **integrante que não pôde ser recortado** | qualquer falha de recorte na montagem | **reprova a programação** |
| logo vazada | mais de 15% do desenho virou buraco | recusa a logo |
| banda pequena no vão | ocupa menos de 55% da altura | avisa |

Duas delas merecem explicação.

**A rede de segurança do recorte duvidoso.** Como a leitura do fundo tem margem
estreita, fora da montagem um recorte que não sair confiável é descartado e a foto
entra inteira, dissolvida no fundo. Errar para o lado de não recortar custa pouco;
publicar um recorte que comeu um pedaço da pessoa custa a arte.

**Integrante faltando reprova.** Antes, um integrante cujo recorte falhasse era
deixado de fora com um aviso. A arte iria para o Instagram com a banda incompleta e
ninguém perceberia — nem a banda, até ver a publicação. Agora isso para a
programação. E, antes de desistir, o recorte tenta de novo com a foto menor, e
depois menor ainda: foto menor recorta pior nos fios de cabelo, e isso é muito
melhor que um integrante faltando.

---

## 7. O custo

Não recortar o que não precisa foi o que resolveu o tempo. Medido na mesma máquina,
na mesma foto:

| | antes | agora |
|---|---|---|
| uma foto de estúdio | 156 s | **36 s** |
| duas fotos de estúdio | 317 s | **23 s** |

Recorte com matting continua lento — é o preço de não ter contorno — mas agora só
acontece quando é necessário. A oficina do GitHub tem 25 minutos por rodada e pega
uma programação por vez, que é o que garante que a rodada não morra no meio
deixando programação marcada como "gerando artes" sem arte nenhuma.

---

## 8. A bateria de cenários

`python tests/bateria_imagens.py` monta doze pastas de entrada como as que chegam
de bandas de verdade, roda a preparação e o gerador, e guarda as seis peças de cada
uma em `tmp/bateria/`. As fotos são de bandas que já passaram pelo sistema,
incluindo as que deram problema.

`python tests/folha_de_contato.py feed` junta as artes numa folha.

**Nenhum número substitui olhar, e olhar em miniatura não conta.** Defeito de borda,
corte reto e foto boiando simplesmente não aparecem numa imagem reduzida — isso já
produziu uma aprovação errada neste projeto. A conferência é peça a peça, em tamanho
real.

---

## 9. Limites conhecidos

- **A leitura do fundo tem margem estreita.** Acerta as fotos do acervo, mas sete
  fotos são poucas para calibrar. A rede de segurança da seção 6 existe por isso.
- **Foto de grupo muito deitada na peça B.** O vão de B é alto e estreito; um grupo
  em foto panorâmica não preenche sem cortar gente fora. O sistema mantém todo mundo
  e avisa. Uma foto em pé a mais resolve.
- **Recorte não inventa o que a foto não tem.** Pessoa diluída na luz do fundo,
  foto desfocada ou muito escura continuam difíceis. Nesses casos o sistema avisa e,
  na montagem, reprova — melhor pedir a foto certa do que publicar algo ruim.
- **O tratamento é em preto e branco de alto contraste**, como o kit manda. Foto já
  muito escura perde detalhe.
