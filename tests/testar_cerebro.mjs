/**
 * Testes do cérebro do sistema, rodando contra o simulador do ambiente Google.
 *
 * Cada teste comprova um resultado, não só que o código rodou sem erro.
 * uso: node tests/testar_cerebro.mjs
 */

import { criarAmbiente } from './ambiente_falso.mjs';

let passou = 0, falhou = 0;
const casos = [];
function teste(nome, fn) { casos.push({ nome, fn }); }
function conferir(condicao, oque) {
  if (condicao) { passou++; console.log('   ok   ' + oque); }
  else { falhou++; console.log('   FALHA ' + oque); }
}

/** Monta uma resposta de formulário de mentira. */
function respostaFalsa(ctx, estado, { banda, data, hora = '20:00', fotos = 2, logo = true,
  telefone = '(62) 99999-1234', instagram = '@banda', id = 'resp-' + Math.random() }) {
  const criarArquivo = (nome) => {
    const fid = 'arq-' + nome + '-' + Math.random().toString(36).slice(2, 7);
    estado.arquivos[fid] = { id: fid, nome, tipo: 'image/jpeg', conteudo: 'x', pasta: 'entrada' };
    return fid;
  };
  const itens = [
    ['Nome da banda ou artista', banda],
    ['Telefone de contato (WhatsApp)', telefone],
    ['Data do show', data],
    ['Horário do show', hora],
    ['@ do Instagram da banda ou artista', instagram],
    ['Fotos da banda (até 2)', Array.from({ length: fotos }, (_, i) => criarArquivo('f' + i + '.jpg'))],
    ['Logotipo da banda', logo ? [criarArquivo('logo.png')] : []]
  ];
  return {
    getId: () => id,
    getRespondentEmail: () => 'banda@exemplo.com',
    getItemResponses: () => itens.map(([titulo, valor]) => ({
      getItem: () => ({ getTitle: () => titulo }), getResponse: () => valor
    }))
  };
}

const emDias = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(0, 0, 0, 0);
  return d;
};
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const artesFalsas = (id) => ({
  FEED: { A: `https://p/${id}_A_feed.jpg`, B: `https://p/${id}_B_feed.jpg`, C: `https://p/${id}_C_feed.jpg` },
  STORY: { A: `https://p/${id}_A_story.jpg`, B: `https://p/${id}_B_story.jpg`, C: `https://p/${id}_C_story.jpg` }
});

// ---------------------------------------------------------------- testes

teste('Recebe a inscrição, cria a pasta e guarda os arquivos', (ctx, estado) => {
  const id = ctx.processarResposta(respostaFalsa(ctx, estado,
    { banda: 'Os Bossais', data: iso(emDias(10)) }));
  conferir(id === '15' + ctx.MESES_ABREV[emDias(10).getMonth()] + '_os-bossais' || /_os-bossais$/.test(id),
    'o identificador segue o padrão do kit (ficou "' + id + '")');

  const prog = ctx.acharProgramacao(id);
  conferir(!!prog, 'a programação entrou na planilha');
  conferir(prog.Situacao === 'AGUARDANDO_ARTES', 'situação inicial é AGUARDANDO_ARTES');
  conferir(prog.DiaSemana === ctx.DIAS_SEMANA[emDias(10).getDay()], 'o dia da semana foi calculado');

  const sub = Object.keys(estado.pastas[prog.PastaId].filhas);
  conferir(['RECEBIDOS', 'ARTES-FEED', 'ARTES-STORIES', 'LEGENDAS', 'AGENDAMENTOS']
    .every((n) => sub.includes(n)), 'as 5 subpastas foram criadas');

  const recebidos = JSON.parse(prog.Artes).recebidos;
  conferir(recebidos.fotos.length === 2 && !!recebidos.logo, '2 fotos e a logo foram copiadas');
  conferir(estado.emails.length === 1, 'saiu o aviso por e-mail');
});

teste('A mesma resposta não vira duas programações', (ctx, estado) => {
  const r = respostaFalsa(ctx, estado, { banda: 'Spinsome', data: iso(emDias(9)), id: 'r-fixa' });
  const a = ctx.processarResposta(r);
  const b = ctx.processarResposta(r);
  conferir(a === b, 'o reenvio devolveu a mesma programação');
  conferir(ctx.linhas('PROGRAMACOES').length === 1, 'continua existindo uma linha só');
});

teste('Duas bandas no mesmo dia ganham identificadores diferentes', (ctx, estado) => {
  const d = iso(emDias(8));
  const a = ctx.processarResposta(respostaFalsa(ctx, estado, { banda: 'Sweet Sour', data: d }));
  const b = ctx.processarResposta(respostaFalsa(ctx, estado, { banda: 'Sweet Sour', data: d }));
  conferir(a !== b && b.endsWith('_2'), 'o segundo virou "' + b + '"');
});

teste('Inscrição com problema é recusada sem criar nada', (ctx, estado) => {
  const id = ctx.processarResposta(respostaFalsa(ctx, estado,
    { banda: 'Atrasada', data: iso(emDias(-3)) }));
  conferir(id === null, 'show com data no passado foi recusado');
  conferir(ctx.linhas('PROGRAMACOES').length === 0, 'nada entrou na planilha');

  const semFoto = ctx.processarResposta(respostaFalsa(ctx, estado,
    { banda: 'Sem Foto', data: iso(emDias(9)), fotos: 0 }));
  conferir(semFoto === null, 'inscrição sem foto foi recusada');
  conferir(estado.emails.length === 2, 'os dois problemas foram avisados por e-mail');
});

teste('Modo com aprovação: artes prontas não agendam nada sozinhas', (ctx, estado) => {
  const id = ctx.processarResposta(respostaFalsa(ctx, estado,
    { banda: 'Lorenzo Bruce', data: iso(emDias(7)) }));
  ctx.registrarArtesProntas(id, artesFalsas(id));

  const prog = ctx.acharProgramacao(id);
  conferir(prog.Situacao === 'AGUARDANDO_APROVACAO', 'ficou esperando aprovação');
  conferir(ctx.linhas('AGENDAMENTOS').length === 0, 'nenhuma publicação foi agendada');
  conferir(JSON.parse(prog.Legendas).A.includes('LORENZO BRUCE'), 'a legenda cita a banda');
  // Sem couvert informado, a legenda não anuncia couvert nenhum. Antes havia um
  // "R$15" escrito fixo aqui, que anunciava entrada paga em show que podia ser de
  // graça — e quem lesse acreditaria na legenda.
  conferir(!JSON.parse(prog.Legendas).A.includes('Couvert'),
    'sem couvert informado, a legenda não inventa um valor');
  conferir(JSON.parse(prog.Artes).recebidos.fotos.length === 2,
    'a lista dos arquivos recebidos foi preservada');

  ctx.publicarVencidos();
  conferir(ctx.linhas('AGENDAMENTOS').length === 0, 'mesmo rodando a publicação, nada saiu');

  const n = ctx.aprovarProgramacao(id);
  conferir(n === 6, 'depois de aprovar, 6 publicações entraram na fila');
  conferir(ctx.acharProgramacao(id).Situacao === 'AGENDADA', 'a programação virou AGENDADA');
});

teste('Modo automático agenda sem esperar ninguém', (ctx, estado) => {
  ctx.definirCfg('MODO_OPERACAO', 'AUTOMATICO');
  const id = ctx.processarResposta(respostaFalsa(ctx, estado,
    { banda: 'Carolline and The Dogs', data: iso(emDias(6)) }));
  ctx.registrarArtesProntas(id, artesFalsas(id));
  conferir(ctx.acharProgramacao(id).Situacao === 'AGENDADA', 'foi direto para AGENDADA');
  conferir(ctx.linhas('AGENDAMENTOS').length === 6, '6 publicações agendadas');
});

teste('O calendário respeita antecedência, janela, intervalo e a hora do show', (ctx, estado) => {
  ctx.definirCfg('MODO_OPERACAO', 'AUTOMATICO');
  const dataShow = emDias(12);
  const id = ctx.processarResposta(respostaFalsa(ctx, estado,
    { banda: 'Teste Calendario', data: iso(dataShow), hora: '20:00' }));
  ctx.registrarArtesProntas(id, artesFalsas(id));

  const ags = ctx.linhas('AGENDAMENTOS').map((a) => ({ ...a, q: new Date(a.QuandoISO) }));
  const inicioShow = new Date(dataShow); inicioShow.setHours(20, 0, 0, 0);
  const comeco = new Date(dataShow); comeco.setDate(comeco.getDate() - 2); comeco.setHours(8, 0, 0, 0);

  conferir(ags.every((a) => a.q >= comeco), 'nada antes de 2 dias do show às 08:00');
  conferir(ags.every((a) => a.q <= inicioShow), 'nada depois da hora em que o show começa');
  conferir(ags.every((a) => a.q.getHours() >= 8 && a.q.getHours() <= 23),
    'tudo dentro da janela de 08:00 às 23:00');

  const feed = ags.filter((a) => a.Canal === 'FEED').sort((x, y) => x.q - y.q);
  const horas = (b, a) => (b.q - a.q) / 3600000;
  conferir(feed.length === 3 && horas(feed[1], feed[0]) >= 5 && horas(feed[2], feed[1]) >= 5,
    'os posts de feed ficaram a 5h ou mais um do outro');

  const story = ags.filter((a) => a.Canal === 'STORY').sort((x, y) => x.q - y.q);
  conferir(story.length === 3 && horas(story[1], story[0]) >= 5,
    'os stories também respeitaram o intervalo de 5h');
  conferir(story.every((s) => !s.Legenda), 'stories vão sem legenda, como a API da Meta exige');
  conferir(feed.every((f) => f.Legenda.length > 50), 'cada post de feed tem legenda');
  conferir(new Set(feed.map((f) => f.Legenda)).size === 3,
    'as 3 legendas do feed são diferentes entre si');
});

teste('Mudar os intervalos pelo painel muda o calendário, sem tocar em código', (ctx, estado) => {
  ctx.definirCfg('MODO_OPERACAO', 'AUTOMATICO');
  ctx.definirCfg('INTERVALO_FEED_HORAS', '2');
  ctx.definirCfg('ANTECEDENCIA_DIAS', '4');
  const dataShow = emDias(14);
  const id = ctx.processarResposta(respostaFalsa(ctx, estado,
    { banda: 'Intervalo Curto', data: iso(dataShow) }));
  ctx.registrarArtesProntas(id, artesFalsas(id));

  const feed = ctx.linhas('AGENDAMENTOS').filter((a) => a.Canal === 'FEED')
    .map((a) => new Date(a.QuandoISO)).sort((x, y) => x - y);
  const dif = (feed[1] - feed[0]) / 3600000;
  conferir(Math.abs(dif - 2) < 0.1, 'o intervalo do feed passou a ser de 2h (ficou ' + dif + 'h)');
  const primeiro = new Date(dataShow); primeiro.setDate(primeiro.getDate() - 4); primeiro.setHours(8, 0, 0, 0);
  conferir(feed[0].getTime() === primeiro.getTime(), 'a divulgação começou 4 dias antes, às 08:00');
});

teste('Horário gravado como hora pela planilha ainda é entendido certo', (ctx, estado) => {
  // A planilha converte "08:00" num valor de hora e devolve um objeto de data de 1899.
  // Já aconteceu em produção: o sistema leu "23:18" e espaçou os posts de 24 em 24h.
  const comoAPlanilhaDevolve = new Date(1899, 11, 30, 8, 0, 0);
  const limite = new Date(1899, 11, 30, 23, 0, 0);
  const conf = estado.abas.CONFIG;
  conf.forEach((linha) => {
    if (linha[0] === 'HORARIO_INICIAL') linha[1] = comoAPlanilhaDevolve;
    if (linha[0] === 'HORARIO_LIMITE') linha[1] = limite;
  });
  conferir(ctx.cfg('HORARIO_INICIAL') === '08:00',
    'a hora voltou a ser lida como 08:00 (veio "' + ctx.cfg('HORARIO_INICIAL') + '")');
  conferir(JSON.stringify(ctx.paraHora(comoAPlanilhaDevolve)) === '{"h":8,"min":0}',
    'o objeto de data de 1899 é interpretado como 8h');
  conferir(JSON.stringify(ctx.paraHora('Sat Dec 30 1899 08:00:00 GMT-0306')) === '{"h":8,"min":0}',
    'e o texto completo dessa data também');
  conferir(ctx.horaTexto(new Date(1899, 11, 30, 21, 0, 0)) === '21:00',
    'o horário do show aparece como 21:00, não como uma data de 1899');

  ctx.definirCfg('MODO_OPERACAO', 'AUTOMATICO');
  const dataShow = emDias(12);
  const id = ctx.processarResposta(respostaFalsa(ctx, estado,
    { banda: 'Hora Da Planilha', data: iso(dataShow) }));
  ctx.registrarArtesProntas(id, artesFalsas(id));

  const feed = ctx.linhas('AGENDAMENTOS').filter((a) => a.Canal === 'FEED')
    .map((a) => new Date(a.QuandoISO)).sort((x, y) => x - y);
  conferir(feed.length === 3, 'as 3 peças de feed foram agendadas (saíram ' + feed.length + ')');
  conferir(feed[0].getHours() === 8 && feed[0].getMinutes() === 0,
    'a primeira saiu às 08:00, não às 23:18');
  const horas = (feed[1] - feed[0]) / 3600000;
  conferir(Math.abs(horas - 5) < 0.1, 'o intervalo voltou a ser de 5h (ficou ' + horas + 'h)');
});

teste('Intervalo curto é respeitado, sem a trava de 15 minutos atrapalhar', (ctx, estado) => {
  ctx.definirCfg('MODO_OPERACAO', 'AUTOMATICO');
  ctx.definirCfg('INTERVALO_FEED_HORAS', '0.05');     // 3 minutos
  ctx.definirCfg('INTERVALO_STORIES_HORAS', '0.05');
  const id = ctx.processarResposta(respostaFalsa(ctx, estado,
    { banda: 'Teste Rapido', data: iso(emDias(6)) }));
  ctx.registrarArtesProntas(id, artesFalsas(id));

  const minutos = (canal) => {
    const t = ctx.linhas('AGENDAMENTOS').filter((a) => a.Canal === canal)
      .map((a) => new Date(a.QuandoISO)).sort((x, y) => x - y);
    return [(t[1] - t[0]) / 60000, (t[2] - t[1]) / 60000];
  };
  const feed = minutos('FEED'), story = minutos('STORY');
  conferir(feed.every((m) => Math.abs(m - 3) < 0.6),
    'as peças de feed saíram de 3 em 3 minutos (deu ' + feed.join(' e ') + ')');
  conferir(story.every((m) => Math.abs(m - 3) < 0.6),
    'os stories também (deu ' + story.join(' e ') + ')');
  conferir(ctx.linhas('AGENDAMENTOS').length === 6, 'as 6 peças entraram na fila');
});

teste('Com intervalo normal, duas peças do mesmo canal não saem coladas', (ctx, estado) => {
  ctx.definirCfg('MODO_OPERACAO', 'AUTOMATICO');
  const dia = iso(emDias(8));
  const a = ctx.processarResposta(respostaFalsa(ctx, estado, { banda: 'Banda Um', data: dia }));
  ctx.registrarArtesProntas(a, artesFalsas(a));
  const b = ctx.processarResposta(respostaFalsa(ctx, estado, { banda: 'Banda Dois', data: dia }));
  ctx.registrarArtesProntas(b, artesFalsas(b));

  const feed = ctx.linhas('AGENDAMENTOS').filter((x) => x.Canal === 'FEED')
    .map((x) => new Date(x.QuandoISO).getTime()).sort((x, y) => x - y);
  let menor = Infinity;
  for (let i = 1; i < feed.length; i++) menor = Math.min(menor, (feed[i] - feed[i - 1]) / 60000);
  conferir(menor >= 15, 'a menor distância entre dois posts de feed foi ' + menor + ' min');
});

teste('Desligar o feed para de agendar feed e mantém os stories', (ctx, estado) => {
  ctx.definirCfg('MODO_OPERACAO', 'AUTOMATICO');
  ctx.definirCfg('FEED_ATIVO', 'NAO');
  const id = ctx.processarResposta(respostaFalsa(ctx, estado,
    { banda: 'So Stories', data: iso(emDias(9)) }));
  ctx.registrarArtesProntas(id, artesFalsas(id));
  const ags = ctx.linhas('AGENDAMENTOS');
  conferir(ags.length === 3 && ags.every((a) => a.Canal === 'STORY'),
    'sobraram só os 3 stories');
});

teste('Publicação simulada não envia nada ao Instagram', (ctx, estado) => {
  ctx.definirCfg('MODO_OPERACAO', 'AUTOMATICO');
  const id = ctx.processarResposta(respostaFalsa(ctx, estado,
    { banda: 'Simulado', data: iso(emDias(2)) }));
  ctx.registrarArtesProntas(id, artesFalsas(id));

  // Puxa tudo para o passado, para tudo vencer de uma vez.
  ctx.linhas('AGENDAMENTOS').forEach((a) => {
    ctx.gravarCampo('AGENDAMENTOS', a._linha, 'QuandoISO', new Date(Date.now() - 60000).toISOString());
  });
  const antes = estado.chamadasExternas.length;
  const n = ctx.publicarVencidos();

  conferir(n > 0, n + ' publicações foram processadas');
  conferir(estado.chamadasExternas.length === antes,
    'nenhuma chamada saiu para a Meta (a trava de segurança está em NAO)');
  const pubs = ctx.linhas('AGENDAMENTOS').filter((a) => a.Situacao === 'PUBLICADO');
  conferir(pubs.length === n && pubs.every((p) => String(p.IgMediaId).startsWith('SIMULADO_')),
    'todas ficaram marcadas como SIMULADO');
  conferir(ctx.acharProgramacao(id).Situacao === 'CONCLUIDA',
    'a programação foi fechada quando a fila esvaziou');
});

teste('Pausar segura as publicações; retomar devolve', (ctx, estado) => {
  ctx.definirCfg('MODO_OPERACAO', 'AUTOMATICO');
  const id = ctx.processarResposta(respostaFalsa(ctx, estado,
    { banda: 'Pausada', data: iso(emDias(5)) }));
  ctx.registrarArtesProntas(id, artesFalsas(id));

  ctx.pausarProgramacao(id);
  conferir(ctx.linhas('AGENDAMENTOS').every((a) => a.Situacao === 'PAUSADO'), 'tudo pausado');

  ctx.linhas('AGENDAMENTOS').forEach((a) => {
    ctx.gravarCampo('AGENDAMENTOS', a._linha, 'QuandoISO', new Date(Date.now() - 60000).toISOString());
  });
  ctx.publicarVencidos();
  conferir(ctx.linhas('AGENDAMENTOS').every((a) => a.Situacao === 'PAUSADO'),
    'mesmo vencidas, as pausadas não foram publicadas');

  ctx.retomarProgramacao(id);
  conferir(ctx.linhas('AGENDAMENTOS').every((a) => a.Situacao === 'AGENDADO'), 'tudo retomado');
  conferir(ctx.linhas('AGENDAMENTOS').every((a) => new Date(a.QuandoISO) > new Date()),
    'as que já tinham vencido ganharam horário novo em vez de sair atrasadas');
});

teste('Recalcular não cria peças com identificador repetido', (ctx, estado) => {
  // Já aconteceu em produção: ao recalcular, as peças novas nasciam com o mesmo
  // identificador das antigas. Cancelar acertava a linha errada e a mesma arte
  // podia ir ao ar duas vezes.
  ctx.definirCfg('MODO_OPERACAO', 'AUTOMATICO');
  const id = ctx.processarResposta(respostaFalsa(ctx, estado,
    { banda: 'Recalculada', data: iso(emDias(9)) }));
  ctx.registrarArtesProntas(id, artesFalsas(id));
  ctx.recalcularProgramacao(id);
  ctx.recalcularProgramacao(id);

  const todos = ctx.linhas('AGENDAMENTOS').map((a) => String(a.PostId));
  conferir(new Set(todos).size === todos.length,
    'os ' + todos.length + ' identificadores são todos diferentes');

  const ativos = ctx.linhas('AGENDAMENTOS').filter((a) => a.Situacao === 'AGENDADO');
  conferir(ativos.length === 6, 'sobraram exatamente 6 peças na fila');

  const alvo = ativos[0].PostId;
  ctx.painelCancelarPost('chave-de-teste', alvo);
  const depois = ctx.linhas('AGENDAMENTOS').filter((a) => String(a.PostId) === String(alvo));
  conferir(depois.every((a) => a.Situacao === 'CANCELADO'),
    'cancelar acertou a linha certa, não uma antiga');
});

teste('Cancelar tira tudo da fila', (ctx, estado) => {
  ctx.definirCfg('MODO_OPERACAO', 'AUTOMATICO');
  const id = ctx.processarResposta(respostaFalsa(ctx, estado,
    { banda: 'Cancelada', data: iso(emDias(5)) }));
  ctx.registrarArtesProntas(id, artesFalsas(id));
  const n = ctx.cancelarProgramacao(id);
  conferir(n === 6 && ctx.linhas('AGENDAMENTOS').every((a) => a.Situacao === 'CANCELADO'),
    'as 6 publicações foram canceladas');
  conferir(ctx.acharProgramacao(id).Situacao === 'CANCELADA', 'a programação ficou CANCELADA');
});

teste('Mudar a data do show refaz o calendário e preserva o que já saiu', (ctx, estado) => {
  ctx.definirCfg('MODO_OPERACAO', 'AUTOMATICO');
  const id = ctx.processarResposta(respostaFalsa(ctx, estado,
    { banda: 'Remarcada', data: iso(emDias(5)) }));
  ctx.registrarArtesProntas(id, artesFalsas(id));

  const primeiro = ctx.linhas('AGENDAMENTOS')[0];
  ctx.gravarCampos('AGENDAMENTOS', primeiro._linha, { Situacao: 'PUBLICADO', IgMediaId: 'ja-foi' });

  const novaData = iso(emDias(20));
  ctx.alterarShow(id, novaData, '21:30');

  const prog = ctx.acharProgramacao(id);
  conferir(prog.DataShow === novaData, 'a data do show mudou');
  conferir(prog.HoraShow === '21:30', 'a hora do show mudou');

  const ativos = ctx.linhas('AGENDAMENTOS').filter((a) => a.Situacao === 'AGENDADO');
  conferir(ativos.length === 5, 'as 5 peças que faltavam foram reagendadas');
  conferir(ctx.linhas('AGENDAMENTOS').some((a) => a.IgMediaId === 'ja-foi'),
    'a que já tinha sido publicada continua registrada');
  conferir(!ativos.some((a) => a.Canal === primeiro.Canal && a.Opcao === primeiro.Opcao),
    'a peça já publicada não foi agendada de novo');
  const limite = new Date(emDias(20)); limite.setHours(21, 30, 0, 0);
  conferir(ativos.every((a) => new Date(a.QuandoISO) <= limite),
    'o novo calendário respeita a nova hora do show');
});

teste('Falha na produção das artes não deixa agendar nada', (ctx, estado) => {
  const id = ctx.processarResposta(respostaFalsa(ctx, estado,
    { banda: 'Deu Erro', data: iso(emDias(8)) }));
  ctx.registrarFalhaDeArtes(id, 'a foto veio sem resolução');
  conferir(ctx.acharProgramacao(id).Situacao === 'ERRO_ARTES', 'ficou marcada como ERRO_ARTES');
  conferir(ctx.linhas('AGENDAMENTOS').length === 0, 'nada entrou na fila de publicação');
  conferir(estado.emails.some((e) => e.subject.includes('Não consegui produzir')),
    'a falha foi avisada por e-mail');

  ctx.refazerArtes(id);
  conferir(ctx.acharProgramacao(id).Situacao === 'AGUARDANDO_ARTES', 'voltou para a fila de produção');
});

teste('A fila de produção entrega o trabalho e trava contra duplicidade', (ctx, estado) => {
  const id = ctx.processarResposta(respostaFalsa(ctx, estado,
    { banda: 'Fila', data: iso(emDias(11)) }));
  const jobs = ctx.jobsDeArtes(5);
  conferir(jobs.length === 1 && jobs[0].id === id, 'o trabalho foi entregue uma vez');
  conferir(jobs[0].fotos.length === 2 && !!jobs[0].logo, 'veio com as fotos e a logo');
  conferir(jobs[0].mes === ctx.MESES[new Date(jobs[0].id ? emDias(11) : 0).getMonth()],
    'o mês por extenso foi calculado');
  conferir(ctx.jobsDeArtes(5).length === 0,
    'uma segunda chamada não reentrega o mesmo trabalho');
  conferir(ctx.acharProgramacao(id).Situacao === 'GERANDO_ARTES', 'ficou marcada como em produção');
});

teste('Produção travada volta sozinha para a fila', (ctx, estado) => {
  const id = ctx.processarResposta(respostaFalsa(ctx, estado,
    { banda: 'Travada', data: iso(emDias(11)) }));
  ctx.jobsDeArtes(5);
  const prog = ctx.acharProgramacao(id);
  ctx.gravarCampo('PROGRAMACOES', prog._linha, 'AtualizadoEm',
    new Date(Date.now() - 90 * 60000));
  ctx.rotinaArtes();
  conferir(ctx.acharProgramacao(id).Situacao === 'AGUARDANDO_ARTES',
    'depois de 45 min parada, voltou para a fila');
});

teste('A chave de acesso protege a API e o painel', (ctx) => {
  const ler = (r) => JSON.parse(r._texto);
  conferir(ler(ctx.doGet({ parameter: { acao: 'ping', chave: 'errada' } })).ok === false,
    'chave errada é recusada');
  conferir(ler(ctx.doGet({ parameter: { acao: 'ping', chave: 'chave-de-teste' } })).ok === true,
    'chave certa é aceita');
  conferir(ler(ctx.doGet({ parameter: { acao: 'jobs' } })).ok === false,
    'sem chave nenhuma, também é recusada');
  let barrou = false;
  try { ctx.painelAprovar('errada', 'x'); } catch (e) { barrou = true; }
  conferir(barrou, 'as funções do painel conferem a chave por conta própria');
});

teste('Token nunca aparece em log nem em e-mail', (ctx, estado) => {
  estado.props.IG_TOKEN = 'EAAG-token-secreto-de-verdade-123456';
  ctx.registrar('ERRO', '', 'TESTE', 'falhou com access_token=' + estado.props.IG_TOKEN);
  const logs = ctx.linhas('LOGS');
  const ultimo = String(logs[logs.length - 1].Detalhe);
  conferir(!ultimo.includes('EAAG-token-secreto'), 'o token foi escondido no registro');
  ctx.notificar('Teste', 'o token era ' + estado.props.IG_TOKEN, '');
  const email = estado.emails[estado.emails.length - 1];
  conferir(!email.body.includes('EAAG-token-secreto'), 'o token foi escondido no e-mail');
});

teste('O mesmo aviso não sai duas vezes no mesmo dia', (ctx, estado) => {
  const antes = estado.emails.length;
  ctx.notificar('Aviso repetido', 'corpo', 'prog-1');
  ctx.notificar('Aviso repetido', 'corpo', 'prog-1');
  ctx.notificar('Aviso repetido', 'corpo', 'prog-2');
  conferir(estado.emails.length === antes + 2,
    'o aviso repetido da mesma programação foi engolido; o da outra passou');
});

teste('Publicação que falha tenta de novo e só depois desiste', (ctx, estado) => {
  ctx.definirCfg('MODO_OPERACAO', 'AUTOMATICO');
  ctx.definirCfg('PUBLICAR_DE_VERDADE', 'SIM');
  ctx.definirCfg('MAX_TENTATIVAS', '2');
  estado.props.IG_USER_ID = '123';
  estado.props.IG_TOKEN = 'token';
  ctx.UrlFetchApp.fetch = () => ({
    getResponseCode: () => 400,
    getContentText: () => JSON.stringify({ error: { message: 'imagem fora do padrão', code: 9004 } })
  });

  const id = ctx.processarResposta(respostaFalsa(ctx, estado,
    { banda: 'Vai Falhar', data: iso(emDias(4)) }));
  ctx.registrarArtesProntas(id, artesFalsas(id));
  ctx.linhas('AGENDAMENTOS').forEach((a) => {
    ctx.gravarCampo('AGENDAMENTOS', a._linha, 'QuandoISO', new Date(Date.now() - 60000).toISOString());
  });

  ctx.publicarVencidos();
  let ags = ctx.linhas('AGENDAMENTOS');
  conferir(ags.every((a) => a.Situacao === 'AGENDADO' && Number(a.Tentativas) === 1),
    'na 1ª falha, voltou para a fila para tentar de novo');
  conferir(ags.every((a) => new Date(a.QuandoISO) > new Date()),
    'a nova tentativa ficou para daqui a pouco');

  ags.forEach((a) => ctx.gravarCampo('AGENDAMENTOS', a._linha, 'QuandoISO',
    new Date(Date.now() - 60000).toISOString()));
  ctx.publicarVencidos();
  ags = ctx.linhas('AGENDAMENTOS');
  conferir(ags.every((a) => a.Situacao === 'FALHA'), 'na 2ª falha, desistiu e marcou FALHA');
  conferir(estado.emails.some((e) => e.subject.includes('Uma publicação falhou')),
    'a falha definitiva foi avisada por e-mail');
});

teste('O endereço da arte vai para a Meta como JPEG público', (ctx, estado) => {
  ctx.definirCfg('MODO_OPERACAO', 'AUTOMATICO');
  ctx.definirCfg('PUBLICAR_DE_VERDADE', 'SIM');
  estado.props.IG_USER_ID = '123';
  estado.props.IG_TOKEN = 'token';
  const chamadas = [];
  ctx.UrlFetchApp.fetch = (url, opcoes) => {
    chamadas.push({ url, opcoes });
    return {
      getResponseCode: () => 200,
      getContentText: () => JSON.stringify({ id: 'c1', status_code: 'FINISHED' })
    };
  };
  const id = ctx.processarResposta(respostaFalsa(ctx, estado,
    { banda: 'Publica', data: iso(emDias(4)), instagram: '@publica' }));
  ctx.registrarArtesProntas(id, artesFalsas(id));
  const primeiro = ctx.linhas('AGENDAMENTOS').filter((a) => a.Canal === 'FEED')[0];
  ctx.gravarCampo('AGENDAMENTOS', primeiro._linha, 'QuandoISO', new Date(Date.now() - 60000).toISOString());
  ctx.linhas('AGENDAMENTOS').filter((a) => a.PostId !== primeiro.PostId)
    .forEach((a) => ctx.gravarCampo('AGENDAMENTOS', a._linha, 'Situacao', 'CANCELADO'));

  ctx.publicarVencidos();
  const criacao = chamadas.find((c) => String(c.url).includes('/media') && !String(c.url).includes('media_publish'));
  conferir(!!criacao, 'o contêiner da imagem foi criado na Meta');
  conferir(String(criacao.url).startsWith("https://graph.facebook.com/"),
    'o endereço da API é o do login unificado (graph.facebook.com)');
  conferir(String(criacao.opcoes.payload.image_url).endsWith('.jpg'),
    'a imagem enviada é JPEG, como a Meta exige');
  conferir(criacao.opcoes.payload.caption.includes('PUBLICA'), 'a legenda foi junto');
  conferir(JSON.parse(criacao.opcoes.payload.collaborators)[0] === 'publica',
    'a banda foi convidada como colaboradora');
  conferir(chamadas.some((c) => String(c.url).includes('media_publish')),
    'e o contêiner foi efetivamente publicado');
});

teste('Story vai sem legenda e com o tipo STORIES', (ctx, estado) => {
  ctx.definirCfg('MODO_OPERACAO', 'AUTOMATICO');
  ctx.definirCfg('PUBLICAR_DE_VERDADE', 'SIM');
  estado.props.IG_USER_ID = '123';
  estado.props.IG_TOKEN = 'token';
  const chamadas = [];
  ctx.UrlFetchApp.fetch = (url, opcoes) => {
    chamadas.push({ url, opcoes });
    return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ id: 'c1', status_code: 'FINISHED' }) };
  };
  const id = ctx.processarResposta(respostaFalsa(ctx, estado,
    { banda: 'Story', data: iso(emDias(4)) }));
  ctx.registrarArtesProntas(id, artesFalsas(id));
  ctx.linhas('AGENDAMENTOS').forEach((a) => {
    ctx.gravarCampo('AGENDAMENTOS', a._linha, 'Situacao',
      a.Canal === 'STORY' && a.Opcao === 'A' ? 'AGENDADO' : 'CANCELADO');
    if (a.Canal === 'STORY' && a.Opcao === 'A') {
      ctx.gravarCampo('AGENDAMENTOS', a._linha, 'QuandoISO', new Date(Date.now() - 60000).toISOString());
    }
  });
  ctx.publicarVencidos();
  const criacao = chamadas.find((c) => String(c.url).includes('/media') && !String(c.url).includes('media_publish'));
  conferir(criacao.opcoes.payload.media_type === 'STORIES', 'foi enviado como STORIES');
  conferir(criacao.opcoes.payload.caption === undefined, 'não foi mandada legenda no story');
  conferir(criacao.opcoes.payload.collaborators === undefined,
    'não foi tentado convite de colaboração em story');
});

// ---------------- página de inscrição própria (sem conta Google) -------------

const imagemFalsa = (nome, tipo = 'image/jpeg') => ({
  nome, tipo, conteudo: Buffer.from('conteudo-de-' + nome).toString('base64')
});

const inscricaoFalsa = (extra = {}) => ({
  idEnvio: 'web-' + Math.random().toString(36).slice(2),
  banda: 'Banda da Web',
  telefone: '(62) 98888-7777',
  data: iso(emDias(10)),
  hora: '21:00',
  instagram: '@bandadaweb',
  fotos: [imagemFalsa('f1.jpg'), imagemFalsa('f2.png', 'image/png')],
  logo: imagemFalsa('logo.png', 'image/png'),
  ...extra
});

teste('O relatório cobre o período do calendário, incluindo os shows que ainda vão acontecer', (ctx) => {
  // O defeito que isto guarda: o relatório contava "os últimos N dias a partir de
  // hoje". Agenda de casa de show é feita para a frente, então um relatório tirado
  // no dia 10 não achava nenhum show marcado para o dia 15 e saía vazio, com a
  // agenda cheia. Agora o período é a semana, o mês e o trimestre CORRENTES.
  const hoje = new Date();
  const mes = ctx.periodoDoRelatorio('MENSAL');
  conferir(mes.de.getDate() === 1, 'o mensal começa no dia 1');
  conferir(mes.ate.getMonth() === hoje.getMonth(),
    'e termina no último dia do mesmo mês');
  conferir(mes.ate.getTime() > hoje.getTime(),
    'o fim do período está no futuro, então show marcado para daqui a dias entra');

  const tri = ctx.periodoDoRelatorio('TRIMESTRAL');
  conferir([0, 3, 6, 9].indexOf(tri.de.getMonth()) >= 0,
    'o trimestral começa no primeiro mês do trimestre');
  conferir(tri.ate.getTime() >= mes.ate.getTime(), 'e cobre pelo menos o mês inteiro');

  const sem = ctx.periodoDoRelatorio('SEMANAL');
  conferir(sem.de.getDay() === 1, 'a semana começa na segunda-feira');
  conferir(sem.ate.getDay() === 0, 'e termina no domingo');
  conferir(sem.ate.getHours() === 23,
    'o último dia conta inteiro, até 23:59 — senão um show do próprio domingo ficaria de fora');

  conferir(ctx.periodoDoRelatorio('ANUAL') === null, 'período desconhecido é recusado');
});

teste('Aprovar as marcadas publica só elas, e as outras ficam de fora', (ctx, estado) => {
  const id = ctx.processarResposta(respostaFalsa(ctx, estado,
    { banda: 'Meia Arte', data: iso(emDias(9)) }));
  ctx.registrarArtesProntas(id, artesFalsas(id));
  conferir(ctx.acharProgramacao(id).Situacao === 'AGUARDANDO_APROVACAO',
    'ficou esperando aprovação');

  // Só duas das seis peças foram marcadas. O risco que este teste guarda é o
  // sistema ignorar a escolha e publicar tudo — o que levaria ao ar justamente a
  // arte que foi recusada por estar torta.
  const quantas = ctx.painelAprovar('chave-de-teste', id, ['FEED:A', 'STORY:B']);
  const posts = ctx.linhas('AGENDAMENTOS').filter((a) => String(a.ProgramacaoId) === id);
  const marcas = posts.map((a) => `${a.Canal}:${a.Opcao}`).sort();

  conferir(posts.length === 2, `entraram 2 publicações na fila, não ${posts.length}`);
  conferir(marcas.join(' ') === 'FEED:A STORY:B',
    'e são exatamente as marcadas: ' + marcas.join(' '));
  conferir(quantas === 2, 'o painel informou 2 agendadas');
  conferir(String(ctx.acharProgramacao(id).Avisos).includes('não publicadas por escolha sua'),
    'ficou registrado o que não foi publicado');
});

teste('Aprovar sem marcar nenhuma peça é recusado', (ctx, estado) => {
  const id = ctx.processarResposta(respostaFalsa(ctx, estado,
    { banda: 'Nenhuma Marcada', data: iso(emDias(9)) }));
  ctx.registrarArtesProntas(id, artesFalsas(id));
  let recusou = false;
  try {
    ctx.painelAprovar('chave-de-teste', id, []);
  } catch (e) {
    recusou = String(e.message).includes('Nenhuma peça');
  }
  // Lista vazia quer dizer "todas", que é o caminho normal; o que não pode é marcar
  // zero no painel e o sistema entender que era para publicar tudo.
  conferir(!recusou, 'lista vazia continua querendo dizer "todas", como antes');
  conferir(ctx.linhas('AGENDAMENTOS').filter((a) => String(a.ProgramacaoId) === id).length === 6,
    'e as 6 peças foram agendadas');
});

teste('O couvert vem do jeito que a pessoa escrever e vira número limpo', (ctx) => {
  // Quem preenche escreve "15", "R$ 15", "15,00" ou "20.00" — os quatro querem dizer
  // a mesma coisa. Guardar o texto cru faria a arte sair "COUVERT R$ R$ 15".
  for (const [escrito, esperado] of [['15', '15'], ['R$ 15', '15'], ['15,00', '15'],
                                     ['20.00', '20'], ['12,50', '12,50'],
                                     ['', ''], ['abc', ''], ['0', '']]) {
    const saiu = ctx.valorDeCouvert(escrito);
    conferir(saiu === esperado,
      `"${escrito}" virou "${saiu}"` + (saiu === esperado ? '' : ` (esperava "${esperado}")`));
  }
});

teste('A colaboração aceita até 3 perfis, sem repetir e sem arroba', (ctx) => {
  const limpos = ctx.perfisDeColaboracao(['@um', 'dois', '@um', '  @tres ', '@quatro', '']);
  conferir(limpos.length === 3, `sobraram 3 perfis, não ${limpos.length}`);
  conferir(limpos.join(',') === '@um,@dois,@tres',
    'na ordem, sem repetido e normalizados: ' + limpos.join(','));
  conferir(ctx.perfisDeColaboracao([]).length === 0, 'sem colaboração, lista vazia');
});

teste('Couvert e colaboradores sobrevivem até a hora de publicar', (ctx) => {
  // O ponto frágil: a coluna das artes é reescrita quando as artes ficam prontas, e
  // os colaboradores só são usados DEPOIS disso. Se não forem carregados adiante,
  // somem no meio do caminho e a publicação sai sem colaboração, sem erro nenhum.
  const r = ctx.receberInscricao(inscricaoFalsa({
    couvert: 'R$ 25', colabs: ['@bandadaweb', '@baterista']
  }));
  conferir(r.ok === true, 'a inscrição com couvert e colaboração foi aceita');

  const recebidos = JSON.parse(ctx.acharProgramacao(r.id).Artes).recebidos;
  conferir(recebidos.couvert === '25', 'o couvert ficou guardado como "25"');
  conferir((recebidos.colabs || []).length === 2, 'os 2 perfis ficaram guardados');

  const job = ctx.jobsDeArtes(5).filter((j) => j.id === r.id)[0];
  conferir(job && job.couvert === '25', 'o couvert chegou à oficina que desenha a arte');

  ctx.registrarArtesProntas(r.id, {
    FEED: { A: 'https://exemplo/a.jpg' }, STORY: { A: 'https://exemplo/as.jpg' }
  }, []);
  const depois = JSON.parse(ctx.acharProgramacao(r.id).Artes).recebidos || {};
  conferir((depois.colabs || []).join(',') === '@bandadaweb,@baterista',
    'e continuam lá depois das artes ficarem prontas');

  // A legenda tem de anunciar o MESMO valor que a arte desenha. Se um for do show e
  // o outro ficar escrito fixo, a peça diz um preço e o texto diz outro.
  const legenda = JSON.parse(ctx.acharProgramacao(r.id).Legendas).A;
  conferir(legenda.includes('Couvert R$25'),
    'a legenda anuncia o mesmo couvert da arte');
});

teste('Inscrição pela página própria cria a programação igual ao formulário', (ctx, estado) => {
  const r = ctx.receberInscricao(inscricaoFalsa());
  conferir(r.ok === true, 'a inscrição foi aceita');

  const prog = ctx.acharProgramacao(r.id);
  conferir(!!prog, 'a programação entrou na planilha');
  conferir(prog.Banda === 'Banda da Web', 'o nome da banda foi gravado');
  conferir(prog.HoraShow === '21:00', 'o horário do show foi gravado');
  conferir(prog.InstagramBanda === '@bandadaweb', 'o @ foi normalizado');
  conferir(prog.Situacao === 'AGUARDANDO_ARTES', 'já entrou na fila de produção');

  const recebidos = JSON.parse(prog.Artes).recebidos;
  conferir(recebidos.fotos.length === 2 && !!recebidos.logo,
    'as 2 fotos e a logo foram guardadas no Drive');
  conferir(recebidos.fotos[0].nome === 'foto1.jpg' && recebidos.logo.nome === 'logo.png',
    'os arquivos foram renomeados no padrão');
  conferir(estado.emails.some((e) => e.subject.includes('Nova banda inscrita')),
    'o aviso de nova inscrição saiu');
});

teste('A página recusa o que está errado, sem criar nada', (ctx) => {
  const semFoto = ctx.receberInscricao(inscricaoFalsa({ fotos: [] }));
  conferir(semFoto.ok === false && /foto/i.test(semFoto.problemas.join(' ')),
    'inscrição sem foto foi recusada: "' + semFoto.problemas.join('; ') + '"');

  const passada = ctx.receberInscricao(inscricaoFalsa({ data: iso(emDias(-5)) }));
  conferir(passada.ok === false, 'data no passado foi recusada');

  const naoImagem = ctx.receberInscricao(inscricaoFalsa({
    fotos: [{ nome: 'virus.exe', tipo: 'application/x-msdownload', conteudo: 'AAAA' }]
  }));
  conferir(naoImagem.ok === false && /imagem/i.test(naoImagem.problemas.join(' ')),
    'arquivo que não é imagem foi recusado');

  const robo = ctx.receberInscricao(inscricaoFalsa({ sobrenome: 'preenchido por robo' }));
  conferir(robo.ok === false, 'o campo-isca pegou o robô');

  conferir(ctx.linhas('PROGRAMACOES').length === 0, 'nenhuma delas criou programação');
});

teste('Reenvio da mesma inscrição não duplica', (ctx) => {
  const dados = inscricaoFalsa();
  const a = ctx.receberInscricao(dados);
  const b = ctx.receberInscricao(dados);
  conferir(a.ok && b.ok && a.id === b.id, 'o segundo envio devolveu a mesma programação');
  conferir(ctx.linhas('PROGRAMACOES').length === 1, 'continua uma linha só');
});

teste('Enxurrada de inscrições é segurada', (ctx) => {
  let recusadas = 0;
  for (let i = 0; i < 25; i++) {
    if (!ctx.receberInscricao(inscricaoFalsa({ banda: 'Banda ' + i })).ok) recusadas++;
  }
  conferir(recusadas >= 5, recusadas + ' envios foram barrados depois do limite da hora');
});

teste('A página de inscrição é pública e não vaza o painel', (ctx) => {
  let abriu = false;
  ctx.paginaDeInscricao = ctx.paginaDeInscricao;
  const saida = ctx.doGet({ parameter: { inscricao: '1' } });
  abriu = !!saida;
  conferir(abriu, 'a página abre sem chave nenhuma');
  const painel = ctx.doGet({ parameter: {} });
  conferir(!!painel, 'e o painel sem chave devolve a tela de acesso negado');
});

// ---------------------------------------------------------------- execução

console.log('\nTESTES DO CÉREBRO DA AUTOMAÇÃO WOODSTOCK');
for (const caso of casos) {
  console.log('\n• ' + caso.nome);
  const { contexto, estado } = criarAmbiente();
  try {
    caso.fn(contexto, estado);
  } catch (e) {
    falhou++;
    console.log('   FALHA (quebrou) ' + e.message + '\n' + String(e.stack).split('\n').slice(1, 4).join('\n'));
  }
}
console.log(`\n======================================\n${passou} verificações passaram, ${falhou} falharam\n`);
process.exit(falhou ? 1 : 0);
