/**
 * Página de inscrição das bandas, feita aqui dentro.
 *
 * Por que não o Google Forms: em conta Google pessoal (não Workspace) o Google não
 * deixa criar campo de envio de arquivo — e, mesmo onde deixa, obriga a banda a ter
 * conta Google e estar logada para anexar. Esta página aceita anexo de qualquer um,
 * sem login, e continua custando zero.
 *
 * O endereço é público de propósito: é o link que vai para as bandas. O que ele
 * aceita é só criar uma inscrição — não lê nem mexe em nada que já existe.
 */

var MAX_INSCRICOES_POR_HORA = 20;
var LADO_MAXIMO_FOTO = 2400;

function paginaDeInscricao() {
  var html = HtmlService.createHtmlOutputFromFile('Inscricao').getContent()
    .replace('__PERFIL__', cfg('PERFIL_OFICIAL'))
    .replace('__LADO_MAXIMO__', String(LADO_MAXIMO_FOTO))
    .replace('__INFORMATIVO__', JSON.stringify(TEXTO_INFORMATIVO));
  return HtmlService.createHtmlOutput(html)
    .setTitle('Woodstock Rock Bar — cadastro da sua apresentação')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Recebe a inscrição da página. Chamada por quem não está logado, então valida
 * tudo e não confia em nada que vem de fora.
 */
function receberInscricao(dados) {
  if (dados && dados.sobrenome) {
    // Campo invisível que só robô preenche.
    return { ok: false, problemas: ['Envio bloqueado.'] };
  }
  if (!segurarEnxurrada()) {
    return { ok: false, problemas: ['Muitas inscrições em pouco tempo. Tente de novo em uma hora.'] };
  }

  return comTrava('receberInscricao', function () {
    var d;
    try {
      d = normalizarInscricao(dados);
    } catch (e) {
      return { ok: false, problemas: [e.message] };
    }

    var problemas = validar(d);
    if (problemas.length) return { ok: false, problemas: problemas };

    var id = criarProgramacao(d, dados.idEnvio, 'página de inscrição');
    if (!id) return { ok: false, problemas: ['Não consegui registrar. Tente de novo.'] };
    return { ok: true, id: id };
  });
}

function normalizarInscricao(dados) {
  var fotos = (dados.fotos || []).slice(0, 2).map(function (f, i) {
    return blobDeEnvio(f, 'foto' + (i + 1));
  });
  return {
    banda: String(dados.banda || '').trim().slice(0, 80),
    telefone: String(dados.telefone || '').trim().slice(0, 30),
    instagram: arrobaLimpa(dados.instagram),
    dataShow: dados.data ? paraData(dados.data) : null,
    hora: paraHora(dados.hora || '20:00'),
    arquivos: fotos,
    logoArquivo: dados.logo ? blobDeEnvio(dados.logo, 'logo') : null
  };
}

function blobDeEnvio(arquivo, nomePadrao) {
  var tipo = String(arquivo.tipo || '');
  if (tipo.indexOf('image/') !== 0) {
    throw new Error('Um dos arquivos não é imagem: ' + (arquivo.nome || nomePadrao));
  }
  var bytes = Utilities.base64Decode(arquivo.conteudo);
  if (bytes.length > 15 * 1024 * 1024) {
    throw new Error('A imagem ' + (arquivo.nome || nomePadrao) + ' é grande demais.');
  }
  return Utilities.newBlob(bytes, tipo, String(arquivo.nome || nomePadrao).slice(0, 80));
}

/** Freio simples contra envio em massa. */
function segurarEnxurrada() {
  var cache = CacheService.getScriptCache();
  var chave = 'inscricoes_' + fmt(new Date(), 'yyyyMMddHH');
  var quantas = Number(cache.get(chave) || 0) + 1;
  cache.put(chave, String(quantas), 3900);
  if (quantas > MAX_INSCRICOES_POR_HORA) {
    registrar('AVISO', '', 'ENXURRADA', quantas + ' inscrições nesta hora; segurando.');
    return false;
  }
  return true;
}

/** O link que vai para as bandas. */
function linkDeInscricao() {
  var url = ScriptApp.getService().getUrl();
  return url ? url + '?inscricao=1' : '';
}
