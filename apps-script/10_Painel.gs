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
      // O couvert e os perfis da colaboração moram dentro do registro dos arquivos
      // recebidos, e não numa coluna da planilha. Sem trazê-los aqui, o painel
      // mostrava tudo que a banda preencheu MENOS esses dois — justamente os que se
      // precisa conferir antes de aprovar, porque vão escritos na arte e na
      // publicação.
      couvert: String((artes.recebidos && artes.recebidos.couvert) || ''),
      colabs: [].concat((artes.recebidos && artes.recebidos.colabs) || []),
      // Se a banda disse que são integrantes separados para juntar numa foto só.
      // Explica por que a arte saiu montada, e é dado que ela preencheu.
      juntar: !!(artes.recebidos && artes.recebidos.juntar),
      temLogo: !!(artes.recebidos && artes.recebidos.logo),
      // As fotos que a banda enviou, cada uma com o seu estado. O painel precisa
      // delas junto com o resto para poder mostrar a foto ao lado do problema que
      // ela teve, em vez de um recado geral.
      fotos: fotosDaProgramacao(p),
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

  // As fotos de todas as bandas numa passada só, antes de montar as páginas.
  previasDoRelatorio(progs);
  var html = montarHtmlDoRelatorio(faixa, de, ate, progs);
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
/**
 * O relatório das inscrições do período, em PDF.
 *
 * Era o relatório das ARTES: uma página por show com as seis peças em miniatura e o
 * que cada publicação fez no Instagram. Sem artes e sem publicação, aquilo ficaria
 * vazio. Agora é o que um painel de coleta tem a prestar: quem se inscreveu, o que
 * cada banda preencheu, e as fotos que mandou.
 *
 * As fotos entram em miniatura, por escolha de quem usa: o relatório vira um
 * catálogo visual das bandas do período, e não só uma tabela de nomes.
 */
function montarHtmlDoRelatorio(faixa, de, ate, progs) {
  var totalFotos = 0;
  var comCouvert = 0;
  progs.forEach(function (p) {
    var r = recebidosDe(p);
    totalFotos += (r.fotos || []).length;
    if (r.couvert) comCouvert++;
  });

  var capa =
    '<section class="folha capa">' +
      marcaDaCapa(progs) +
      '<div class="etiqueta">' + esc(faixa.titulo) + '</div>' +
      '<h1>Inscrições recebidas</h1>' +
      '<div class="numeros">' +
        bloco(progs.length, progs.length === 1 ? 'banda inscrita' : 'bandas inscritas') +
        bloco(totalFotos, totalFotos === 1 ? 'foto recebida' : 'fotos recebidas') +
        bloco(comCouvert, comCouvert === 1 ? 'show com couvert' : 'shows com couvert') +
      '</div>' +
      '<p class="nota">As artes destes shows são feitas fora do sistema. Este ' +
        'relatório é o que as bandas enviaram.</p>' +
      rodape(ate) +
    '</section>';

  if (!progs.length) {
    return folhaInteira(capa +
      '<section class="folha"><h2>Nenhuma inscrição neste período</h2>' +
      '<p class="nota">Nenhuma banda se inscreveu para um show entre ' +
      fmt(de, 'dd/MM/yyyy') + ' e ' + fmt(ate, 'dd/MM/yyyy') + '.</p>' +
      rodape(ate) + '</section>');
  }

  var resumo =
    '<section class="folha"><h2>As bandas do período</h2>' +
    '<table><thead><tr><th>Show</th><th>Banda</th><th>Instagram</th>' +
    '<th>Telefone</th><th>Couvert</th><th>Fotos</th></tr></thead><tbody>' +
    progs.map(function (p) {
      var r = recebidosDe(p);
      return '<tr>' +
        '<td class="nowrap">' + fmt(paraData(p.DataShow), 'dd/MM') + ' · ' +
          horaTexto(p.HoraShow) + '</td>' +
        '<td><b>' + esc(p.Banda) + '</b></td>' +
        '<td>' + esc(p.InstagramBanda || '—') + '</td>' +
        '<td class="nowrap">' + esc(p.Telefone || '—') + '</td>' +
        '<td class="nowrap">' + (r.couvert ? 'R$ ' + esc(r.couvert) : 'franca') + '</td>' +
        '<td>' + (r.fotos || []).length + '</td>' +
        '</tr>';
    }).join('') +
    '</tbody></table>' + rodape(ate) + '</section>';

  var paginas = progs.map(function (p) {
    var r = recebidosDe(p);
    var colab = (r.colabs || [])[0] || '';

    // As fotos de todas as bandas são buscadas numa viagem só, antes de montar as
    // páginas — ver previasDoRelatorio. Buscando uma a uma, o relatório de um mês
    // com dez bandas levaria minutos.
    var minis = (p._previas || []).filter(function (d) { return !!d; })
      .map(function (d) { return '<figure><img src="' + d + '"></figure>'; }).join('');

    return '<section class="folha">' +
      '<h2>' + esc(p.Banda) + '</h2>' +
      '<div class="linhaFina">' + fmt(paraData(p.DataShow), 'dd/MM/yyyy') + ' · ' +
        esc(String(p.DiaSemana || '').toLowerCase()) + ' · ' +
        horaTexto(p.HoraShow) + '</div>' +
      '<table class="ficha"><tbody>' +
        linhaFicha('Telefone', p.Telefone || 'não informado') +
        linhaFicha('Instagram', p.InstagramBanda || 'não informado') +
        linhaFicha('Couvert', r.couvert ? 'R$ ' + r.couvert : 'sem couvert (entrada franca)') +
        linhaFicha('Coautor no post', colab || 'não pediu colaboração') +
        linhaFicha('Fotos enviadas', (r.fotos || []).length +
          (r.juntar ? ' · de integrantes separados' : '') +
          (r.logo ? ' · com logo' : ' · sem logo')) +
        linhaFicha('Inscrita em', p.RecebidoEm ? fmt(new Date(p.RecebidoEm), 'dd/MM/yyyy HH:mm') : '—') +
      '</tbody></table>' +
      (minis ? '<div class="artes">' + minis + '</div>'
             : '<p class="nota">Esta inscrição não tem foto guardada.</p>') +
      rodape(ate) +
    '</section>';
  }).join('');

  return folhaInteira(capa + resumo + paginas);
}

function linhaFicha(rotulo, valor) {
  return '<tr><th class="rot">' + esc(rotulo) + '</th><td>' + esc(valor) + '</td></tr>';
}

function bloco(numero, rotulo) {
  // Usa o mesmo desenho dos números da capa que o relatório já tinha: três blocos
  // com uma risca vermelha em cima. Classe nova aqui seria um segundo jeito de
  // mostrar a mesma coisa.
  return '<div class="num"><b>' + numero + '</b><span>' + esc(rotulo) + '</span></div>';
}

/**
 * As miniaturas das fotos de todas as bandas do relatório, numa passada só.
 *
 * Guardadas em `p._previas`, na mesma ordem das fotos. Buscar uma a uma na hora de
 * montar cada página é o defeito que já tornou o relatório das artes lento: 84
 * buscas em fila indiana davam 22 segundos.
 */
function previasDoRelatorio(progs) {
  progs.forEach(function (p) {
    p._previas = (recebidosDe(p).fotos || []).map(function (f) {
      var usar = f.manual && f.manual.id ? f.manual : f;
      if (!usar || !usar.id) return '';
      try {
        // 320 px bastam para a miniatura impressa de 44 mm do relatório.
        return previaDeArquivo(usar.id, 320);
      } catch (e) {
        return '';
      }
    });
  });
}

/** O documento inteiro, com as fontes e o estilo do relatório. */
function folhaInteira(corpo) {
  return '<!doctype html><html><head><meta charset="utf-8">' +
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?' +
    'family=Anton&family=Barlow+Semi+Condensed:wght@400;700&display=swap">' +
    '<style>' + estiloDoRelatorio() +
    '</style></head><body>' + corpo + '</body></html>';
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

/**
 * O rodapé de cada seção.
 *
 * Sem número de página, de propósito. O relatório flui entre páginas — uma tabela
 * longa continua na folha seguinte —, e em HTML não há como saber em que página um
 * trecho vai cair. A versão antiga numerava na mão e errava: a página 3 do arquivo
 * dizia "2", porque a contagem não incluía a capa. Número errado é pior que
 * nenhum, porque quem lê confia nele.
 */
function rodape(ate) {
  return '<p class="rodape">Woodstock Rock Bar · prestação de contas · ' +
    fmt(ate, 'MM/yyyy') + '</p>';
}

/**
 * Deixa os avisos da produção legíveis para quem não escreveu o sistema.
 *
 * Eles carregam medições cruas — {'bordas': {'visivel': 0.514, 'buracos': 0.0}} —
 * que servem para investigar um defeito e não dizem nada a quem lê um relatório de
 * prestação de contas. O recado fica; a conta sai.
 */
function avisosLegiveis(texto) {
  return String(texto || '')
    .replace(/\s*\(medidas:[^)]*\)/g, '')
    .replace(/\s*\(medida [^)]*\)/g, '')
    .replace(/\s*\(\{[^}]*\}\)/g, '')
    .replace(/\s*\|\s*/g, ' · ')
    .trim();
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

  // A margem fica na PÁGINA, não dentro de cada seção. É o que faz um show cuja
  // tabela passa de uma página continuar com margem na página seguinte: a margem
  // da seção valeria uma vez só, e o conteúdo da segunda página encostaria na
  // borda do papel.
  return '@page{size:A4 landscape;margin:14mm 18mm}' +
    '*{box-sizing:border-box;margin:0;padding:0}' +
    'body{font-family:' + TEXTO + ';color:' + TINTA + ';background:' + CREME + '}' +

    // As seções NÃO têm altura fixa. Tinham, com o que sobrava cortado fora, e era
    // a causa de quase todos os defeitos deste relatório: a tabela de um show com
    // muitas publicações era decepada no meio de uma linha, e o rodapé — que ficava
    // preso no pé da caixa — era desenhado POR CIMA das linhas. Deixando o conteúdo
    // fluir, ele passa para a página seguinte em vez de sumir.
    '.folha{page-break-before:always}' +
    '.folha:first-child{page-break-before:avoid}' +
    '.capa{height:180mm;display:flex;flex-direction:column;justify-content:space-between}' +

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
    '.numeros{display:flex;gap:10mm;margin-top:auto}' +
    '.num{flex:1;border-top:2px solid ' + VERMELHO + ';padding-top:6px}' +
    '.num b{display:block;font-family:' + TITULO + ';font-size:34px;line-height:1;' +
      'color:' + TINTA + '}' +
    '.num span{font-size:11px;color:#6b615b}' +
    '.capa .pe{font-size:10px;color:#9a8e86;margin-top:8mm}' +
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
    'thead{display:table-header-group}' +   // repete o cabeçalho em cada página
    'tr{page-break-inside:avoid}' +
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
    // Feed é 4:5 e story é 9:16. Dando a mesma LARGURA às duas, o story fica muito
    // mais alto e a fileira sai escalonada, com as legendas em alturas diferentes.
    // Fixando a ALTURA, as peças ficam alinhadas e cada uma guarda sua proporção.
    '.artes figure{display:flex;flex-direction:column}' +
    '.artes img{height:44mm;width:auto;border:1px solid #ddd3cb;display:block}' +
    '.artes figcaption{font-size:9px;color:#8a7f78;padding-top:3px}' +
    '.posts td{font-size:10px}' +
    '.s-PUBLICADO{color:#1d7a3c;font-weight:700}' +
    '.s-FALHA{color:' + VERMELHO + ';font-weight:700}' +
    '.nota{font-size:10px;color:#6b615b;margin-top:5mm}' +
    // A ficha de cada banda: rótulo estreito à esquerda, resposta à direita.
    'table.ficha{width:auto;min-width:110mm;margin-top:5mm}' +
    'table.ficha th.rot{width:42mm;border-bottom:1px solid #ece4dd;vertical-align:top}' +
    'table.ficha td{font-size:11.5px}' +
    '.nowrap{white-space:nowrap}' +
    // O rodapé FLUI no fim da seção. Preso no pé da página, ele era desenhado por
    // cima das linhas da tabela quando o show tinha muitas publicações — e, depois
    // que as seções deixaram de ter altura fixa, foi parar no fim do documento
    // inteiro, sumindo das páginas.
    '.rodape{margin-top:8mm;font-size:9px;color:#9a8e86;' +
      'border-top:1px solid #ece4dd;padding-top:5px}';
}

/**
 * Guarda as legendas reescritas à mão e, se as publicações já estiverem na fila,
 * troca o texto delas também.
 *
 * Essa segunda parte é o ponto delicado: a legenda é COPIADA para a linha de cada
 * publicação na hora de agendar. Guardar só na programação faria o painel mostrar
 * o texto novo e o Instagram receber o antigo — o pior tipo de erro, porque parece
 * que funcionou. Publicação que já saiu não é mexida: lá o texto já está no ar.
 */
function painelSalvarLegendas(chave, id, textos) {
  exigirChave(chave);
  var prog = acharProgramacao(id);
  if (!prog) throw new Error('Programação não encontrada.');

  var atuais = {};
  try { atuais = JSON.parse(prog.Legendas || '{}'); } catch (x) { atuais = {}; }
  ['A', 'B', 'C'].forEach(function (opcao) {
    if (textos && typeof textos[opcao] === 'string') {
      atuais[opcao] = String(textos[opcao]).slice(0, 2200);
    }
  });
  gravarCampos(ABA.PROGRAMACOES, prog._linha, { Legendas: JSON.stringify(atuais) });

  var trocadas = 0;
  linhas(ABA.AGENDAMENTOS).forEach(function (a) {
    if (String(a.ProgramacaoId) !== String(id)) return;
    if (String(a.Canal) !== 'FEED') return;          // story não leva legenda
    if (String(a.Situacao) !== SIT_POST.AGENDADO) return;
    var novo = atuais[String(a.Opcao)];
    if (novo == null || String(a.Legenda) === novo) return;
    gravarCampos(ABA.AGENDAMENTOS, a._linha, { Legenda: novo });
    trocadas++;
  });

  registrar('INFO', id, 'LEGENDAS_EDITADAS',
    'Legendas reescritas à mão' + (trocadas ? '; ' + trocadas + ' publicação(ões) na fila atualizadas' : ''));
  return trocadas;
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
