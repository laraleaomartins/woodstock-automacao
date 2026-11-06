/**
 * O que acontece quando uma banda envia o formulário.
 * Este gatilho roda nos servidores do Google, com o computador desligado.
 */

function aoReceberResposta(e) {
  try {
    return comTrava('aoReceberResposta', function () { return processarResposta(e.response); });
  } catch (erro) {
    registrar('ERRO', '', 'RESPOSTA_FALHOU', erro.message + ' | ' + erro.stack);
    avisarFalhaInterna('Não consegui processar uma resposta do formulário', erro.message);
    throw erro;
  }
}

function processarResposta(resposta) {
  var d = extrairCampos(resposta);
  d.arquivos = (d.fotos || []).map(blobDoDrive).filter(Boolean);
  d.logoArquivo = d.logo.length ? blobDoDrive(d.logo[0]) : null;
  return criarProgramacao(d, resposta.getId(), 'formulário Google');
}

function blobDoDrive(fileId) {
  try {
    var arq = DriveApp.getFileById(fileId);
    return arq.getBlob().setName(arq.getName());
  } catch (e) {
    registrar('ERRO', '', 'LEITURA_ARQUIVO', 'Não consegui ler ' + fileId + ': ' + e.message);
    return null;
  }
}

/**
 * Cria a programação a partir dos dados já normalizados. É por aqui que entram
 * tanto o formulário do Google quanto a página de inscrição própria.
 */
function criarProgramacao(d, origemId, origem) {
  // Proteção contra duplicidade: a mesma inscrição nunca vira duas programações.
  var jaExiste = linhas(ABA.PROGRAMACOES).filter(function (p) {
    return String(p.RespostaId) === String(origemId);
  });
  if (jaExiste.length) {
    registrar('AVISO', jaExiste[0].ID, 'INSCRICAO_DUPLICADA',
      'Inscrição ' + origemId + ' já processada.');
    return jaExiste[0].ID;
  }

  var problemas = validar(d);
  if (problemas.length) {
    registrar('ERRO', '', 'INSCRICAO_INVALIDA', problemas.join('; ') + ' | banda=' + d.banda);
    avisarFalhaInterna('Inscrição com problema (' + (origem || '') + ')',
      'Banda: ' + d.banda + '\nProblemas:\n- ' + problemas.join('\n- ') +
      '\n\nNada foi criado. Peça o reenvio à banda.');
    return null;
  }

  var id = slugDe(d.dataShow, d.banda);
  id = idUnico(id);

  var pasta = criarPastasDaProgramacao(id);
  var recebidos = subpasta(pasta, 'RECEBIDOS');
  var arquivos = guardarArquivos(recebidos, d);

  var modo = cfg('MODO_OPERACAO');
  aba(ABA.PROGRAMACOES).appendRow([
    id, new Date(), d.banda, d.telefone, d.instagram,
    fmt(d.dataShow, 'yyyy-MM-dd'), pad2(d.hora.h) + ':' + pad2(d.hora.min),
    DIAS_SEMANA[d.dataShow.getDay()], pasta.getId(), SIT.AGUARDANDO_ARTES, modo,
    JSON.stringify({ recebidos: arquivos }), '', '', '', origemId, new Date()
  ]);

  registrar('INFO', id, 'PROGRAMACAO_CRIADA',
    d.banda + ' em ' + fmt(d.dataShow, 'dd/MM/yyyy') + ' | ' + arquivos.fotos.length +
    ' foto(s), logo=' + (arquivos.logo ? 'sim' : 'nao') + ' | modo=' + modo);

  notificar('Nova banda inscrita: ' + d.banda,
    'Entrou uma inscrição nova na programação.\n\n' +
    'Banda: ' + d.banda + '\n' +
    'Show: ' + fmt(d.dataShow, 'dd/MM/yyyy') + ' (' + DIAS_SEMANA[d.dataShow.getDay()] + ') às ' +
    pad2(d.hora.h) + 'h' + pad2(d.hora.min) + '\n' +
    'Instagram: ' + d.instagram + '\n' +
    'Contato: ' + d.telefone + '\n' +
    'Fotos recebidas: ' + arquivos.fotos.length + (arquivos.logo ? ' + logo' : ' (sem logo)') + '\n\n' +
    'As artes entram na fila de produção e saem em até 15 minutos.\n' +
    'Modo atual: ' + (modo === 'AUTOMATICO' ? 'AUTOMÁTICO (publica sozinho)' :
      'COM APROVAÇÃO (vai esperar você aprovar no painel)') + '\n\n' + linkPainel(),
    id);

  return id;
}

/** Lê a resposta pelo título da pergunta, sem depender da ordem. */
function extrairCampos(resposta) {
  var mapa = {};
  resposta.getItemResponses().forEach(function (ir) {
    mapa[ir.getItem().getTitle()] = ir.getResponse();
  });
  var pega = function (pedaco) {
    var chave = Object.keys(mapa).filter(function (t) {
      return t.toLowerCase().indexOf(pedaco) >= 0;
    })[0];
    return chave ? mapa[chave] : '';
  };
  var brutaData = pega('data do show');
  var brutaHora = pega('horário do show') || pega('horario do show');
  return {
    banda: String(pega('nome da banda')).trim(),
    telefone: String(pega('telefone')).trim(),
    instagram: arrobaLimpa(pega('instagram')),
    dataShowBruta: brutaData,
    dataShow: brutaData ? paraData(brutaData) : null,
    hora: paraHora(brutaHora),
    fotos: [].concat(pega('fotos da banda') || []),
    logo: [].concat(pega('logotipo') || []),
    email: resposta.getRespondentEmail()
  };
}

function validar(d) {
  var problemas = [];
  if (!d.banda) problemas.push('Nome da banda em branco.');
  if (!d.dataShow || isNaN(d.dataShow.getTime())) problemas.push('Data do show inválida.');
  if (d.dataShow && !isNaN(d.dataShow.getTime())) {
    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    if (d.dataShow.getTime() < hoje.getTime()) problemas.push('Data do show já passou.');
  }
  if (!(d.arquivos || []).length) problemas.push('Nenhuma foto enviada.');
  if (!d.instagram) problemas.push('@ do Instagram em branco.');
  if (String(d.telefone).replace(/\D/g, '').length < 10) problemas.push('Telefone incompleto.');
  return problemas;
}

/** Se duas bandas tocam no mesmo dia, o segundo vira ..._2. */
function idUnico(base) {
  var usados = linhas(ABA.PROGRAMACOES).map(function (p) { return String(p.ID); });
  if (usados.indexOf(base) < 0) return base;
  for (var n = 2; n < 50; n++) {
    if (usados.indexOf(base + '_' + n) < 0) return base + '_' + n;
  }
  return base + '_' + Date.now();
}

function criarPastasDaProgramacao(id) {
  var pasta = subpasta(subpasta(pastaRaiz(), 'PROGRAMACOES'), id);
  ['RECEBIDOS', 'ARTES-FEED', 'ARTES-STORIES', 'LEGENDAS', 'AGENDAMENTOS'].forEach(function (n) {
    subpasta(pasta, n);
  });
  return pasta;
}

/**
 * Guarda os arquivos recebidos na pasta da programação. Serve tanto para o que
 * chega do formulário do Google quanto da página de inscrição própria — os dois
 * caminhos entregam os arquivos já como blobs.
 */
function guardarArquivos(destino, d) {
  var saida = { fotos: [], logo: null };
  (d.arquivos || []).forEach(function (blob, i) {
    var guardado = gravarArquivo(destino, blob, 'foto' + (i + 1));
    if (guardado) saida.fotos.push(guardado);
  });
  if (d.logoArquivo) saida.logo = gravarArquivo(destino, d.logoArquivo, 'logo');
  return saida;
}

function gravarArquivo(destino, blob, prefixo) {
  try {
    var ext = (String(blob.getName() || '').match(/\.[A-Za-z0-9]+$/) || ['.jpg'])[0];
    var arq = destino.createFile(blob.setName(prefixo + ext));
    return { id: arq.getId(), nome: arq.getName(), tipo: arq.getMimeType() };
  } catch (e) {
    registrar('ERRO', '', 'GRAVACAO_ARQUIVO', 'Não consegui guardar ' + prefixo + ': ' + e.message);
    return null;
  }
}

function pad2(n) { return (n < 10 ? '0' : '') + n; }
