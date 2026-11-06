/**
 * Publicação no Instagram pela API oficial da Meta (gratuita).
 *
 * Como funciona lá: primeiro você cria um "contêiner" apontando para a imagem, depois
 * manda publicar esse contêiner. A imagem precisa estar num endereço público e ser JPEG —
 * por isso as artes ficam hospedadas no GitHub Pages.
 *
 * A API não agenda: quem agenda é este sistema, que a cada 15 minutos publica o que venceu.
 *
 * Caminho usado: "login unificado". Nele o ativo conectado é a própria conta do
 * Instagram — não é preciso ter Página do Facebook, que o bar não tem. O acesso é um
 * token de usuário do sistema, que a Meta emite SEM VALIDADE: não vence em 60 dias e
 * não precisa de renovação nem de chave secreta.
 */

var GRAPH = 'https://graph.facebook.com/v23.0/';

function igConfigurado() {
  return !!(segredo('IG_USER_ID') && segredo('IG_TOKEN'));
}

function chamarGraph(caminho, metodo, carga) {
  var opcoes = {
    method: metodo,
    muteHttpExceptions: true,
    payload: Object.assign({ access_token: segredo('IG_TOKEN') }, carga || {})
  };
  if (metodo === 'get') {
    opcoes.payload = undefined;
    var q = Object.keys(carga || {}).map(function (k) {
      return k + '=' + encodeURIComponent(carga[k]);
    });
    q.push('access_token=' + encodeURIComponent(segredo('IG_TOKEN')));
    caminho = caminho + (caminho.indexOf('?') >= 0 ? '&' : '?') + q.join('&');
  }
  var resp = UrlFetchApp.fetch(GRAPH + caminho, opcoes);
  var corpo = resp.getContentText();
  var dados;
  try { dados = JSON.parse(corpo); } catch (e) { dados = { erroBruto: corpo }; }
  if (resp.getResponseCode() >= 400 || dados.error) {
    var msg = dados.error ? (dados.error.message + ' (código ' + dados.error.code +
      (dados.error.error_subcode ? '/' + dados.error.error_subcode : '') + ')') : corpo;
    throw new Error(limparSegredos(msg));
  }
  return dados;
}

/**
 * Publica uma peça. Com a trava PUBLICAR_DE_VERDADE em NAO, faz tudo menos o envio
 * final — serve para testar o sistema inteiro sem sujar o perfil real.
 */
function publicarPeca(post) {
  if (!cfgSim('PUBLICAR_DE_VERDADE')) {
    return { simulado: true, id: 'SIMULADO_' + post.PostId };
  }
  if (!igConfigurado()) throw new Error('Instagram ainda não conectado (falta IG_USER_ID/IG_TOKEN).');

  var igId = segredo('IG_USER_ID');
  var carga = { image_url: post.ArquivoUrl };

  if (post.Canal === 'STORY') {
    carga.media_type = 'STORIES';   // stories não aceitam legenda
  } else {
    carga.caption = String(post.Legenda || '');
    var colab = conviteColaboradora(post);
    if (colab) carga.collaborators = JSON.stringify([colab]);
  }

  var container;
  try {
    container = chamarGraph(igId + '/media', 'post', carga);
  } catch (e) {
    // Se o convite de colaboração for recusado pela API, publica sem ele e avisa.
    if (carga.collaborators && /collaborator/i.test(e.message)) {
      registrar('AVISO', post.ProgramacaoId, 'COLAB_NAO_ACEITO',
        'A API recusou o convite de colaboração. Publicando sem, e avisando para fazer à mão. ' +
        e.message);
      delete carga.collaborators;
      container = chamarGraph(igId + '/media', 'post', carga);
      avisarColabManual(post);
    } else {
      throw e;
    }
  }

  esperarContainer(container.id);
  var publicado = chamarGraph(igId + '/media_publish', 'post', { creation_id: container.id });
  return { simulado: false, id: publicado.id };
}

function esperarContainer(containerId) {
  for (var i = 0; i < 10; i++) {
    var s = chamarGraph(containerId, 'get', { fields: 'status_code,status' });
    if (s.status_code === 'FINISHED') return true;
    if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') {
      throw new Error('O Instagram não aceitou a imagem: ' + (s.status || s.status_code));
    }
    Utilities.sleep(3000);
  }
  throw new Error('O Instagram demorou demais para preparar a imagem.');
}

function conviteColaboradora(post) {
  if (!cfgSim('CONVITE_COLAB')) return null;
  var prog = acharProgramacao(post.ProgramacaoId);
  if (!prog) return null;
  var arroba = String(prog.InstagramBanda || '').replace(/^@/, '').trim();
  return arroba || null;
}

/** Quantas publicações ainda cabem nas próximas 24h (a Meta limita a 100). */
function cotaRestante() {
  if (!igConfigurado()) return null;
  try {
    var r = chamarGraph(segredo('IG_USER_ID') + '/content_publishing_limit', 'get',
      { fields: 'config,quota_usage' });
    var d = (r.data || [])[0] || {};
    var limite = (d.config && d.config.quota_total) || 100;
    return { usado: d.quota_usage || 0, limite: limite, resta: limite - (d.quota_usage || 0) };
  } catch (e) {
    registrar('AVISO', '', 'COTA_INDISPONIVEL', e.message);
    return null;
  }
}

function testarInstagram() {
  if (!igConfigurado()) return 'Instagram ainda não conectado. Rode configurarInstagram(...).';
  var eu = chamarGraph(segredo('IG_USER_ID'), 'get',
    { fields: 'id,username,name,followers_count' });
  var cota = cotaRestante();
  var texto = 'Conectado como @' + eu.username + ' (id ' + eu.id + ')' +
    (eu.followers_count !== undefined ? ', ' + eu.followers_count + ' seguidores' : '') +
    (cota ? ' | cota: ' + cota.usado + '/' + cota.limite + ' usadas nas últimas 24h' : '');
  console.log(texto);
  return texto;
}

/**
 * Descobre sozinho o identificador da conta do Instagram, para ninguém precisar copiar
 * número nenhum. Tenta pelos ativos do portfólio empresarial e, se não achar, pelas
 * contas ligadas às Páginas (caminho antigo), nessa ordem.
 */
function descobrirContaInstagram() {
  var tentativas = [];
  var negocio = segredo('BUSINESS_ID');

  if (negocio) {
    ['owned_instagram_accounts', 'client_instagram_accounts', 'instagram_accounts']
      .forEach(function (caminho) {
        tentativas.push(function () {
          var r = chamarGraph(negocio + '/' + caminho, 'get', { fields: 'id,username' });
          return (r.data || [])[0];
        });
      });
  }
  tentativas.push(function () {
    var paginas = chamarGraph('me/accounts', 'get', { fields: 'instagram_business_account{id,username}' });
    var achada = (paginas.data || []).filter(function (p) { return p.instagram_business_account; })[0];
    return achada && achada.instagram_business_account;
  });

  for (var i = 0; i < tentativas.length; i++) {
    try {
      var conta = tentativas[i]();
      if (conta && conta.id) {
        definirSegredo('IG_USER_ID', String(conta.id));
        registrar('INFO', '', 'CONTA_IG',
          'Conectado a @' + (conta.username || '?') + ' (id ' + conta.id + ')');
        return { id: String(conta.id), username: conta.username || '' };
      }
    } catch (e) {
      registrar('INFO', '', 'BUSCA_CONTA_IG', 'Tentativa ' + (i + 1) + ' não serviu: ' + e.message);
    }
  }
  throw new Error('Não encontrei nenhuma conta do Instagram ligada a este acesso. ' +
    'Confirme que a conta foi adicionada como ativo na configuração do aplicativo.');
}

/**
 * O token do Instagram vale 60 dias. Esta rotina roda todo dia e renova enquanto ele
 * ainda está válido, para o sistema não parar sozinho.
 */
/**
 * O acesso do usuário do sistema não vence, então não há o que renovar. Esta rotina
 * passou a ser uma ronda: confere todo dia se o acesso continua válido e avisa se
 * alguém o revogou — que é a única forma de ele parar de funcionar.
 */
function rotinaRenovarToken() {
  if (!igConfigurado()) return;
  try {
    chamarGraph(segredo('IG_USER_ID'), 'get', { fields: 'id,username' });
  } catch (e) {
    registrar('ERRO', '', 'ACESSO_IG_INVALIDO', e.message);
    notificar('Atenção: o acesso ao Instagram parou de funcionar',
      'A conferência diária do acesso ao Instagram falhou.\n\n' +
      'Enquanto isso não for resolvido, as publicações automáticas vão falhar — as ' +
      'artes continuam sendo produzidas normalmente.\n\n' +
      'Motivo técnico: ' + e.message + '\n\n' +
      'Isso costuma acontecer quando o aplicativo é removido em Instagram, ' +
      'Configurações, Aplicativos e sites. Me avise que eu gero um acesso novo com você.', '');
  }
}
