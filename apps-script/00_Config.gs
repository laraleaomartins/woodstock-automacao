/**
 * Automação Woodstock — configurações centrais.
 * Nada aqui precisa ser editado no dia a dia: os valores ficam na aba CONFIG da
 * planilha e no painel. Este arquivo só define os padrões e os nomes.
 */

var NOME_PASTA_RAIZ = 'WOODSTOCK-ARTES';
var TZ = 'America/Sao_Paulo';

/** Abas da planilha de controle. */
var ABA = {
  PROGRAMACOES: 'PROGRAMACOES',
  AGENDAMENTOS: 'AGENDAMENTOS',
  CONFIG: 'CONFIG',
  LOGS: 'LOGS'
};

var COL_PROGRAMACOES = ['ID', 'RecebidoEm', 'Banda', 'Telefone', 'InstagramBanda', 'DataShow',
  'HoraShow', 'DiaSemana', 'PastaId', 'Situacao', 'Modo', 'Artes', 'Legendas', 'Erro', 'Avisos',
  'RespostaId', 'AtualizadoEm'];

var COL_AGENDAMENTOS = ['PostId', 'ProgramacaoId', 'Banda', 'Canal', 'Opcao', 'ArquivoUrl',
  'Legenda', 'QuandoISO', 'Situacao', 'IgMediaId', 'Tentativas', 'Erro', 'AtualizadoEm'];

var COL_LOGS = ['Quando', 'Nivel', 'Programacao', 'Evento', 'Detalhe'];

/** Situações possíveis de uma programação. */
var SIT = {
  AGUARDANDO_ARTES: 'AGUARDANDO_ARTES',
  GERANDO_ARTES: 'GERANDO_ARTES',
  ERRO_ARTES: 'ERRO_ARTES',
  AGUARDANDO_APROVACAO: 'AGUARDANDO_APROVACAO',
  APROVADA: 'APROVADA',
  AGENDADA: 'AGENDADA',
  CONCLUIDA: 'CONCLUIDA',
  REPROVADA: 'REPROVADA',
  PAUSADA: 'PAUSADA',
  CANCELADA: 'CANCELADA'
};

/** Situações possíveis de um post agendado. */
var SIT_POST = {
  AGENDADO: 'AGENDADO',
  PUBLICADO: 'PUBLICADO',
  FALHA: 'FALHA',
  CANCELADO: 'CANCELADO',
  PAUSADO: 'PAUSADO'
};

/**
 * Padrões da aba CONFIG. A descrição é o que aparece no painel, por isso está em
 * linguagem de quem usa, não de quem programa.
 */
var CONFIG_PADRAO = [
  ['MODO_OPERACAO', 'APROVACAO',
   'AUTOMATICO publica sozinho. APROVACAO espera você aprovar as artes no painel.'],
  ['ANTECEDENCIA_DIAS', '2',
   'Quantos dias antes do show a divulgação começa.'],
  ['INTERVALO_FEED_HORAS', '5',
   'Horas de distância entre um post de feed e o seguinte.'],
  ['INTERVALO_STORIES_HORAS', '5',
   'Horas de distância entre um story e o seguinte.'],
  ['HORARIO_INICIAL', '08:00',
   'Mais cedo que isso o sistema não publica.'],
  ['HORARIO_LIMITE', '23:00',
   'Mais tarde que isso o sistema não publica.'],
  ['FEED_ATIVO', 'SIM',
   'SIM/NAO — desligue para parar de agendar posts de feed.'],
  ['STORIES_ATIVO', 'SIM',
   'SIM/NAO — desligue para parar de agendar stories.'],
  ['PUBLICAR_DE_VERDADE', 'NAO',
   'TRAVA DE SEGURANÇA. Com NAO o sistema faz tudo menos enviar ao Instagram (registra como SIMULADO). Só mude para SIM quando quiser publicar mesmo.'],
  ['PERFIL_OFICIAL', '@woodstockrockbar',
   'Perfil do bar citado no formulário e nas legendas.'],
  ['EMAIL_NOTIFICACAO', '',
   'Para onde vão os avisos. Em branco usa o e-mail dono da planilha.'],
  ['CONVITE_COLAB', 'SIM',
   'SIM/NAO — tentar convidar a banda como colaboradora do post de feed.'],
  ['NAO_PUBLICAR_APOS_SHOW', 'SIM',
   'SIM/NAO — proíbe publicar depois do horário de início do show.'],
  ['MAX_TENTATIVAS', '3',
   'Quantas vezes o sistema tenta de novo quando uma publicação falha.']
];

/** Lê um valor da aba CONFIG, com o padrão como rede de segurança. */
function cfg(chave) {
  var cache = CacheService.getScriptCache();
  var achado = cache.get('cfg_' + chave);
  if (achado !== null) return achado;
  // Antes da instalação a planilha ainda não existe: aqui isso não é erro, é só
  // motivo para usar o valor padrão.
  try {
    var valores = aba(ABA.CONFIG).getDataRange().getValues();
    for (var i = 1; i < valores.length; i++) {
      if (String(valores[i][0]).trim() === chave) {
        // A planilha converte "08:00" num valor de hora e devolve um objeto de data
        // de 1899. Virar texto aqui daria "Sat Dec 30 1899 08:00:00...", e quem lesse
        // isso entenderia qualquer coisa. Então formata de volta para HH:mm.
        var bruto = valores[i][1];
        var v = (Object.prototype.toString.call(bruto) === '[object Date]')
          ? Utilities.formatDate(bruto, TZ, 'HH:mm')
          : String(bruto).trim();
        cache.put('cfg_' + chave, v, 60);
        return v;
      }
    }
  } catch (e) {
    console.log('CONFIG ainda não existe; usando o padrão de ' + chave);
  }
  for (var j = 0; j < CONFIG_PADRAO.length; j++) {
    if (CONFIG_PADRAO[j][0] === chave) return CONFIG_PADRAO[j][1];
  }
  return '';
}

function cfgNum(chave) { return Number(cfg(chave)); }
function cfgSim(chave) { return String(cfg(chave)).toUpperCase() === 'SIM'; }

function definirCfg(chave, valor) {
  var planilha = aba(ABA.CONFIG);
  planilha.getRange(2, 2, Math.max(planilha.getLastRow() - 1, 1), 1).setNumberFormat('@');
  var valores = planilha.getDataRange().getValues();
  for (var i = 1; i < valores.length; i++) {
    if (String(valores[i][0]).trim() === chave) {
      planilha.getRange(i + 1, 2).setValue(valor);
      CacheService.getScriptCache().remove('cfg_' + chave);
      return true;
    }
  }
  planilha.appendRow([chave, valor, '(criada pelo painel)']);
  CacheService.getScriptCache().remove('cfg_' + chave);
  return true;
}

/** Segredos ficam nas propriedades do script, nunca na planilha nem em log. */
function segredo(chave) {
  return PropertiesService.getScriptProperties().getProperty(chave) || '';
}

function definirSegredo(chave, valor) {
  PropertiesService.getScriptProperties().setProperty(chave, valor);
}
