/**
 * Porta de entrada do sistema pela web.
 *
 * Serve duas coisas no mesmo endereço:
 *  - o painel administrativo (quando você abre no navegador com a chave);
 *  - a ponte com o GitHub, que busca o trabalho e devolve as artes prontas.
 *
 * Tudo é protegido por uma chave secreta. Sem a chave, não passa nada.
 */

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.inscricao) return paginaDeInscricao();   // página pública das bandas
  if (!p.acao) return paginaDoPainel(p.chave);

  if (!chaveValida(p.chave)) return json({ ok: false, erro: 'chave inválida' });

  try {
    switch (p.acao) {
      case 'ping':     return json({ ok: true, quando: new Date().toISOString() });
      case 'jobs':     return json({ ok: true, jobs: jobsDeArtes(Number(p.limite || 3)) });
      case 'arquivo':  return json({ ok: true, arquivo: arquivoEmBase64(p.id) });
      case 'estado':   return json({ ok: true, estado: estadoDoSistema() });
      default:         return json({ ok: false, erro: 'ação desconhecida: ' + p.acao });
    }
  } catch (erro) {
    registrar('ERRO', '', 'API_GET', p.acao + ': ' + erro.message);
    return json({ ok: false, erro: limparSegredos(erro.message) });
  }
}

function doPost(e) {
  var corpo = {};
  try { corpo = JSON.parse(e.postData.contents); } catch (x) { corpo = {}; }

  // A inscrição não pede chave: é a mesma porta que a página pública das bandas já
  // usa. Ela se protege sozinha, com validação, campo-isca e freio por hora.
  if (corpo.acao === 'inscricao') {
    try {
      return json(receberInscricao(corpo.dados || {}));
    } catch (erro) {
      registrar('ERRO', '', 'INSCRICAO_API', erro.message);
      return json({ ok: false, problemas: ['Não consegui registrar. Tente de novo.'] });
    }
  }

  if (!chaveValida(corpo.chave)) return json({ ok: false, erro: 'chave inválida' });

  try {
    switch (corpo.acao) {
      case 'artes_prontas':
        return json({ ok: true, resultado: registrarArtesProntas(corpo.id, corpo.artes, corpo.avisos) });
      case 'falha_artes':
        return json({ ok: true, resultado: registrarFalhaDeArtes(corpo.id, corpo.erro) });
      default:
        return json({ ok: false, erro: 'ação desconhecida: ' + corpo.acao });
    }
  } catch (erro) {
    registrar('ERRO', corpo.id || '', 'API_POST', corpo.acao + ': ' + erro.message);
    return json({ ok: false, erro: limparSegredos(erro.message) });
  }
}

function chaveValida(chave) {
  var esperada = segredo('API_TOKEN');
  if (!esperada) return false;
  var recebida = String(chave || '');
  if (recebida.length !== esperada.length) return false;
  var diff = 0;
  for (var i = 0; i < esperada.length; i++) {
    diff |= esperada.charCodeAt(i) ^ recebida.charCodeAt(i);
  }
  return diff === 0;
}

/** Entrega para o GitHub o que precisa virar arte, e marca como "em produção". */
function jobsDeArtes(limite) {
  return comTrava('jobsDeArtes', function () {
    var saida = [];
    var pendentes = linhas(ABA.PROGRAMACOES).filter(function (p) {
      return p.Situacao === SIT.AGUARDANDO_ARTES;
    }).slice(0, limite || 3);

    pendentes.forEach(function (p) {
      var arquivos = {};
      try { arquivos = JSON.parse(p.Artes || '{}').recebidos || {}; } catch (x) { arquivos = {}; }
      var data = paraData(p.DataShow);
      saida.push({
        id: p.ID,
        banda: String(p.Banda).toUpperCase(),
        dia: fmt(data, 'dd'),
        mes: MESES[data.getMonth()],
        mesAbrev: MESES_ABREV[data.getMonth()],
        diaSemana: String(p.DiaSemana || DIAS_SEMANA[data.getDay()]),
        fotos: (arquivos.fotos || []).map(function (f) { return { id: f.id, nome: f.nome }; }),
        logo: arquivos.logo ? { id: arquivos.logo.id, nome: arquivos.logo.nome } : null
      });
      gravarCampos(ABA.PROGRAMACOES, p._linha, { Situacao: SIT.GERANDO_ARTES, Erro: '' });
      registrar('INFO', p.ID, 'ARTES_EM_PRODUCAO', 'Entregue ao GitHub para produção.');
    });
    return saida;
  });
}

/** Devolve um arquivo do Drive em base64, só para quem tem a chave. */
function arquivoEmBase64(fileId) {
  var arq = DriveApp.getFileById(fileId);
  var blob = arq.getBlob();
  if (blob.getBytes().length > 18 * 1024 * 1024) {
    throw new Error('Arquivo grande demais: ' + arq.getName());
  }
  return {
    nome: arq.getName(),
    tipo: blob.getContentType(),
    conteudo: Utilities.base64Encode(blob.getBytes())
  };
}

function registrarFalhaDeArtes(programacaoId, erro) {
  var prog = acharProgramacao(programacaoId);
  if (!prog) throw new Error('Programação não encontrada: ' + programacaoId);
  gravarCampos(ABA.PROGRAMACOES, prog._linha,
    { Situacao: SIT.ERRO_ARTES, Erro: String(erro || '').slice(0, 900) });
  registrar('ERRO', programacaoId, 'ARTES_FALHARAM', erro);
  notificar('Não consegui produzir as artes: ' + prog.Banda,
    'A produção das artes de ' + prog.Banda + ' falhou.\n\n' +
    'Motivo: ' + erro + '\n\n' +
    'Nada foi agendado nem publicado. O caso mais comum é foto de baixa qualidade ou ' +
    'arquivo que não é imagem. Pelo painel você pode mandar tentar de novo.\n\n' + linkPainel(),
    programacaoId);
  return true;
}

function estadoDoSistema() {
  var progs = linhas(ABA.PROGRAMACOES);
  var ags = linhas(ABA.AGENDAMENTOS);
  var contar = function (lista, campo) {
    var c = {};
    lista.forEach(function (x) { c[x[campo]] = (c[x[campo]] || 0) + 1; });
    return c;
  };
  return {
    programacoes: progs.length,
    porSituacao: contar(progs, 'Situacao'),
    agendamentos: ags.length,
    postsPorSituacao: contar(ags, 'Situacao'),
    instagramConectado: igConfigurado(),
    publicandoDeVerdade: cfgSim('PUBLICAR_DE_VERDADE'),
    modo: cfg('MODO_OPERACAO')
  };
}

function linkPainel() {
  var url = ScriptApp.getService().getUrl();
  if (!url) return '';
  return 'Painel: ' + url + '?chave=' + segredo('API_TOKEN');
}
