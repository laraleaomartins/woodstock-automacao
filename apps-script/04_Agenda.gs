/**
 * Montagem do calendário de publicação.
 *
 * A régua: a divulgação começa ANTECEDENCIA_DIAS antes do show, só dentro da janela
 * HORARIO_INICIAL–HORARIO_LIMITE, com INTERVALO_*_HORAS entre um post e o seguinte, e
 * nunca depois da hora em que o show começa. Feed e stories têm intervalos próprios e
 * são contados separadamente.
 */

function agendarProgramacao(prog, artes, legendas) {
  var data = paraData(prog.DataShow);
  var horaShow = paraHora(prog.HoraShow);
  var inicioShow = instante(data, horaShow);

  var limiteFinal = cfgSim('NAO_PUBLICAR_APOS_SHOW') ? inicioShow : fimDoDia(data);
  var primeiro = new Date(data.getTime());
  primeiro.setDate(primeiro.getDate() - cfgNum('ANTECEDENCIA_DIAS'));
  primeiro = aplicarJanela(instante(primeiro, paraHora(cfg('HORARIO_INICIAL'))));

  var agora = new Date();
  if (primeiro.getTime() < agora.getTime()) {
    primeiro = aplicarJanela(new Date(agora.getTime() + 10 * 60000));
  }

  var ocupados = horariosJaOcupados();
  // Identificadores já usados. Sem isto, recalcular criaria peças com o mesmo
  // identificador das antigas, e cancelar ou adiantar acertaria a linha errada.
  var usados = {};
  linhas(ABA.AGENDAMENTOS).forEach(function (a) { usados[String(a.PostId)] = true; });

  var postos = [];
  if (cfgSim('FEED_ATIVO')) {
    postos = postos.concat(distribuir(prog, artes, legendas, 'FEED',
      primeiro, cfgNum('INTERVALO_FEED_HORAS'), limiteFinal, ocupados, usados));
  }
  if (cfgSim('STORIES_ATIVO')) {
    postos = postos.concat(distribuir(prog, artes, legendas, 'STORY',
      primeiro, cfgNum('INTERVALO_STORIES_HORAS'), limiteFinal, ocupados, usados));
  }

  if (!postos.length) {
    registrar('AVISO', prog.ID, 'SEM_JANELA',
      'Não sobrou horário válido entre agora e o início do show (' +
      fmt(inicioShow, 'dd/MM HH:mm') + '). Nada foi agendado.');
    return [];
  }

  var planilha = aba(ABA.AGENDAMENTOS);
  postos.forEach(function (p) {
    planilha.appendRow([p.postId, prog.ID, prog.Banda, p.canal, p.opcao, p.url, p.legenda,
      p.quando.toISOString(), SIT_POST.AGENDADO, '', 0, '', new Date()]);
  });

  salvarResumoAgenda(prog, postos);
  registrar('INFO', prog.ID, 'AGENDADO', postos.length + ' publicações entre ' +
    fmt(postos[0].quando, 'dd/MM HH:mm') + ' e ' +
    fmt(postos[postos.length - 1].quando, 'dd/MM HH:mm'));
  return postos;
}

/** Espalha as 3 opções (A, B, C) de um canal pela janela disponível. */
function distribuir(prog, artes, legendas, canal, inicio, intervaloHoras, limiteFinal, ocupados, usados) {
  var saida = [];
  var quando = new Date(inicio.getTime());
  ['A', 'B', 'C'].forEach(function (opcao) {
    var url = (artes[canal] || {})[opcao];
    if (!url) return;
    quando = aplicarJanela(quando);
    quando = evitarColisao(quando, canal, ocupados);
    if (quando.getTime() > limiteFinal.getTime()) return;
    ocupados.push({ canal: canal, ts: quando.getTime() });
    saida.push({
      postId: identificadorLivre(prog.ID + '_' + canal + '_' + opcao, usados || {}),
      canal: canal,
      opcao: opcao,
      url: url,
      legenda: canal === 'FEED' ? legendas[opcao] : '',
      quando: new Date(quando.getTime())
    });
    quando = new Date(quando.getTime() + intervaloHoras * 3600000);
  });
  return saida;
}

/** Empurra para dentro do horário permitido do dia. */
function aplicarJanela(d) {
  var ini = paraHora(cfg('HORARIO_INICIAL'));
  var fim = paraHora(cfg('HORARIO_LIMITE'));
  var r = new Date(d.getTime());
  var minutos = r.getHours() * 60 + r.getMinutes();
  var minIni = ini.h * 60 + ini.min;
  var minFim = fim.h * 60 + fim.min;
  if (minutos < minIni) {
    r.setHours(ini.h, ini.min, 0, 0);
  } else if (minutos > minFim) {
    r.setDate(r.getDate() + 1);
    r.setHours(ini.h, ini.min, 0, 0);
  }
  r.setSeconds(0, 0);
  return r;
}

/** Dois posts do mesmo canal nunca saem no mesmo minuto. */
function evitarColisao(quando, canal, ocupados) {
  var r = new Date(quando.getTime());
  for (var tentativa = 0; tentativa < 48; tentativa++) {
    var choque = ocupados.some(function (o) {
      return o.canal === canal && Math.abs(o.ts - r.getTime()) < 15 * 60000;
    });
    if (!choque) return r;
    r = aplicarJanela(new Date(r.getTime() + 20 * 60000));
  }
  return r;
}

function horariosJaOcupados() {
  return linhas(ABA.AGENDAMENTOS)
    .filter(function (a) { return a.Situacao === SIT_POST.AGENDADO; })
    .map(function (a) { return { canal: a.Canal, ts: new Date(a.QuandoISO).getTime() }; });
}

function fimDoDia(data) {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate(), 23, 59, 0, 0);
}

function salvarResumoAgenda(prog, postos) {
  var pasta = subpasta(DriveApp.getFolderById(prog.PastaId), 'AGENDAMENTOS');
  var linhasTexto = ['AGENDAMENTO — ' + prog.Banda, 'Gerado em ' + fmt(new Date(), 'dd/MM/yyyy HH:mm'), ''];
  postos.forEach(function (p) {
    linhasTexto.push(fmt(p.quando, 'dd/MM/yyyy HH:mm') + '  ' + p.canal + '  opção ' + p.opcao +
      '  ' + p.postId);
  });
  var nome = 'agendamento_' + prog.ID + '.txt';
  var antigos = pasta.getFilesByName(nome);
  while (antigos.hasNext()) antigos.next().setTrashed(true);
  pasta.createFile(nome, linhasTexto.join('\n'), MimeType.PLAIN_TEXT);
}

// ---------- operações do painel ----------

function cancelarAgendamentos(programacaoId, novaSituacao) {
  var alterados = 0;
  linhas(ABA.AGENDAMENTOS).forEach(function (a) {
    if (String(a.ProgramacaoId) !== String(programacaoId)) return;
    if (a.Situacao !== SIT_POST.AGENDADO && a.Situacao !== SIT_POST.PAUSADO) return;
    gravarCampo(ABA.AGENDAMENTOS, a._linha, 'Situacao', novaSituacao);
    alterados++;
  });
  return alterados;
}

function pausarProgramacao(programacaoId) {
  var n = cancelarAgendamentos(programacaoId, SIT_POST.PAUSADO);
  mudarSituacao(programacaoId, SIT.PAUSADA);
  registrar('INFO', programacaoId, 'PAUSADA', n + ' publicações pausadas.');
  return n;
}

function retomarProgramacao(programacaoId) {
  var n = 0;
  var agora = Date.now();
  linhas(ABA.AGENDAMENTOS).forEach(function (a) {
    if (String(a.ProgramacaoId) !== String(programacaoId) || a.Situacao !== SIT_POST.PAUSADO) return;
    var atrasado = new Date(a.QuandoISO).getTime() < agora;
    gravarCampos(ABA.AGENDAMENTOS, a._linha, {
      Situacao: SIT_POST.AGENDADO,
      QuandoISO: atrasado ? aplicarJanela(new Date(agora + 10 * 60000)).toISOString() : a.QuandoISO
    });
    n++;
  });
  mudarSituacao(programacaoId, SIT.AGENDADA);
  registrar('INFO', programacaoId, 'RETOMADA', n + ' publicações retomadas.');
  return n;
}

function cancelarProgramacao(programacaoId) {
  var n = cancelarAgendamentos(programacaoId, SIT_POST.CANCELADO);
  mudarSituacao(programacaoId, SIT.CANCELADA);
  registrar('INFO', programacaoId, 'CANCELADA', n + ' publicações canceladas.');
  notificar('Programação cancelada: ' + programacaoId,
    'A programação ' + programacaoId + ' foi cancelada e ' + n +
    ' publicações que estavam na fila foram retiradas.', programacaoId);
  return n;
}

/** Refaz o calendário do zero — usado quando mudam intervalos ou a data do show. */
function recalcularProgramacao(programacaoId) {
  return comTrava('recalcular', function () {
    var prog = acharProgramacao(programacaoId);
    if (!prog) throw new Error('Programação não encontrada: ' + programacaoId);
    var publicados = linhas(ABA.AGENDAMENTOS).filter(function (a) {
      return String(a.ProgramacaoId) === String(programacaoId) && a.Situacao === SIT_POST.PUBLICADO;
    }).map(function (a) { return a.Canal + '_' + a.Opcao; });

    cancelarAgendamentos(programacaoId, SIT_POST.CANCELADO);

    var artes = JSON.parse(prog.Artes || '{}');
    if (!artes.FEED && !artes.STORY) throw new Error('Esta programação ainda não tem artes.');
    // O que já foi ao ar não entra de novo.
    ['FEED', 'STORY'].forEach(function (canal) {
      if (!artes[canal]) return;
      Object.keys(artes[canal]).forEach(function (op) {
        if (publicados.indexOf(canal + '_' + op) >= 0) delete artes[canal][op];
      });
    });

    var legendas = JSON.parse(prog.Legendas || '{}');
    if (!legendas.A) legendas = salvarLegendas(prog, montarLegendas(prog));
    var postos = agendarProgramacao(prog, artes, legendas);
    mudarSituacao(programacaoId, postos.length ? SIT.AGENDADA : SIT.CONCLUIDA);
    return postos.length;
  });
}

/** Muda a data ou a hora do show e refaz o calendário. */
function alterarShow(programacaoId, novaData, novaHora) {
  var prog = acharProgramacao(programacaoId);
  if (!prog) throw new Error('Programação não encontrada: ' + programacaoId);
  var campos = {};
  if (novaData) {
    var d = paraData(novaData);
    campos.DataShow = fmt(d, 'yyyy-MM-dd');
    campos.DiaSemana = DIAS_SEMANA[d.getDay()];
  }
  if (novaHora) {
    var h = paraHora(novaHora);
    campos.HoraShow = pad2(h.h) + ':' + pad2(h.min);
  }
  gravarCampos(ABA.PROGRAMACOES, prog._linha, campos);
  registrar('INFO', programacaoId, 'SHOW_ALTERADO', JSON.stringify(campos));
  return recalcularProgramacao(programacaoId);
}

function acharProgramacao(id) {
  return linhas(ABA.PROGRAMACOES).filter(function (p) {
    return String(p.ID) === String(id);
  })[0] || null;
}

function mudarSituacao(programacaoId, situacao, erro) {
  var prog = acharProgramacao(programacaoId);
  if (!prog) return false;
  var campos = { Situacao: situacao };
  if (erro !== undefined) campos.Erro = String(erro).slice(0, 900);
  gravarCampos(ABA.PROGRAMACOES, prog._linha, campos);
  return true;
}

/** Puxa uma publicação para agora. Usado no teste de publicação real. */
function adiantarPost(postId) {
  var post = acharPost(postId);
  if (!post) throw new Error('Publicação não encontrada: ' + postId);
  gravarCampos(ABA.AGENDAMENTOS, post._linha, {
    QuandoISO: new Date(Date.now() - 60000).toISOString(),
    Situacao: SIT_POST.AGENDADO
  });
  registrar('INFO', post.ProgramacaoId, 'POST_ADIANTADO', postId);
  return true;
}

/** Garante identificador único de publicação; na 2ª vez vira ..._r2, depois _r3. */
function identificadorLivre(base, usados) {
  if (!usados[base]) { usados[base] = true; return base; }
  for (var n = 2; n < 200; n++) {
    if (!usados[base + '_r' + n]) { usados[base + '_r' + n] = true; return base + '_r' + n; }
  }
  return base + '_' + Date.now();
}

/**
 * Acha a linha de uma publicação. Havendo mais de uma com o mesmo identificador
 * (agendamentos antigos de antes da correção), prefere a que ainda está ativa.
 */
function acharPost(postId) {
  var iguais = linhas(ABA.AGENDAMENTOS).filter(function (a) {
    return String(a.PostId) === String(postId);
  });
  if (!iguais.length) return null;
  var ativa = iguais.filter(function (a) {
    return a.Situacao === SIT_POST.AGENDADO || a.Situacao === SIT_POST.PAUSADO;
  });
  return ativa.length ? ativa[ativa.length - 1] : iguais[iguais.length - 1];
}
