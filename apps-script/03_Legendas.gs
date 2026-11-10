/**
 * Legendas. Tudo que entra aqui vem dos dados reais da programação — o sistema não
 * inventa preço, promoção, reserva nem atração que não foi informada.
 * Cada uma das 3 artes do mesmo show recebe um texto diferente, como manda o kit.
 */

var ENDERECO = 'Av. D, 1064 – St. Oeste, Goiânia – GO';

var ABERTURAS = {
  A: ['Rasgou a semana: {BANDA} no palco do Woodstock.',
      '{BANDA} chega pra sacudir o Woodstock.',
      'Tem {BANDA} ao vivo esperando por você.'],
  B: ['{DIA_CURTO} é dia de {BANDA} no Woodstock.',
      'Marca na agenda: {BANDA}, {DIA_CURTO}, no Woodstock.',
      'A agenda da semana tem nome: {BANDA}.'],
  C: ['Seu ingresso pro {DIA_CURTO}: {BANDA} ao vivo.',
      '{BANDA} ao vivo — e a entrada cabe no bolso.',
      'Pega o canto, chama a turma: {BANDA} no Woodstock.']
};

var CHAMADAS = {
  A: 'Chama quem não pode faltar e vem.',
  B: 'Marca a galera nos comentários e garante a mesa.',
  C: 'Salva o post pra não esquecer e vem com a gente.'
};

/**
 * Um número estável tirado de um texto, para escolher entre alternativas.
 *
 * Não é sorteio: sorteio de verdade faria a mesma programação escrever uma legenda
 * diferente a cada vez, e refazer uma arte trocaria o texto das outras sem ninguém
 * pedir. Aqui, o mesmo identificador devolve sempre o mesmo número, e
 * identificadores diferentes caem em lugares diferentes da lista.
 */
function assinaturaDoTexto(texto) {
  var soma = 0;
  for (var i = 0; i < texto.length; i++) {
    soma = (soma * 31 + texto.charCodeAt(i)) % 100000;
  }
  return soma;
}

function montarLegendas(prog) {
  var data = paraData(prog.DataShow);
  var hora = paraHora(prog.HoraShow);
  var diaSemana = String(prog.DiaSemana || DIAS_SEMANA[data.getDay()]);
  var diaCurto = diaSemana.replace('-FEIRA', '');
  var banda = String(prog.Banda).toUpperCase();
  var perfil = cfg('PERFIL_OFICIAL');
  var arrobaBanda = String(prog.InstagramBanda || '');

  // O couvert é o que a banda informou na inscrição, igual ao que vai na arte.
  // Deixá-lo escrito fixo aqui faria a legenda anunciar um preço e a arte, outro —
  // e quem lesse acreditaria na legenda. Show sem couvert simplesmente não traz a
  // linha, em vez de anunciar entrada paga que não existe.
  var couvert = '';
  try {
    couvert = String((JSON.parse(prog.Artes || '{}').recebidos || {}).couvert || '');
  } catch (x) {
    couvert = '';
  }

  var saida = {};
  ['A', 'B', 'C'].forEach(function (opcao, i) {
    // Qual das frases de abertura cada peça usa.
    //
    // Antes era `i`, o número do layout: o A pegava sempre a primeira, o B sempre a
    // segunda, o C sempre a terceira. As nove frases estavam escritas, mas só três
    // eram usadas — e as MESMAS três em todo show. Quem acompanha o perfil via
    // "Rasgou a semana: FULANO no palco do Woodstock" toda semana, só trocando o
    // nome.
    //
    // Agora o ponto de partida vem do identificador da programação, então shows
    // diferentes começam em lugares diferentes da lista. E é estável: a mesma
    // programação, refeita, escreve a mesma legenda — senão refazer uma arte
    // trocaria o texto de todas as outras sem ninguém pedir.
    var giro = (assinaturaDoTexto(String(prog.ID)) + i) % ABERTURAS[opcao].length;
    var abertura = ABERTURAS[opcao][giro]
      .replace('{BANDA}', banda).replace('{DIA_CURTO}', diaCurto);

    var corpo = [
      abertura,
      '',
      '📅 ' + fmt(data, 'dd/MM') + ' · ' + diaSemana,
      '🚪 Bar abre 18h',
      '🎸 Show a partir das ' + pad2(hora.h) + 'h' + (hora.min ? pad2(hora.min) : ''),
      couvert ? '🎟️ Couvert R$' + couvert : null,
      '📍 ' + ENDERECO,
      '',
      CHAMADAS[opcao],
      '',
      hashtags(banda, arrobaBanda, perfil)
    ].filter(function (linha) {
      // Linha vazia é separador de parágrafo e fica. Nulo é linha que não existe
      // neste show — o couvert, quando a banda não cobrou — e sai sem deixar buraco.
      return linha !== null;
    }).join('\n');

    saida[opcao] = corpo;
  });
  return saida;
}

function hashtags(banda, arrobaBanda, perfil) {
  // #PeladaDeQuinta lê melhor que #PELADADEQUINTA.
  var tagBanda = '#' + String(banda).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().split(/[^A-Za-z0-9]+/).filter(String)
    .map(function (p) { return p.charAt(0).toUpperCase() + p.slice(1); }).join('');
  var tags = ['#WoodstockRockBar'];
  if (tagBanda.length > 2) tags.push(tagBanda);
  tags.push('#RockAoVivo', '#Goiânia', '#SetorOeste', '#MúsicaAoVivo');
  var linha = tags.join(' ');
  var menções = perfil + (arrobaBanda ? ' ' + arrobaBanda : '');
  return menções + '\n' + linha;
}

/** Grava as legendas como arquivo de texto na pasta LEGENDAS da programação. */
function salvarLegendas(prog, legendas) {
  var pasta = subpasta(DriveApp.getFolderById(prog.PastaId), 'LEGENDAS');
  var texto = ['LEGENDAS — ' + prog.Banda + ' — ' + fmt(paraData(prog.DataShow), 'dd/MM/yyyy'), ''];
  ['A', 'B', 'C'].forEach(function (o) {
    texto.push('===== OPÇÃO ' + o + ' =====', legendas[o], '');
  });
  var nome = 'legendas_' + prog.ID + '.txt';
  var antigos = pasta.getFilesByName(nome);
  while (antigos.hasNext()) antigos.next().setTrashed(true);
  pasta.createFile(nome, texto.join('\n'), MimeType.PLAIN_TEXT);
  return legendas;
}
