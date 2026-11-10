/**
 * Instalação. Rode instalar() UMA vez: ele cria a planilha de controle, as pastas no
 * Drive, o formulário das bandas e os gatilhos automáticos. Rodar de novo não duplica
 * nada — ele reaproveita o que já existe.
 */

var TEXTO_INFORMATIVO =
  'INFORMAÇÕES IMPORTANTES SOBRE A DIVULGAÇÃO\n\n' +
  'As publicações oficiais da programação semanal do Woodstock são realizadas sempre no início ' +
  'da semana.\n\n' +
  'Qualquer divulgação realizada antes desse período deverá ser feita pela própria banda ou ' +
  'artista, mencionando o perfil oficial do bar.\n\n' +
  'Os Stories de chamada para o show também deverão ser publicados pela própria banda ou ' +
  'artista, com a marcação do perfil oficial do Woodstock.\n\n' +
  'O preenchimento deste formulário não significa que o bar realizará publicações antecipadas.';

function instalar() {
  var relatorio = [];

  var ss = garantirPlanilha();
  relatorio.push('Planilha de controle: ' + ss.getUrl());

  var raiz = garantirPastas();
  relatorio.push('Pasta no Drive: https://drive.google.com/drive/folders/' + raiz.getId());

  var form = garantirFormulario(ss);
  relatorio.push('Formulário para as bandas: ' + form.getPublishedUrl());
  relatorio.push('Formulário (para editar): ' + form.getEditUrl());
  relatorio.push(segredo('FORM_TEM_UPLOAD') === 'SIM'
    ? 'Envio de fotos pelo formulário: FUNCIONANDO.'
    : 'ATENÇÃO: esta conta Google não deixa criar campo de envio de arquivo. '
      + 'As bandas não conseguirão anexar fotos pelo formulário.');

  garantirGatilhos(form);
  relatorio.push('Gatilhos criados: resposta do formulário, produção das artes (15 min), ' +
    'publicação (15 min), renovação do token (diária).');

  if (!segredo('API_TOKEN')) {
    definirSegredo('API_TOKEN', Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''));
  }
  relatorio.push('Senha da ponte com o GitHub criada (veja em mostrarTokenDaApi()).');

  registrar('INFO', '', 'INSTALACAO', relatorio.join(' | '));
  var texto = relatorio.join('\n');
  console.log('\n===== INSTALAÇÃO CONCLUÍDA =====\n' + texto);
  return texto;
}

function garantirPlanilha() {
  var id = segredo('PLANILHA_ID');
  var ss;
  if (id) {
    ss = SpreadsheetApp.openById(id);
  } else {
    var ativa = null;
    try { ativa = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { ativa = null; }
    ss = ativa || SpreadsheetApp.create('WOODSTOCK — Controle da Automação');
    definirSegredo('PLANILHA_ID', ss.getId());
  }
  ss.setSpreadsheetTimeZone(TZ);

  var progs = criarAba(ss, ABA.PROGRAMACOES, COL_PROGRAMACOES);
  // Data e hora do show como texto puro: senão a planilha converte "21:00" num
  // valor de hora e devolve uma data de 1899 no lugar do horário.
  progs.getRange(2, COL_PROGRAMACOES.indexOf('DataShow') + 1, 1000, 2).setNumberFormat('@');
  criarAba(ss, ABA.AGENDAMENTOS, COL_AGENDAMENTOS);
  criarAba(ss, ABA.LOGS, COL_LOGS);

  var conf = ss.getSheetByName(ABA.CONFIG);
  if (!conf) {
    conf = criarAba(ss, ABA.CONFIG, ['Chave', 'Valor', 'O que faz']);
    // Texto puro na coluna do valor: sem isso a planilha transforma "08:00" num valor
    // de hora, e o sistema passa a ler uma data de 1899 no lugar do horário.
    conf.getRange(2, 2, 200, 1).setNumberFormat('@');
    conf.getRange(2, 1, CONFIG_PADRAO.length, 3).setValues(CONFIG_PADRAO);
    conf.setColumnWidth(1, 220).setColumnWidth(2, 140).setColumnWidth(3, 620);
  } else {
    var existentes = conf.getDataRange().getValues().map(function (l) { return String(l[0]).trim(); });
    CONFIG_PADRAO.forEach(function (c) {
      if (existentes.indexOf(c[0]) < 0) conf.appendRow(c);
    });
  }

  var padrao = ss.getSheetByName('Sheet1') || ss.getSheetByName('Página1');
  if (padrao && ss.getSheets().length > 1 && padrao.getLastRow() === 0) ss.deleteSheet(padrao);
  return ss;
}

function criarAba(ss, nome, colunas) {
  var s = ss.getSheetByName(nome);
  if (!s) {
    s = ss.insertSheet(nome);
    s.getRange(1, 1, 1, colunas.length).setValues([colunas])
      .setFontWeight('bold').setBackground('#0a0a0a').setFontColor('#ffffff');
    s.setFrozenRows(1);
  }
  return s;
}

function garantirPastas() {
  var id = segredo('PASTA_RAIZ_ID');
  var raiz;
  if (id) {
    raiz = DriveApp.getFolderById(id);
  } else {
    var it = DriveApp.getFoldersByName(NOME_PASTA_RAIZ);
    raiz = it.hasNext() ? it.next() : DriveApp.createFolder(NOME_PASTA_RAIZ);
    definirSegredo('PASTA_RAIZ_ID', raiz.getId());
  }
  var conf = subpasta(raiz, 'CONFIGURACOES');
  subpasta(conf, 'MATERIAIS-ORIGINAIS');
  subpasta(conf, 'AGENDAMENTO');
  subpasta(raiz, 'PROGRAMACOES');
  subpasta(raiz, 'LOGS');
  return raiz;
}

var NOME_FORMULARIO = 'WOODSTOCK ROCK BAR — Cadastro da sua apresentação';

/** Roda algo que pode não existir nesta conta, sem derrubar a instalação. */
function seDerCerto(fn, oque) {
  try {
    fn();
    return true;
  } catch (e) {
    registrar('AVISO', '', 'RECURSO_INDISPONIVEL',
      'Não deu para ' + oque + ' nesta conta Google: ' + e.message);
    return false;
  }
}

/**
 * Manda para a lixeira formulários sem nenhuma resposta que tenham sobrado de uma
 * instalação que falhou no meio. Formulário com resposta nunca é tocado.
 */
function limparFormulariosOrfaos() {
  var atual = segredo('FORM_ID');
  var achados = DriveApp.getFilesByName(NOME_FORMULARIO);
  while (achados.hasNext()) {
    var arq = achados.next();
    if (arq.getId() === atual) continue;
    try {
      if (FormApp.openById(arq.getId()).getResponses().length > 0) continue;
      arq.setTrashed(true);
      registrar('INFO', '', 'FORM_ORFAO_REMOVIDO',
        'Formulário vazio de uma tentativa anterior foi para a lixeira.');
    } catch (e) {
      registrar('AVISO', '', 'FORM_ORFAO', 'Não consegui avaliar ' + arq.getId() + ': ' + e.message);
    }
  }
}

function garantirFormulario(ss) {
  var id = segredo('FORM_ID');
  if (id) {
    try { return FormApp.openById(id); } catch (e) { /* foi apagado: cria de novo */ }
  }
  limparFormulariosOrfaos();
  var form = FormApp.create(NOME_FORMULARIO);
  // Guarda o identificador já: se o resto falhar, a próxima tentativa reaproveita
  // este formulário em vez de deixar um órfão no Drive.
  definirSegredo('FORM_ID', form.getId());

  form.setDescription(
    'Preencha para entrar na programação do Woodstock Rock Bar.\n' +
    'As fotos e a logo serão usadas nas artes de divulgação do show.')
    .setAllowResponseEdits(false)
    .setConfirmationMessage('Recebemos sua inscrição! As artes de divulgação serão produzidas e ' +
      'você será avisado pelo Woodstock. Leia o aviso sobre divulgação que estava no formulário.');

  // Estes dois só existem em conta Google Workspace. Em conta pessoal o Google
  // recusa, e isso não impede nada: o campo de upload já obriga o login sozinho.
  seDerCerto(function () { form.setCollectEmail(true); }, 'coletar e-mail de quem responde');
  seDerCerto(function () { form.setRequireLogin(true); }, 'exigir login');

  form.addTextItem().setTitle('Nome da banda ou artista')
    .setHelpText('Exatamente como deve aparecer na arte.').setRequired(true);

  var tel = form.addTextItem().setTitle('Telefone de contato (WhatsApp)')
    .setHelpText('Com DDD. Exemplo: (62) 99999-9999').setRequired(true);
  tel.setValidation(FormApp.createTextValidation()
    .requireTextMatchesPattern('[^0-9]*([0-9][^0-9]*){10,13}')
    .setHelpText('Informe um telefone com DDD (10 a 13 dígitos).').build());

  form.addDateItem().setTitle('Data do show').setRequired(true);
  form.addTimeItem().setTitle('Horário do show')
    .setHelpText('Horário em que a banda sobe ao palco.').setRequired(true);

  var ig = form.addTextItem().setTitle('@ do Instagram da banda ou artista')
    .setHelpText('Só o @, sem link. Exemplo: @suabanda').setRequired(true);
  ig.setValidation(FormApp.createTextValidation()
    .requireTextMatchesPattern('\\s*@?[A-Za-z0-9._]{1,30}\\s*')
    .setHelpText('Informe apenas o nome de usuário, como @suabanda.').build());

  var temUpload = seDerCerto(function () {
    form.addFileUploadItem().setTitle('Fotos da banda (até 2)')
      .setHelpText('Boa resolução. Se já tiver um PNG recortado com fundo transparente, pode ' +
        'enviar que usamos direto.')
      .setRequired(true)
      .setAllowedFileTypes([FormApp.FileType.IMAGE])
      .setMaxFiles(2)
      .setMaxFileSize(20);

    form.addFileUploadItem().setTitle('Logotipo da banda')
      .setHelpText('Opcional. Sem logo, usamos o nome escrito na arte.')
      .setRequired(false)
      .setAllowedFileTypes([FormApp.FileType.IMAGE])
      .setMaxFiles(1)
      .setMaxFileSize(20);
  }, 'criar os campos de envio de arquivo');

  definirSegredo('FORM_TEM_UPLOAD', temUpload ? 'SIM' : 'NAO');

  form.addSectionHeaderItem()
    .setTitle('INFORMAÇÕES IMPORTANTES SOBRE A DIVULGAÇÃO')
    .setHelpText(TEXTO_INFORMATIVO.replace('INFORMAÇÕES IMPORTANTES SOBRE A DIVULGAÇÃO\n\n', '')
      .replace('o perfil oficial do bar', 'o perfil oficial do bar (' + cfg('PERFIL_OFICIAL') + ')'));

  form.addCheckboxItem().setTitle('Confirmação')
    .setChoiceValues(['Li e entendi as informações sobre a divulgação acima'])
    .setRequired(true);

  seDerCerto(function () {
    form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  }, 'ligar o formulário à planilha de controle');
  return form;
}

function garantirGatilhos(form) {
  var existentes = ScriptApp.getProjectTriggers();
  var nomes = existentes.map(function (t) { return t.getHandlerFunction(); });

  if (nomes.indexOf('aoReceberResposta') < 0) {
    ScriptApp.newTrigger('aoReceberResposta').forForm(form).onFormSubmit().create();
  }
  if (nomes.indexOf('rotinaArtes') < 0) {
    ScriptApp.newTrigger('rotinaArtes').timeBased().everyMinutes(15).create();
  }
  if (nomes.indexOf('rotinaPublicacao') < 0) {
    ScriptApp.newTrigger('rotinaPublicacao').timeBased().everyMinutes(15).create();
  }
  if (nomes.indexOf('rotinaRenovarToken') < 0) {
    ScriptApp.newTrigger('rotinaRenovarToken').timeBased().everyDays(1).atHour(4).create();
  }
}

/**
 * Manda para o seu e-mail os endereços e a chave de acesso.
 * Vai por e-mail de propósito: a chave do painel é secreta e não deve passar por
 * conversa, mensagem nem arquivo de projeto.
 */
function enviarAcessos() {
  var url = ScriptApp.getService().getUrl();
  var form = segredo('FORM_ID') ? FormApp.openById(segredo('FORM_ID')) : null;
  var corpo = [
    'Os acessos do sistema de automação do Woodstock.',
    '',
    'PAINEL (guarde este link; a chave está nele):',
    url ? url + '?chave=' + segredo('API_TOKEN') : '(painel ainda não publicado)',
    '',
    'PLANILHA DE CONTROLE:',
    planilhaControle().getUrl(),
    '',
    'PASTA NO DRIVE:',
    'https://drive.google.com/drive/folders/' + segredo('PASTA_RAIZ_ID'),
    '',
    'LINK PARA AS BANDAS (é este que você divulga):',
    linkDeInscricao() || '(painel ainda não publicado)',
    '',
    form ? 'Formulário antigo do Google (não use; não aceita anexo nesta conta):\n'
      + form.getPublishedUrl() : '',
    '',
    'CHAVE DA PONTE COM O GITHUB (vai ser pedida na próxima etapa):',
    segredo('API_TOKEN'),
    '',
    'Qualquer pessoa com o link do painel entra nele. Não repasse.'
  ].join('\n');

  MailApp.sendEmail({
    to: destinatario(),
    subject: '[Woodstock] Acessos do sistema',
    body: corpo
  });
  return 'Enviado para ' + destinatario();
}

/** Mostra no log o endereço do painel e a senha da ponte com o GitHub. */
function mostrarTokenDaApi() {
  var url = ScriptApp.getService().getUrl();
  console.log('Endereço do painel / da API: ' + (url || '(ainda não publicado — faça Implantar > Nova implantação)'));
  console.log('API_TOKEN (põe no GitHub como segredo APPS_SCRIPT_TOKEN): ' + segredo('API_TOKEN'));
  return 'veja o log';
}

/** Guarda as credenciais do Instagram. Chame uma vez, pelo editor. */
/**
 * Guarda o acesso ao Instagram. Só precisa do token de longa duração: o identificador
 * da conta o próprio sistema descobre, e a renovação não usa chave secreta.
 */
function configurarInstagram(token, idDoNegocio, idDaConta) {
  var t = String(token || '').trim();
  if (idDoNegocio) definirSegredo('BUSINESS_ID', String(idDoNegocio).trim());
  if (t.length < 30) throw new Error('Token vazio ou curto demais.');
  definirSegredo('IG_TOKEN', t);
  var conta = descobrirContaInstagram(idDaConta);
  definirSegredo('IG_TOKEN_RENOVADO_EM', new Date().toISOString());
  registrar('INFO', '', 'CREDENCIAIS_IG', 'Acesso ao Instagram guardado (@' + conta.username + ').');
  return 'Conectado a @' + conta.username + '. A trava PUBLICAR_DE_VERDADE segue em ' +
    cfg('PUBLICAR_DE_VERDADE') + '.';
}

/**
 * Troca a frequência com que o sistema confere a fila de publicação.
 * Fora de teste o normal é 15 minutos; durante um teste rápido, 1 minuto.
 */
function frequenciaDaPublicacao(minutos) {
  var n = Number(minutos) || 15;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'rotinaPublicacao') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('rotinaPublicacao').timeBased().everyMinutes(n).create();
  registrar('INFO', '', 'FREQUENCIA_PUBLICACAO', 'A fila passa a ser conferida a cada ' + n + ' min.');
  return 'Conferindo a fila a cada ' + n + ' minutos.';
}

/** Guarda a credencial que permite ao Google avisar o GitHub na hora. */
function configurarGithub(token, repositorio) {
  definirSegredo('GITHUB_TOKEN', String(token || '').trim());
  definirSegredo('GITHUB_REPO', String(repositorio || '').trim());
  var antes = linhas(ABA.LOGS).length;
  cutucarGithub();
  var depois = linhas(ABA.LOGS);
  var ultimo = depois.length > antes ? String(depois[depois.length - 1].Evento) : '(nada a disparar)';
  registrar('INFO', '', 'CREDENCIAL_GITHUB', 'Credencial do GitHub guardada para ' + repositorio);
  return 'Guardada. Resultado do primeiro aviso: ' + ultimo;
}

/**
 * Dispara a oficina agora, sem esperar ciclo nenhum.
 *
 * Devolve o que REALMENTE aconteceu. A versão antiga respondia "Pedido enviado ao
 * GitHub" sempre, até quando não havia nada na fila e nada era enviado — e aí quem
 * pediu ficava esperando uma execução que nunca ia existir, sem saber por quê.
 */
function dispararOficina() {
  var pendentes = linhas(ABA.PROGRAMACOES).filter(function (p) {
    return p.Situacao === SIT.AGUARDANDO_ARTES;
  }).length;
  if (!pendentes) {
    return 'Nada na fila: nenhuma programação esperando arte, então não chamei a oficina.';
  }
  cutucarGithub();
  return pendentes + ' programação(ões) na fila; a oficina foi chamada.';
}

/**
 * Devolve à fila, na hora, o que estiver travado em produção — sem esperar os 45
 * minutos do vigia. Serve para quando já se sabe que a oficina caiu, em vez de
 * ficar olhando "gerando artes" sem poder fazer nada.
 */
function destravarProducao() {
  var soltas = [];
  linhas(ABA.PROGRAMACOES).forEach(function (p) {
    if (p.Situacao !== SIT.GERANDO_ARTES) return;
    gravarCampos(ABA.PROGRAMACOES, p._linha, {
      Situacao: SIT.AGUARDANDO_ARTES,
      Erro: 'Destravada à mão e devolvida para a fila.'
    });
    registrar('AVISO', p.ID, 'DESTRAVADA_A_MAO', 'Voltou para a fila por pedido.');
    soltas.push(String(p.ID));
  });
  if (soltas.length) cutucarGithub();
  return soltas.length
    ? soltas.length + ' programação(ões) voltaram para a fila: ' + soltas.join(', ')
    : 'Nenhuma programação estava travada em produção.';
}
