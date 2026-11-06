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
  var t = HtmlService.createTemplateFromFile('Painel');
  t.chave = chave;
  return t.evaluate()
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
      horaShow: String(p.HoraShow),
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
  }).sort(function (a, b) { return a.dataShowISO < b.dataShowISO ? 1 : -1; });

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

function painelAprovar(chave, id) { exigirChave(chave); return aprovarProgramacao(id); }
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
  var post = linhas(ABA.AGENDAMENTOS).filter(function (a) {
    return String(a.PostId) === String(postId);
  })[0];
  if (!post) throw new Error('Publicação não encontrada.');
  gravarCampo(ABA.AGENDAMENTOS, post._linha, 'Situacao', SIT_POST.CANCELADO);
  registrar('INFO', post.ProgramacaoId, 'POST_CANCELADO', postId);
  return true;
}
