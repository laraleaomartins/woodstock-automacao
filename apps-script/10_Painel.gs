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
  var de, ate, titulo;

  if (nome === 'SEMANAL') {
    // Semana de segunda a domingo. getDay() devolve 0 para domingo.
    var diaDaSemana = (hoje.getDay() + 6) % 7;
    de = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - diaDaSemana);
    ate = new Date(de.getFullYear(), de.getMonth(), de.getDate() + 6);
    titulo = 'semanal';
  } else if (nome === 'MENSAL') {
    de = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    ate = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    titulo = 'mensal';
  } else if (nome === 'TRIMESTRAL') {
    var primeiroMes = Math.floor(hoje.getMonth() / 3) * 3;
    de = new Date(hoje.getFullYear(), primeiroMes, 1);
    ate = new Date(hoje.getFullYear(), primeiroMes + 3, 0);
    titulo = 'trimestral';
  } else {
    return null;
  }

  ate.setHours(23, 59, 59, 999);
  return { de: de, ate: ate, nome: titulo };
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
        return 'data:image/jpeg;base64,' + Utilities.base64Encode(r.getBlob().getBytes());
      }
    } catch (e) { /* tenta a próxima */ }
  }
  return '';
}

function montarHtmlDoRelatorio(faixa, de, ate, progs, posts) {
  var porProg = {};
  posts.forEach(function (a) {
    var k = String(a.ProgramacaoId);
    (porProg[k] = porProg[k] || []).push(a);
  });

  var publicadas = 0;
  var falhas = 0;
  posts.forEach(function (a) {
    var d = new Date(a.QuandoISO);
    if (d >= de && d <= ate) {
      if (String(a.Situacao) === 'PUBLICADO') publicadas++;
      if (String(a.Situacao) === 'FALHA') falhas++;
    }
  });

  var blocos = progs.map(function (p) {
    var artes = {};
    try { artes = JSON.parse(p.Artes || '{}'); } catch (x) { artes = {}; }

    var minis = [];
    ['FEED', 'STORY'].forEach(function (canal) {
      Object.keys(artes[canal] || {}).sort().forEach(function (opcao) {
        var dados = miniaturaEmbutida(artes[canal][opcao]);
        if (dados) {
          minis.push('<figure><img src="' + dados + '"><figcaption>' +
            (canal === 'FEED' ? 'publicação' : 'story') + ' ' + opcao + '</figcaption></figure>');
        }
      });
    });

    var meus = (porProg[String(p.ID)] || []).sort(function (x, y) {
      return String(x.QuandoISO) < String(y.QuandoISO) ? -1 : 1;
    });
    var linhasPost = meus.map(function (a) {
      return '<tr><td>' + fmt(new Date(a.QuandoISO), 'dd/MM HH:mm') + '</td><td>' +
        (String(a.Canal) === 'FEED' ? 'publicação' : 'story') + ' ' + a.Opcao + '</td><td>' +
        a.Situacao + '</td><td>' + String(a.Erro || '') + '</td></tr>';
    }).join('');

    return '<section>' +
      '<h2>' + p.Banda + '</h2>' +
      '<p class="sub">' + fmt(paraData(p.DataShow), 'dd/MM/yyyy') + ' · ' + p.DiaSemana +
      ' · ' + horaTexto(p.HoraShow) + ' · ' + p.InstagramBanda +
      ' · situação: ' + p.Situacao + '</p>' +
      (minis.length ? '<div class="artes">' + minis.join('') + '</div>'
        : '<p class="sub">Sem artes guardadas.</p>') +
      (linhasPost
        ? '<table><tr><th>quando</th><th>peça</th><th>situação</th><th>erro</th></tr>' +
          linhasPost + '</table>'
        : '<p class="sub">Nenhuma publicação agendada.</p>') +
      '</section>';
  }).join('');

  return '<!doctype html><html><head><meta charset="utf-8"><style>' +
    'body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:26px}' +
    'h1{font-size:21px;margin:0 0 2px}h2{font-size:15px;margin:0 0 2px}' +
    '.cab{border-bottom:2px solid #d6121c;padding-bottom:10px;margin-bottom:16px}' +
    '.sub{color:#555;font-size:11px;margin:0 0 8px}' +
    'section{page-break-inside:avoid;border-bottom:1px solid #ddd;padding:12px 0}' +
    '.artes{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 10px}' +
    'figure{margin:0;width:' + LARGURA_MINIATURA + 'px}' +
    'img{width:100%;border:1px solid #ccc}' +
    'figcaption{font-size:10px;color:#666;text-align:center;padding-top:2px}' +
    'table{border-collapse:collapse;width:100%;font-size:11px}' +
    'th,td{border:1px solid #ddd;padding:4px 6px;text-align:left}' +
    'th{background:#f3f3f3}' +
    '</style></head><body>' +
    '<div class="cab"><h1>Woodstock Rock Bar — relatório ' + faixa.nome + '</h1>' +
    '<p class="sub">Shows de ' + fmt(de, 'dd/MM/yyyy') + ' a ' + fmt(ate, 'dd/MM/yyyy') +
    ' · ' + progs.length + ' shows · ' + publicadas + ' publicações feitas' +
    (falhas ? ' · ' + falhas + ' falharam' : '') +
    ' · gerado em ' + fmt(new Date(), 'dd/MM/yyyy HH:mm') + '</p></div>' +
    (blocos || '<p>Nenhum show neste período.</p>') +
    '</body></html>';
}

function painelReprovar(chave, id, motivo) { exigirChave(chave); return reprovarProgramacao(id, motivo); }
function painelRefazer(chave, id) { exigirChave(chave); return refazerArtes(id); }
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
