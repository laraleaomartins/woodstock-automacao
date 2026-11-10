/**
 * As duas rotinas que rodam sozinhas a cada 15 minutos, nos servidores do Google.
 */

/** Cuida da fila de produção das artes: destrava o que empacou e avisa o GitHub. */
function rotinaArtes() {
  try {
    var limite = Date.now() - 45 * 60000;
    linhas(ABA.PROGRAMACOES).forEach(function (p) {
      if (p.Situacao !== SIT.GERANDO_ARTES) return;
      var desde = p.AtualizadoEm ? new Date(p.AtualizadoEm).getTime() : 0;
      if (desde < limite) {
        // Quantas vezes esta programação já travou. Travar uma vez é azar — a
        // oficina do GitHub pode ser interrompida no meio. Travar várias é defeito,
        // e ficar tentando em silêncio deixa você olhando "gerando artes" sem
        // saber de nada, que foi exatamente o que aconteceu.
        var tentativas = Number(String(p.Avisos || '').match(/travou (\d+)x/) ?
          String(p.Avisos).match(/travou (\d+)x/)[1] : 0) + 1;
        var avisos = String(p.Avisos || '').replace(/ ?\| ?travou \d+x/, '') +
          ' | travou ' + tentativas + 'x';

        gravarCampos(ABA.PROGRAMACOES, p._linha, {
          Situacao: SIT.AGUARDANDO_ARTES,
          Erro: 'A produção travou e voltou para a fila (' + tentativas + 'ª vez).',
          Avisos: avisos.replace(/^ \| /, '').slice(0, 900)
        });
        registrar('AVISO', p.ID, 'ARTES_DESTRAVADAS',
          'Passou de 45 min em produção; voltou para a fila (' + tentativas + 'ª vez).');

        if (tentativas >= 2) {
          notificar('A produção das artes está travando: ' + p.Banda,
            'As artes de ' + p.Banda + ' já travaram ' + tentativas + ' vezes na oficina.\n\n' +
            'A programação volta para a fila sozinha a cada 45 minutos, então ela não se ' +
            'perde — mas, se isso continuar, as artes não vão sair e vale olhar as ' +
            'execuções em\nhttps://github.com/' + (segredo('GITHUB_REPO') || '') + '/actions\n\n' +
            'O motivo mais comum é a oficina ser interrompida no meio do trabalho.\n\n' +
            linkPainel(), p.ID);
        }
      }
    });
    cutucarGithub();
  } catch (e) {
    registrar('ERRO', '', 'ROTINA_ARTES', e.message);
  }
}

/**
 * Avisa o GitHub que tem trabalho, para não esperar o ciclo dele.
 * É opcional: sem o token configurado, o GitHub descobre sozinho no próximo ciclo.
 */
function cutucarGithub() {
  var token = segredo('GITHUB_TOKEN');
  var repo = segredo('GITHUB_REPO');
  if (!token || !repo) return;
  var pendentes = linhas(ABA.PROGRAMACOES).filter(function (p) {
    return p.Situacao === SIT.AGUARDANDO_ARTES;
  });
  if (!pendentes.length) return;
  try {
    // Dispara o fluxo pelo endereço de "workflow dispatch": a credencial precisa
    // apenas de permissão de Actions, sem poder ler nem alterar o código.
    var resp = UrlFetchApp.fetch(
      'https://api.github.com/repos/' + repo + '/actions/workflows/artes.yml/dispatches', {
        method: 'post',
        contentType: 'application/json',
        muteHttpExceptions: true,
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' },
        payload: JSON.stringify({ ref: 'main' })
      });
    if (resp.getResponseCode() >= 300) {
      throw new Error('o GitHub respondeu ' + resp.getResponseCode() + ': ' +
        limparSegredos(resp.getContentText()).slice(0, 200));
    }
    registrar('INFO', '', 'GITHUB_AVISADO',
      pendentes.length + ' programação(ões) esperando arte; produção disparada na hora.');
  } catch (e) {
    // Não é grave: sem o aviso, o ciclo do GitHub pega no próximo giro.
    registrar('AVISO', '', 'GITHUB_NAO_AVISADO', e.message);
  }
}

/** Publica tudo que venceu. */
function rotinaPublicacao() {
  try {
    comTrava('rotinaPublicacao', publicarVencidos);
  } catch (e) {
    registrar('ERRO', '', 'ROTINA_PUBLICACAO', e.message);
  }
}

function publicarVencidos() {
  var agora = Date.now();
  var maxTentativas = cfgNum('MAX_TENTATIVAS') || 3;
  var vencidos = linhas(ABA.AGENDAMENTOS).filter(function (a) {
    return a.Situacao === SIT_POST.AGENDADO && new Date(a.QuandoISO).getTime() <= agora;
  }).sort(function (x, y) {
    return new Date(x.QuandoISO) - new Date(y.QuandoISO);
  });

  if (!vencidos.length) return 0;

  var cota = cotaRestante();
  var publicados = 0;

  for (var i = 0; i < vencidos.length; i++) {
    var post = vencidos[i];

    if (programacaoBloqueada(post.ProgramacaoId)) {
      gravarCampo(ABA.AGENDAMENTOS, post._linha, 'Situacao', SIT_POST.PAUSADO);
      continue;
    }
    if (cota && cota.resta - publicados <= 0) {
      registrar('AVISO', post.ProgramacaoId, 'COTA_ESGOTADA',
        'O Instagram já recebeu o máximo de publicações nas últimas 24h. O resto sai depois.');
      break;
    }

    try {
      var r = publicarPeca(post);
      gravarCampos(ABA.AGENDAMENTOS, post._linha, {
        Situacao: SIT_POST.PUBLICADO,
        IgMediaId: r.id,
        Erro: r.simulado ? 'SIMULADO (trava PUBLICAR_DE_VERDADE está em NAO)' : ''
      });
      publicados++;
      registrar('INFO', post.ProgramacaoId, r.simulado ? 'PUBLICADO_SIMULADO' : 'PUBLICADO',
        post.Canal + ' opção ' + post.Opcao + ' | id ' + r.id);
    } catch (e) {
      var tentativas = Number(post.Tentativas || 0) + 1;
      var desistiu = tentativas >= maxTentativas;
      gravarCampos(ABA.AGENDAMENTOS, post._linha, {
        Tentativas: tentativas,
        Situacao: desistiu ? SIT_POST.FALHA : SIT_POST.AGENDADO,
        QuandoISO: desistiu ? post.QuandoISO :
          new Date(Date.now() + 30 * 60000).toISOString(),
        Erro: String(e.message).slice(0, 900)
      });
      registrar('ERRO', post.ProgramacaoId, desistiu ? 'PUBLICACAO_FALHOU' : 'PUBLICACAO_VAI_TENTAR_DE_NOVO',
        post.Canal + ' ' + post.Opcao + ' | tentativa ' + tentativas + ' | ' + e.message);
      if (desistiu) {
        notificar('Uma publicação falhou: ' + post.Banda,
          'Não consegui publicar esta peça depois de ' + tentativas + ' tentativas.\n\n' +
          'Banda: ' + post.Banda + '\n' +
          'Peça: ' + (post.Canal === 'FEED' ? 'feed' : 'story') + ', opção ' + post.Opcao + '\n' +
          'Horário previsto: ' + fmt(new Date(post.QuandoISO), 'dd/MM/yyyy HH:mm') + '\n' +
          'Motivo: ' + e.message + '\n\n' +
          'A arte está pronta e pode ser publicada à mão. ' + linkPainel(),
          post.ProgramacaoId);
      }
    }
  }

  fecharProgramacoesConcluidas();
  return publicados;
}

function programacaoBloqueada(programacaoId) {
  var prog = acharProgramacao(programacaoId);
  if (!prog) return true;
  return [SIT.PAUSADA, SIT.CANCELADA, SIT.REPROVADA, SIT.AGUARDANDO_APROVACAO]
    .indexOf(prog.Situacao) >= 0;
}

function fecharProgramacoesConcluidas() {
  var porPrograma = {};
  linhas(ABA.AGENDAMENTOS).forEach(function (a) {
    (porPrograma[a.ProgramacaoId] = porPrograma[a.ProgramacaoId] || []).push(a.Situacao);
  });
  linhas(ABA.PROGRAMACOES).forEach(function (p) {
    if (p.Situacao !== SIT.AGENDADA) return;
    var sits = porPrograma[p.ID] || [];
    if (!sits.length) return;
    var pendente = sits.some(function (s) {
      return s === SIT_POST.AGENDADO || s === SIT_POST.PAUSADO;
    });
    if (!pendente) {
      gravarCampo(ABA.PROGRAMACOES, p._linha, 'Situacao', SIT.CONCLUIDA);
      registrar('INFO', p.ID, 'CONCLUIDA', 'Todas as publicações desta programação saíram da fila.');
    }
  });
}

/**
 * Chamado quando o GitHub termina as artes. Daqui em diante é tudo decidido pelo
 * modo de operação da programação.
 */
function registrarArtesProntas(programacaoId, artes, avisos) {
  return comTrava('artesProntas', function () {
    var prog = acharProgramacao(programacaoId);
    if (!prog) throw new Error('Programação não encontrada: ' + programacaoId);

    var totalFeed = Object.keys(artes.FEED || {}).length;
    var totalStory = Object.keys(artes.STORY || {}).length;
    if (!totalFeed && !totalStory) throw new Error('Vieram zero artes.');

    salvarArtesNoDrive(prog, artes);
    var legendas = salvarLegendas(prog, montarLegendas(prog));

    // Mantém a lista dos arquivos recebidos, senão não dá para refazer as artes depois.
    var anterior = {};
    try { anterior = JSON.parse(prog.Artes || '{}'); } catch (x) { anterior = {}; }
    if (anterior.recebidos) artes.recebidos = anterior.recebidos;

    gravarCampos(ABA.PROGRAMACOES, prog._linha, {
      Avisos: (avisos || []).join(' | ').slice(0, 900),
      Artes: JSON.stringify(artes),
      Legendas: JSON.stringify(legendas),
      Erro: ''
    });
    registrar('INFO', prog.ID, 'ARTES_PRONTAS', totalFeed + ' de feed e ' + totalStory + ' de story.');

    var progAtual = acharProgramacao(programacaoId);
    var modo = String(prog.Modo || cfg('MODO_OPERACAO')).toUpperCase();

    if (modo === 'AUTOMATICO') {
      agendarProgramacao(progAtual, artes, legendas);
      mudarSituacao(programacaoId, SIT.AGENDADA);
      notificar('Artes prontas e já agendadas: ' + prog.Banda,
        resumoDasArtes(prog, totalFeed, totalStory, avisos) +
        '\nComo o modo está AUTOMÁTICO, as publicações já entraram no calendário.\n\n' +
        linkPainel(), programacaoId);
    } else {
      mudarSituacao(programacaoId, SIT.AGUARDANDO_APROVACAO);
      notificar('Artes prontas, esperando sua aprovação: ' + prog.Banda,
        resumoDasArtes(prog, totalFeed, totalStory, avisos) +
        '\nNada será publicado enquanto você não aprovar.\n\n' + linkPainel(), programacaoId);
    }
    return { feed: totalFeed, story: totalStory };
  });
}

function resumoDasArtes(prog, totalFeed, totalStory, avisos) {
  var alerta = (avisos && avisos.length)
    ? 'ATENÇÃO, confira a arte antes de aprovar:\n  - ' + avisos.join('\n  - ') + '\n\n'
    : '';
  return 'As artes de ' + prog.Banda + ' ficaram prontas.\n\n' + alerta +
    'Show: ' + fmt(paraData(prog.DataShow), 'dd/MM/yyyy') + ' às ' + horaTexto(prog.HoraShow) + '\n' +
    'Peças: ' + totalFeed + ' para o feed e ' + totalStory + ' para stories.\n\n';
}

function salvarArtesNoDrive(prog, artes) {
  var pasta = DriveApp.getFolderById(prog.PastaId);
  var destinos = { FEED: subpasta(pasta, 'ARTES-FEED'), STORY: subpasta(pasta, 'ARTES-STORIES') };
  ['FEED', 'STORY'].forEach(function (canal) {
    Object.keys(artes[canal] || {}).forEach(function (opcao) {
      var url = artes[canal][opcao];
      var nome = prog.ID + '_OPCAO-' + opcao + '_' + (canal === 'FEED' ? 'feed' : 'story') + '.jpg';
      try {
        var antigos = destinos[canal].getFilesByName(nome);
        while (antigos.hasNext()) antigos.next().setTrashed(true);
        var blob = UrlFetchApp.fetch(url, { muteHttpExceptions: true }).getBlob().setName(nome);
        destinos[canal].createFile(blob);
      } catch (e) {
        registrar('AVISO', prog.ID, 'COPIA_ARTE', 'Não consegui copiar ' + nome + ' para o Drive: ' + e.message);
      }
    });
  });
}

/** Aprovação pelo painel. */
/**
 * Separa as peças marcadas para publicação das que ficam de fora.
 *
 * `escolhidas` é uma lista no formato "FEED:A", "STORY:C". Lista vazia quer dizer
 * "todas" — é o caminho normal, e é como a aprovação funcionava antes de existir
 * escolha. O resto do conteúdo das artes (a lista de arquivos recebidos, por
 * exemplo) é preservado, senão refazer as artes depois deixaria de funcionar.
 */
function somenteAsPecas(artes, escolhidas) {
  var lista = [].concat(escolhidas || []).filter(function (c) { return String(c).trim(); });
  if (!lista.length) return { usadas: artes, deixadas: [] };

  var marcadas = {};
  lista.forEach(function (c) { marcadas[String(c).toUpperCase()] = true; });

  var usadas = {};
  var deixadas = [];
  Object.keys(artes).forEach(function (k) {
    if (k !== 'FEED' && k !== 'STORY') usadas[k] = artes[k];
  });
  ['FEED', 'STORY'].forEach(function (canal) {
    usadas[canal] = {};
    Object.keys(artes[canal] || {}).forEach(function (opcao) {
      if (marcadas[canal + ':' + opcao]) {
        usadas[canal][opcao] = artes[canal][opcao];
      } else {
        deixadas.push((canal === 'FEED' ? 'publicação' : 'story') + ' ' + opcao);
      }
    });
  });
  return { usadas: usadas, deixadas: deixadas };
}

function quantasPecas(artes) {
  return Object.keys(artes.FEED || {}).length + Object.keys(artes.STORY || {}).length;
}

/**
 * Aprova a programação. Com `escolhidas`, publica só as peças marcadas.
 *
 * Existe para o caso em que uma das seis peças saiu torta: antes, reprovar era
 * tudo ou nada, e uma arte ruim derrubava as outras cinco junto. As que ficam de
 * fora são registradas, para depois dar para saber o que não foi publicado e por quê.
 */
function aprovarProgramacao(programacaoId, escolhidas) {
  return comTrava('aprovar', function () {
    var prog = acharProgramacao(programacaoId);
    if (!prog) throw new Error('Programação não encontrada.');
    if (prog.Situacao !== SIT.AGUARDANDO_APROVACAO) {
      throw new Error('Esta programação não está esperando aprovação (está em ' + prog.Situacao + ').');
    }
    var artes = JSON.parse(prog.Artes || '{}');
    var legendas = JSON.parse(prog.Legendas || '{}');

    var escolha = somenteAsPecas(artes, escolhidas);
    if (!quantasPecas(escolha.usadas)) {
      throw new Error('Nenhuma peça foi marcada para publicar. Marque pelo menos uma, ' +
        'ou use Reprovar se nenhuma serve.');
    }

    var postos = agendarProgramacao(prog, escolha.usadas, legendas);
    mudarSituacao(programacaoId, SIT.AGENDADA);

    var recado = postos.length + ' publicações agendadas.';
    if (escolha.deixadas.length) {
      recado += ' Fora: ' + escolha.deixadas.join(', ') + '.';
      gravarCampos(ABA.PROGRAMACOES, prog._linha, {
        Avisos: (String(prog.Avisos || '') + ' | não publicadas por escolha sua: ' +
          escolha.deixadas.join(', ')).slice(0, 900)
      });
    }
    registrar('INFO', programacaoId, 'APROVADA', recado);
    notificar('Agendamento criado: ' + prog.Banda,
      'Você aprovou as artes de ' + prog.Banda + ' e ' + postos.length +
      ' publicações entraram no calendário.\n\n' +
      (escolha.deixadas.length
        ? 'Ficaram de fora, porque você não marcou: ' + escolha.deixadas.join(', ') + '.\n\n'
        : '') +
      listaDeHorarios(postos) + '\n' + linkPainel(),
      programacaoId);
    return postos.length;
  });
}

function reprovarProgramacao(programacaoId, motivo) {
  cancelarAgendamentos(programacaoId, SIT_POST.CANCELADO);
  mudarSituacao(programacaoId, SIT.REPROVADA, motivo || '');
  registrar('INFO', programacaoId, 'REPROVADA', motivo || '');
  return true;
}

/** Manda produzir as artes de novo (depois de reprovar, por exemplo). */
/**
 * Manda refazer as artes, tentando um caminho diferente do anterior.
 *
 * Repetir o mesmo cálculo devolveria a mesma arte: o recorte é determinístico. Por
 * isso cada pedido de refazer anda um número, e a oficina usa esse número para
 * trocar a decisão com mais chance de ter sido a culpada — inverter o recortar,
 * trocar de recortador, usar a foto inteira. Sem isso, o botão seria mentira.
 *
 * `peca` é opcional, no formato "FEED:A". Serve para registrar QUAL arte
 * desagradou; as seis são refeitas de todo modo, porque saem todas do mesmo
 * tratamento das fotos — não existe refazer uma sem refazer o tratamento.
 */
function refazerArtes(programacaoId, peca, manterCaminho) {
  var prog = acharProgramacao(programacaoId);
  if (!prog) throw new Error('Programação não encontrada.');

  var artes = {};
  try { artes = JSON.parse(prog.Artes || '{}'); } catch (x) { artes = {}; }
  var recebidos = artes.recebidos || {};
  // Normalmente refazer anda um número, para tentar um tratamento diferente — o
  // recorte é determinístico e repetir devolveria a mesma arte. Mas quando o que
  // mudou foi o PRÓPRIO sistema, é o mesmo caminho que se quer de volta, agora com
  // o defeito corrigido; andar o número aqui trocaria o tratamento sem motivo.
  var tentativa = Number(recebidos.tentativa || 1) + (manterCaminho ? 0 : 1);
  recebidos.tentativa = tentativa;
  if (peca) recebidos.ultimaPecaRuim = String(peca);

  gravarCampos(ABA.PROGRAMACOES, prog._linha,
    { Artes: JSON.stringify({ recebidos: recebidos }) });

  cancelarAgendamentos(programacaoId, SIT_POST.CANCELADO);
  mudarSituacao(programacaoId, SIT.AGUARDANDO_ARTES, '');
  registrar('INFO', programacaoId, 'REFAZER_ARTES',
    'Tentativa ' + tentativa + (peca ? ' (pedido a partir da ' + peca + ')' : '') +
    '; voltou para a fila.');
  cutucarGithub();
  return tentativa;
}

function listaDeHorarios(postos) {
  return postos.map(function (p) {
    return '  ' + fmt(p.quando, 'dd/MM HH:mm') + '  ' +
      (p.canal === 'FEED' ? 'feed ' : 'story') + '  opção ' + p.opcao;
  }).join('\n');
}
