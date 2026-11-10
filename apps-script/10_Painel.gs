/**
 * Painel administrativo. É uma página web servida pelo próprio Apps Script, então não
 * tem hospedagem para pagar nem servidor para manter.
 *
 * Segurança: a página só abre com a chave certa no endereço, e TODA função chamada pela
 * página confere a chave de novo — senão alguém que descobrisse o endereço poderia
 * chamar as funções direto.
 */

function paginaDoPainel(chave) {
  if (!chaveValida(chave)) {
    return HtmlService.createHtmlOutput(
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<div style="font:16px/1.6 system-ui;max-width:460px;margin:12vh auto;padding:24px;' +
      'background:#0a0a0a;color:#fff;border-radius:12px">' +
      '<h2 style="color:#d6121c;margin:0 0 12px">Painel Woodstock</h2>' +
      '<p>Esta página só abre com a chave de acesso no endereço.</p>' +
      '<p style="color:#999;font-size:14px">Use o link completo que está no e-mail de ' +
      'instalação, terminado em <code>?chave=...</code></p></div>')
      .setTitle('Painel Woodstock');
  }
  var html = HtmlService.createHtmlOutputFromFile('Painel').getContent()
    .replace('__CHAVE__', chave);
  return HtmlService.createHtmlOutput(html)
    .setTitle('Painel Woodstock')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function exigirChave(chave) {
  if (!chaveValida(chave)) throw new Error('Chave de acesso inválida.');
}

// ---------- funções que o painel chama ----------

function painelCarregar(chave) {
  exigirChave(chave);
  var progs = linhas(ABA.PROGRAMACOES).map(function (p) {
    var artes = {};
    try { artes = JSON.parse(p.Artes || '{}'); } catch (x) { artes = {}; }
    var legendas = {};
    try { legendas = JSON.parse(p.Legendas || '{}'); } catch (x) { legendas = {}; }
    var data = paraData(p.DataShow);
    return {
      id: String(p.ID),
      banda: String(p.Banda),
      telefone: String(p.Telefone),
      instagram: String(p.InstagramBanda),
      dataShow: fmt(data, 'dd/MM/yyyy'),
      dataShowISO: fmt(data, 'yyyy-MM-dd'),
      recebidoEm: p.RecebidoEm ? fmt(new Date(p.RecebidoEm), 'dd/MM/yyyy HH:mm') : '',
      recebidoISO: p.RecebidoEm ? new Date(p.RecebidoEm).toISOString() : '',
      horaShow: horaTexto(p.HoraShow),
      diaSemana: String(p.DiaSemana),
      situacao: String(p.Situacao),
      modo: String(p.Modo || ''),
      erro: String(p.Erro || ''),
      avisos: String(p.Avisos || ''),
      pastaUrl: p.PastaId ? 'https://drive.google.com/drive/folders/' + p.PastaId : '',
      recebidos: (artes.recebidos && artes.recebidos.fotos ? artes.recebidos.fotos.length : 0) +
        (artes.recebidos && artes.recebidos.logo ? 1 : 0),
      feed: artes.FEED || {},
      story: artes.STORY || {},
      legendas: legendas
    };
  // Ordem de chegada, a inscrição mais nova no topo — e não por data do show.
  // É a ordem de quem trabalha no painel: o que acabou de entrar é o que precisa de
  // atenção. Por data do show, uma banda que se inscreveu agora para dali a um mês
  // apareceria no fim da lista, embaixo de shows já resolvidos.
  }).sort(function (a, b) {
    if (a.recebidoISO === b.recebidoISO) return 0;
    return a.recebidoISO < b.recebidoISO ? 1 : -1;
  });

  var ags = linhas(ABA.AGENDAMENTOS).map(function (a) {
    return {
      postId: String(a.PostId), progId: String(a.ProgramacaoId), banda: String(a.Banda),
      canal: String(a.Canal), opcao: String(a.Opcao),
      quando: fmt(new Date(a.QuandoISO), 'dd/MM/yyyy HH:mm'),
      quandoISO: String(a.QuandoISO),
      situacao: String(a.Situacao), erro: String(a.Erro || ''),
      url: String(a.ArquivoUrl || ''), legenda: String(a.Legenda || '')
    };
  }).sort(function (x, y) { return x.quandoISO < y.quandoISO ? -1 : 1; });

  var conf = aba(ABA.CONFIG).getDataRange().getValues().slice(1)
    .filter(function (l) { return String(l[0]).trim(); })
    .map(function (l) { return { chave: String(l[0]), valor: String(l[1]), ajuda: String(l[2]) }; });

  var logs = linhas(ABA.LOGS).slice(-80).reverse().map(function (l) {
    return {
      quando: fmt(new Date(l.Quando), 'dd/MM HH:mm'), nivel: String(l.Nivel),
      prog: String(l.Programacao || ''), evento: String(l.Evento), detalhe: String(l.Detalhe || '')
    };
  });

  return { programacoes: progs, agendamentos: ags, config: conf, logs: logs, estado: estadoDoSistema() };
}

/**
 * Aprova a programação, publicando só as peças marcadas.
 *
 * Sem marcação nenhuma, aprova tudo — que é como funcionava antes e continua sendo
 * o caminho normal. Marcando, só o que foi marcado vai para o calendário: se uma
 * das seis peças saiu torta, ela fica de fora e as outras cinco seguem, em vez de
 * reprovar a banda inteira por causa de uma arte.
 */
function painelAprovar(chave, id, pecas) {
  exigirChave(chave);
  return aprovarProgramacao(id, pecas);
}

/**
 * Junta as artes de uma banda num arquivo .zip só, para baixar de uma vez.
 *
 * As artes são buscadas do endereço público, e não do Drive: é o mesmo arquivo que
 * o Instagram recebeu, e não depende de a cópia para o Drive ter dado certo.
 */
function painelBaixarArtes(chave, id) {
  exigirChave(chave);
  var prog = acharProgramacao(id);
  if (!prog) throw new Error('Programação não encontrada.');

  var artes = {};
  try { artes = JSON.parse(prog.Artes || '{}'); } catch (x) { artes = {}; }

  var arquivos = [];
  var falhas = [];
  ['FEED', 'STORY'].forEach(function (canal) {
    Object.keys(artes[canal] || {}).sort().forEach(function (opcao) {
      var nome = id + '_OPCAO-' + opcao + '_' + (canal === 'FEED' ? 'feed' : 'story') + '.jpg';
      try {
        var r = UrlFetchApp.fetch(artes[canal][opcao], { muteHttpExceptions: true });
        if (r.getResponseCode() !== 200) throw new Error('resposta ' + r.getResponseCode());
        arquivos.push(r.getBlob().setName(nome));
      } catch (e) {
        falhas.push(nome + ' (' + e.message + ')');
      }
    });
  });

  if (!arquivos.length) {
    throw new Error('Não consegui baixar nenhuma arte desta banda.' +
      (falhas.length ? ' Motivo: ' + falhas[0] : ''));
  }
  var zip = Utilities.zip(arquivos, id + '_artes.zip');
  return {
    nome: zip.getName(),
    tipo: 'application/zip',
    conteudo: Utilities.base64Encode(zip.getBytes()),
    quantas: arquivos.length,
    falhas: falhas
  };
}
// Largura da miniatura dentro do PDF, em pixels. É o que decide o peso do arquivo:
// cada arte vai embutida dentro dele, porque um PDF que aponta para imagens na
// internet aparece vazio para quem abrir sem conexão — ou no dia em que o endereço
// sair do ar. Em 220 pixels dá para reconhecer a arte e conferir o que foi
// publicado, que é para o que o relatório serve; em tamanho cheio, um trimestre
// viraria um arquivo de dezenas de megabytes.
var LARGURA_MINIATURA = 220;

/**
 * O período que cada relatório cobre, em datas de calendário.
 *
 * São a semana, o mês e o trimestre CORRENTES, inteiros — do primeiro ao último
 * dia —, e não "os últimos sete dias". A diferença não é detalhe: a agenda de uma
 * casa de show é feita para a frente. Contando para trás a partir de hoje, um
 * relatório tirado dia 10 não encontra nenhum show marcado para o dia 15, e sai
 * vazio mesmo com a agenda cheia — foi exatamente o que aconteceu.
 */
function periodoDoRelatorio(nome) {
  var hoje = new Date();
  var de, ate, titulo, naCapa;

  if (nome === 'SEMANAL') {
    // Semana de segunda a domingo. getDay() devolve 0 para domingo.
    var diaDaSemana = (hoje.getDay() + 6) % 7;
    de = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - diaDaSemana);
    ate = new Date(de.getFullYear(), de.getMonth(), de.getDate() + 6);
    titulo = 'semanal';
    naCapa = 'Semana de ' + fmt(de, 'dd/MM') + ' a ' + fmt(ate, 'dd/MM');
  } else if (nome === 'MENSAL') {
    de = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    ate = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    titulo = 'mensal';
    naCapa = MESES[hoje.getMonth()];
  } else if (nome === 'TRIMESTRAL') {
    var primeiroMes = Math.floor(hoje.getMonth() / 3) * 3;
    de = new Date(hoje.getFullYear(), primeiroMes, 1);
    ate = new Date(hoje.getFullYear(), primeiroMes + 3, 0);
    titulo = 'trimestral';
    naCapa = MESES[primeiroMes] + ' a ' + MESES[primeiroMes + 2];
  } else {
    return null;
  }

  ate.setHours(23, 59, 59, 999);
  return { de: de, ate: ate, nome: titulo, titulo: naCapa };
}

/**
 * Monta o relatório do período em PDF, com as artes em miniatura e o que aconteceu
 * com cada publicação.
 *
 * O recorte é pela data do show, não pela data da publicação: é assim que a casa
 * pensa a agenda, e é o que permite comparar um mês com o outro.
 */
function painelRelatorio(chave, periodo) {
  exigirChave(chave);
  var faixa = periodoDoRelatorio(String(periodo || '').toUpperCase());
  if (!faixa) throw new Error('Período desconhecido: ' + periodo);

  var de = faixa.de;
  var ate = faixa.ate;

  var progs = linhas(ABA.PROGRAMACOES).filter(function (p) {
    var d = paraData(p.DataShow);
    return d && !isNaN(d.getTime()) && d >= de && d <= ate;
  }).sort(function (a, b) {
    return paraData(b.DataShow).getTime() - paraData(a.DataShow).getTime();
  });

  var posts = linhas(ABA.AGENDAMENTOS);
  var html = montarHtmlDoRelatorio(faixa, de, ate, progs, posts);
  var pdf = Utilities.newBlob(html, 'text/html', 'relatorio.html')
    .getAs('application/pdf')
    .setName('woodstock_' + faixa.nome + '_' + fmt(ate, 'yyyy-MM-dd') + '.pdf');

  registrar('INFO', '', 'RELATORIO', faixa.nome + ': ' + progs.length + ' shows, ' +
    Math.round(pdf.getBytes().length / 1024) + ' KB');
  return {
    nome: pdf.getName(),
    tipo: 'application/pdf',
    conteudo: Utilities.base64Encode(pdf.getBytes()),
    shows: progs.length,
    kb: Math.round(pdf.getBytes().length / 1024)
  };
}

/**
 * Traz a arte já pequena, para ser embutida no PDF.
 *
 * A oficina publica, ao lado de cada peça, uma versão reduzida com o sufixo
 * `_mini`. Medido: a peça inteira tem 225 KB e a miniatura, 13 KB — num relatório
 * trimestral isso é a diferença entre 2 MB e mais de 30, que o Apps Script nem
 * conseguiria montar.
 *
 * Artes produzidas antes de a miniatura existir não têm o arquivo reduzido; nesse
 * caso entra a peça inteira, que pesa mas aparece. Relatório sem as artes seria
 * pior que relatório pesado.
 */
function miniaturaEmbutida(url) {
  var pequena = String(url).replace(/\.jpg$/i, '_mini.jpg');
  var tentativas = pequena === url ? [url] : [pequena, url];
  for (var i = 0; i < tentativas.length; i++) {
    try {
      var r = UrlFetchApp.fetch(tentativas[i], { muteHttpExceptions: true });
      if (r.getResponseCode() === 200) {
        // O tipo vem da própria resposta: a logo é PNG e as artes são JPEG, e
        // anunciar o tipo errado faz leitor de PDF nenhum mostrar a imagem.
        var blob = r.getBlob();
        var tipo = String(blob.getContentType() || 'image/jpeg');
        return 'data:' + tipo + ';base64,' + Utilities.base64Encode(blob.getBytes());
      }
    } catch (e) { /* tenta a próxima */ }
  }
  return '';
}

/**
 * Monta o relatório no modelo da prestação de contas do bar.
 *
 * O desenho segue o documento que já é usado para prestar contas: capa escura com
 * os números grandes, uma página de resumo com a tabela do que foi entregue, e
 * depois uma página por show, com as peças em miniatura e o que aconteceu com
 * cada publicação. Mesma família de tipos (Anton nos títulos, Barlow no texto),
 * mesmas cores, mesmo rodapé.
 *
 * Nossa "campanha" é o show: é a unidade em que esta casa trabalha, e é ela que
 * agrupa as seis peças e as publicações que saíram delas.
 */
function montarHtmlDoRelatorio(faixa, de, ate, progs, posts) {
  var porProg = {};
  posts.forEach(function (a) {
    var k = String(a.ProgramacaoId);
    (porProg[k] = porProg[k] || []).push(a);
  });

  var contas = { feed: 0, story: 0, publicadas: 0, falhas: 0, agendadas: 0 };
  progs.forEach(function (p) {
    var artes = {};
    try { artes = JSON.parse(p.Artes || '{}'); } catch (x) { artes = {}; }
    contas.feed += Object.keys(artes.FEED || {}).length;
    contas.story += Object.keys(artes.STORY || {}).length;
    (porProg[String(p.ID)] || []).forEach(function (a) {
      if (String(a.Situacao) === 'PUBLICADO') contas.publicadas++;
      else if (String(a.Situacao) === 'FALHA') contas.falhas++;
      else if (String(a.Situacao) === 'AGENDADO') contas.agendadas++;
    });
  });
  var pecas = contas.feed + contas.story;

  var numero = function (valor, rotulo) {
    return '<div class="num"><b>' + valor + '</b><span>' + rotulo + '</span></div>';
  };

  // A capa é clara, e não escura como o documento que serviu de modelo. Não é
  // escolha de gosto: o conversor de PDF do Google escurece toda cor clara da
  // página em cerca de um terço — medido, #ffffff sai #ababab e #ff6b5e sai
  // #ab473f —, provavelmente para que texto branco não suma em papel branco. Numa
  // capa escura isso deixa o título cinza-chumbo, e não há como compensar: já não
  // existe cor mais clara que o branco para pedir. Em fundo claro com letra escura
  // o mesmo desvio não aparece, e a capa sai limpa.
  var capa =
    '<section class="folha capa">' +
    marcaDaCapa(progs) +
    '<p class="etiqueta">Prestação de contas · comunicação e redes sociais</p>' +
    '<h1>' + faixa.titulo + ' <em>' + fmt(ate, 'yyyy') + '</em></h1>' +
    '<div class="numeros">' +
    numero(pecas, 'peças produzidas') +
    numero(progs.length, progs.length === 1 ? 'show' : 'shows') +
    numero(contas.feed, 'posts de feed') +
    numero(contas.story, 'stories') +
    numero(contas.publicadas, contas.publicadas === 1 ? 'publicada' : 'publicadas') +
    '</div>' +
    '<p class="pe">' + ENDERECO + ' · ' + cfg('PERFIL_OFICIAL') + '</p>' +
    '</section>';

  var linhasResumo = progs.map(function (p) {
    var artes = {};
    try { artes = JSON.parse(p.Artes || '{}'); } catch (x) { artes = {}; }
    var nf = Object.keys(artes.FEED || {}).length;
    var ns = Object.keys(artes.STORY || {}).length;
    var meus = porProg[String(p.ID)] || [];
    var quando = meus.length
      ? fmt(new Date(meus[0].QuandoISO), 'dd/MM') + ' a ' +
        fmt(new Date(meus[meus.length - 1].QuandoISO), 'dd/MM')
      : '—';
    return '<tr><td class="mes">' + fmt(paraData(p.DataShow), 'dd/MM') + '</td>' +
      '<td class="campanha">' + p.Banda + '</td>' +
      '<td>' + quando + '</td>' +
      '<td>' + (nf ? nf + ' feed' : '') + (nf && ns ? ' + ' : '') +
        (ns ? ns + ' stories' : '') + (!nf && !ns ? 'sem artes' : '') + '</td>' +
      '<td class="total">' + (nf + ns) + '</td></tr>';
  }).join('');

  var resumo =
    '<section class="folha clara">' +
    '<p class="etiqueta v">Resumo</p>' +
    '<h2>O que foi entregue<span class="periodo">' +
      fmt(de, 'dd/MM') + ' a ' + fmt(ate, 'dd/MM/yyyy') + '</span></h2>' +
    '<table><thead><tr><th>Show</th><th>Banda ou artista</th><th>Publicações</th>' +
      '<th>Peças</th><th class="total">Total</th></tr></thead><tbody>' +
      (linhasResumo || '<tr><td colspan="5">Nenhum show neste período.</td></tr>') +
      '<tr class="soma"><td></td><td>Total</td><td></td>' +
      '<td>' + contas.feed + ' feed · ' + contas.story + ' stories</td>' +
      '<td class="total">' + pecas + '</td></tr>' +
    '</tbody></table>' +
    '<div class="colunas">' +
    '<div><h3>Como foi feito</h3><p>Cada show entra pelo cadastro da banda, com ' +
      'fotos e logotipo. O sistema trata as imagens, monta as seis peças — três ' +
      'layouts, em feed (4:5) e story (9:16) — e escreve as legendas. Toda peça sai ' +
      'com a logo oficial, couvert, endereço e @.</p></div>' +
    '<div><h3>Agendamento</h3><p>' + contas.publicadas + ' publicações saíram no ' +
      'período' + (contas.agendadas ? ' e ' + contas.agendadas + ' seguem na fila' : '') +
      (contas.falhas ? '. ' + contas.falhas + ' falharam e foram registradas' : '') +
      '. As peças são distribuídas entre o cadastro e o início do show, sem duas no ' +
      'mesmo horário.</p></div>' +
    '<div><h3>Identidade</h3><p>Vermelho Woodstock e tridente como base, fotos em ' +
      'preto e branco de alto contraste, integradas ao fundo da arte. Cada show ' +
      'sai nos três layouts do kit, sem perder a marca do bar.</p></div>' +
    '</div>' +
    rodape(1) + '</section>';

  var paginas = progs.map(function (p, i) {
    var artes = {};
    try { artes = JSON.parse(p.Artes || '{}'); } catch (x) { artes = {}; }

    var minis = [];
    ['FEED', 'STORY'].forEach(function (canal) {
      Object.keys(artes[canal] || {}).sort().forEach(function (opcao) {
        var dados = miniaturaEmbutida(artes[canal][opcao]);
        if (dados) {
          minis.push('<figure><img src="' + dados + '"><figcaption>' +
            (canal === 'FEED' ? 'feed' : 'story') + ' · opção ' + opcao +
            '</figcaption></figure>');
        }
      });
    });

    var meus = (porProg[String(p.ID)] || []).sort(function (x, y) {
      return String(x.QuandoISO) < String(y.QuandoISO) ? -1 : 1;
    });
    var tabela = meus.length
      ? '<table class="posts"><thead><tr><th>Quando</th><th>Peça</th>' +
        '<th>Situação</th><th>Observação</th></tr></thead><tbody>' +
        meus.map(function (a) {
          return '<tr><td>' + fmt(new Date(a.QuandoISO), 'dd/MM HH:mm') + '</td><td>' +
            (String(a.Canal) === 'FEED' ? 'feed' : 'story') + ' · ' + a.Opcao +
            '</td><td class="s-' + a.Situacao + '">' + String(a.Situacao).toLowerCase() +
            '</td><td>' + String(a.Erro || '—') + '</td></tr>';
        }).join('') + '</tbody></table>'
      : '<p class="nota">Nenhuma publicação agendada para este show.</p>';

    var nf = Object.keys(artes.FEED || {}).length;
    var ns = Object.keys(artes.STORY || {}).length;

    return '<section class="folha clara">' +
      '<p class="etiqueta v">' + fmt(paraData(p.DataShow), 'dd/MM/yyyy') +
        ' · show ' + (i + 1) + '</p>' +
      '<div class="cabeca"><h2>' + p.Banda + '</h2>' +
      '<div class="selos"><span><b>' + (nf + ns) + '</b> peças</span>' +
      '<span><b>Formato</b> feed 1080×1350 · story 1080×1920</span></div></div>' +
      '<p class="linhaFina">' + String(p.DiaSemana || '') + ' · show às ' +
        horaTexto(p.HoraShow) + ' · ' + p.InstagramBanda +
        ' · situação: ' + String(p.Situacao).toLowerCase().replace(/_/g, ' ') + '</p>' +
      (minis.length ? '<div class="artes">' + minis.join('') + '</div>'
        : '<p class="nota">As artes deste show não estão guardadas.</p>') +
      tabela +
      (p.Avisos ? '<p class="nota"><b>Avisos da produção:</b> ' + p.Avisos + '</p>' : '') +
      rodape(i + 2) + '</section>';
  }).join('');

  return '<!doctype html><html><head><meta charset="utf-8">' +
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?' +
    'family=Anton&family=Barlow+Semi+Condensed:wght@400;700&display=swap">' +
    '<style>' + estiloDoRelatorio() +
    '</style></head><body>' + capa + resumo + paginas + '</body></html>';
}

/**
 * A logo do bar na capa, embutida no arquivo.
 *
 * Vem do endereço público, como as miniaturas. Se não vier — rede fora do ar, por
 * exemplo —, entra o nome escrito no lugar: um relatório com a marca em texto ainda
 * presta contas; um relatório que não abre por falta de uma imagem, não.
 */
function marcaDaCapa(progs) {
  // O endereço público não está guardado em lugar nenhum do Apps Script, mas as
  // artes moram nele: basta cortar uma URL de arte no "/artes/" para chegar à raiz.
  // Assim a capa funciona sem precisar configurar mais nada.
  var base = '';
  for (var i = 0; i < progs.length && !base; i++) {
    var artes = {};
    try { artes = JSON.parse(progs[i].Artes || '{}'); } catch (x) { artes = {}; }
    ['FEED', 'STORY'].forEach(function (canal) {
      Object.keys(artes[canal] || {}).forEach(function (op) {
        var corte = String(artes[canal][op]).indexOf('/artes/');
        if (!base && corte > 0) base = String(artes[canal][op]).slice(0, corte);
      });
    });
  }
  if (base) {
    var dados = miniaturaEmbutida(base + '/marca/woodstock_vermelho.png');
    if (dados) return '<img class="marca" src="' + dados + '">';
  }
  return '<div class="marca">Woodstock<i>Rock Bar</i></div>';
}

function rodape(pagina) {
  return '<p class="rodape"><span>Woodstock Rock Bar · prestação de contas</span>' +
    '<span>' + pagina + '</span></p>';
}

/**
 * O estilo do relatório, no desenho da prestação de contas do bar.
 *
 * As famílias de tipos do documento original são Anton e Barlow Semi Condensed.
 * Elas entram com alternativas listadas atrás: o conversor de PDF do Google nem
 * sempre busca fonte na internet, e um relatório com a letra trocada ainda se lê —
 * um relatório que não abre, não.
 */
function estiloDoRelatorio() {
  var CREME = '#faf7f4';
  var TINTA = '#1c1713';
  var VERMELHO = '#d6121c';
  var TITULO = "Anton, 'Arial Narrow', Impact, sans-serif";
  var TEXTO = "'Barlow Semi Condensed', 'Arial Narrow', Arial, sans-serif";

  return '@page{size:A4 landscape;margin:0}' +
    '*{box-sizing:border-box;margin:0;padding:0}' +
    'body{font-family:' + TEXTO + ';color:' + TINTA + ';background:' + CREME + '}' +
    '.folha{width:297mm;height:209mm;padding:16mm 18mm;position:relative;' +
      'page-break-after:always;overflow:hidden}' +
    '.folha.clara{background:' + CREME + '}' +
    '.capa{background:' + CREME + ';color:' + TINTA + '}' +

    'img.marca{width:58mm;display:block}' +
    'div.marca{font-family:' + TITULO + ';font-size:40px;color:' + VERMELHO + ';line-height:1}' +
    'div.marca i{display:block;font-family:' + TEXTO + ';font-style:italic;font-size:15px;' +
      'letter-spacing:4px;margin-top:2px}' +
    '.etiqueta{font-weight:700;font-size:11px;letter-spacing:4px;text-transform:uppercase;' +
      'color:' + VERMELHO + ';margin-top:34mm}' +
    '.etiqueta.v{color:' + VERMELHO + ';margin-top:0}' +
    '.capa h1{font-family:' + TITULO + ';font-size:62px;line-height:1.02;margin-top:6px;' +
      'text-transform:uppercase;color:' + TINTA + '}' +
    '.capa h1 em{font-style:normal;color:' + VERMELHO + '}' +
    '.numeros{display:flex;gap:10mm;position:absolute;left:18mm;right:18mm;bottom:28mm}' +
    '.num{flex:1;border-top:2px solid ' + VERMELHO + ';padding-top:6px}' +
    '.num b{display:block;font-family:' + TITULO + ';font-size:34px;line-height:1;' +
      'color:' + TINTA + '}' +
    '.num span{font-size:11px;color:#6b615b}' +
    '.capa .pe{position:absolute;left:18mm;bottom:16mm;font-size:10px;color:#9a8e86}' +
    'h2{font-family:' + TITULO + ';font-size:34px;text-transform:uppercase;line-height:1.05;' +
      'border-bottom:3px solid ' + VERMELHO + ';padding-bottom:5px;margin-bottom:8px}' +
    'h2 .periodo{float:right;font-family:' + TEXTO + ';font-size:12px;color:#7a6f68;' +
      'text-transform:none;font-weight:400;padding-top:16px}' +
    '.cabeca{position:relative}' +
    '.selos{position:absolute;right:0;top:4px;display:flex;gap:6px}' +
    '.selos span{border:1px solid #ddd3cb;border-radius:4px;padding:4px 9px;font-size:10px}' +
    '.selos b{color:' + VERMELHO + '}' +
    '.linhaFina{font-size:11px;color:#6b615b;margin-bottom:8px}' +
    'table{border-collapse:collapse;width:100%;font-size:10.5px;margin-top:6px}' +
    'th{text-align:left;font-weight:700;font-size:9px;letter-spacing:2px;' +
      'text-transform:uppercase;color:#8a7f78;border-bottom:1px solid #ddd3cb;padding:5px 6px}' +
    'td{border-bottom:1px solid #ece4dd;padding:6px}' +
    'td.mes{color:' + VERMELHO + ';font-weight:700}' +
    'td.campanha{font-weight:700}' +
    '.total{text-align:right;font-family:' + TITULO + ';font-size:16px}' +
    'tr.soma td{border-top:2px solid ' + TINTA + ';border-bottom:none;font-weight:700}' +
    '.colunas{display:flex;gap:10mm;margin-top:9mm}' +
    '.colunas div{flex:1}' +
    'h3{font-family:' + TITULO + ';font-size:15px;color:' + VERMELHO + ';' +
      'text-transform:uppercase;margin-bottom:4px}' +
    '.colunas p{font-size:10.5px;line-height:1.5}' +
    '.artes{display:flex;flex-wrap:wrap;gap:5mm;margin:6mm 0}' +
    '.artes figure{width:38mm}' +
    '.artes img{width:100%;border:1px solid #ddd3cb;display:block}' +
    '.artes figcaption{font-size:9px;color:#8a7f78;padding-top:3px}' +
    '.posts td{font-size:10px}' +
    '.s-PUBLICADO{color:#1d7a3c;font-weight:700}' +
    '.s-FALHA{color:' + VERMELHO + ';font-weight:700}' +
    '.nota{font-size:10px;color:#6b615b;margin-top:5mm}' +
    '.rodape{position:absolute;left:18mm;right:18mm;bottom:10mm;display:flex;' +
      'justify-content:space-between;font-size:9px;color:#9a8e86;' +
      'border-top:1px solid #ece4dd;padding-top:5px}';
}

function painelReprovar(chave, id, motivo) { exigirChave(chave); return reprovarProgramacao(id, motivo); }
function painelRefazer(chave, id, peca) { exigirChave(chave); return refazerArtes(id, peca); }
function painelPausar(chave, id) { exigirChave(chave); return pausarProgramacao(id); }
function painelRetomar(chave, id) { exigirChave(chave); return retomarProgramacao(id); }
function painelCancelar(chave, id) { exigirChave(chave); return cancelarProgramacao(id); }
function painelRecalcular(chave, id) { exigirChave(chave); return recalcularProgramacao(id); }

function painelAlterarShow(chave, id, data, hora) {
  exigirChave(chave);
  return alterarShow(id, data, hora);
}

function painelDefinirConfig(chave, nome, valor) {
  exigirChave(chave);
  definirCfg(nome, valor);
  registrar('INFO', '', 'CONFIG_ALTERADA', nome + ' = ' + valor);
  return true;
}

function painelDefinirModo(chave, id, modo) {
  exigirChave(chave);
  var prog = acharProgramacao(id);
  if (!prog) throw new Error('Programação não encontrada.');
  gravarCampo(ABA.PROGRAMACOES, prog._linha, 'Modo', modo);
  registrar('INFO', id, 'MODO_ALTERADO', modo);
  return true;
}

function painelCancelarPost(chave, postId) {
  exigirChave(chave);
  var post = acharPost(postId);
  if (!post) throw new Error('Publicação não encontrada.');
  gravarCampo(ABA.AGENDAMENTOS, post._linha, 'Situacao', SIT_POST.CANCELADO);
  registrar('INFO', post.ProgramacaoId, 'POST_CANCELADO', postId);
  return true;
}
