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

function montarLegendas(prog) {
  var data = paraData(prog.DataShow);
  var hora = paraHora(prog.HoraShow);
  var diaSemana = String(prog.DiaSemana || DIAS_SEMANA[data.getDay()]);
  var diaCurto = diaSemana.replace('-FEIRA', '');
  var banda = String(prog.Banda).toUpperCase();
  var perfil = cfg('PERFIL_OFICIAL');
  var arrobaBanda = String(prog.InstagramBanda || '');

  var saida = {};
  ['A', 'B', 'C'].forEach(function (opcao, i) {
    var abertura = ABERTURAS[opcao][i % ABERTURAS[opcao].length]
      .replace('{BANDA}', banda).replace('{DIA_CURTO}', diaCurto);

    var corpo = [
      abertura,
      '',
      '📅 ' + fmt(data, 'dd/MM') + ' · ' + diaSemana,
      '🚪 Bar abre 18h',
      '🎸 Show a partir das ' + pad2(hora.h) + 'h' + (hora.min ? pad2(hora.min) : ''),
      '🎟️ Couvert R$15',
      '📍 ' + ENDERECO,
      '',
      CHAMADAS[opcao],
      '',
      hashtags(banda, arrobaBanda, perfil)
    ].join('\n');

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
