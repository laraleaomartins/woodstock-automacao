/**
 * Avisos por e-mail. Usa o e-mail da própria conta Google — não custa nada e não
 * depende de nenhum serviço externo.
 * Cota gratuita: 100 e-mails por dia, muito acima do que este sistema usa.
 */

function destinatario() {
  return cfg('EMAIL_NOTIFICACAO') || Session.getEffectiveUser().getEmail();
}

/**
 * Manda o aviso. A mesma mensagem não sai duas vezes no mesmo dia — é o que impede
 * notificação repetida quando uma rotina roda várias vezes.
 */
function notificar(assunto, corpo, programacaoId) {
  // A impressão digital inclui o corpo: dois problemas diferentes com o mesmo título
  // são dois avisos, e não um só.
  var chave = 'notif_' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.MD5,
      assunto + '|' + (programacaoId || '') + '|' + corpo + '|' +
      fmt(new Date(), 'yyyy-MM-dd'))).slice(0, 200);
  var cache = CacheService.getScriptCache();
  if (cache.get(chave)) {
    registrar('INFO', programacaoId, 'NOTIFICACAO_REPETIDA', assunto);
    return false;
  }
  cache.put(chave, '1', 21600);

  try {
    MailApp.sendEmail({
      to: destinatario(),
      subject: '[Woodstock] ' + assunto,
      body: limparSegredos(corpo) + '\n\n--\nAutomação Woodstock'
    });
    registrar('INFO', programacaoId, 'NOTIFICADO', assunto);
    return true;
  } catch (e) {
    registrar('ERRO', programacaoId, 'NOTIFICACAO_FALHOU', e.message);
    return false;
  }
}

function avisarFalhaInterna(assunto, detalhe) {
  notificar(assunto, 'Deu problema numa parte automática do sistema.\n\n' + detalhe +
    '\n\nNada foi publicado por causa disso.', '');
}

/** Quando a API não deixa convidar a banda como colaboradora, o convite vira tarefa manual. */
function avisarColabManual(post) {
  var prog = acharProgramacao(post.ProgramacaoId);
  notificar('Convide a banda como colaboradora: ' + post.Banda,
    'O post de feed de ' + post.Banda + ' foi publicado, mas o convite de colaboração ' +
    '(o "Collab") não pôde ser enviado automaticamente.\n\n' +
    'Para fazer à mão: abra o post no Instagram, toque nos três pontinhos, Editar, ' +
    'Marcar pessoas, Convidar colaborador, e informe ' +
    (prog ? prog.InstagramBanda : 'o perfil da banda') + '.\n\n' +
    'Isso leva uns 20 segundos e faz o post aparecer também no perfil da banda.',
    post.ProgramacaoId);
}

/** Resumo diário do que está por vir — opcional, ligue criando o gatilho se quiser. */
function resumoDiario() {
  var agora = Date.now();
  var proximas = linhas(ABA.AGENDAMENTOS).filter(function (a) {
    var t = new Date(a.QuandoISO).getTime();
    return a.Situacao === SIT_POST.AGENDADO && t > agora && t < agora + 24 * 3600000;
  }).sort(function (x, y) { return new Date(x.QuandoISO) - new Date(y.QuandoISO); });

  var pendentes = linhas(ABA.PROGRAMACOES).filter(function (p) {
    return p.Situacao === SIT.AGUARDANDO_APROVACAO;
  });

  if (!proximas.length && !pendentes.length) return;

  var corpo = [];
  if (pendentes.length) {
    corpo.push('ESPERANDO SUA APROVAÇÃO (' + pendentes.length + '):');
    pendentes.forEach(function (p) {
      corpo.push('  ' + p.Banda + ' — show em ' + fmt(paraData(p.DataShow), 'dd/MM'));
    });
    corpo.push('');
  }
  if (proximas.length) {
    corpo.push('VAI AO AR NAS PRÓXIMAS 24 HORAS (' + proximas.length + '):');
    proximas.forEach(function (a) {
      corpo.push('  ' + fmt(new Date(a.QuandoISO), 'dd/MM HH:mm') + '  ' +
        (a.Canal === 'FEED' ? 'feed ' : 'story') + '  ' + a.Banda + '  opção ' + a.Opcao);
    });
  }
  corpo.push('', linkPainel());
  notificar('Resumo do dia', corpo.join('\n'), '');
}
