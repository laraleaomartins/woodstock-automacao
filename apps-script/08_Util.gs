/** Utilitários compartilhados. */

function planilhaControle() {
  var id = segredo('PLANILHA_ID');
  if (id) return SpreadsheetApp.openById(id);
  var ativa = SpreadsheetApp.getActiveSpreadsheet();
  if (ativa) return ativa;
  throw new Error('Planilha de controle não configurada. Rode instalar() uma vez.');
}

function aba(nome) {
  var s = planilhaControle().getSheetByName(nome);
  if (!s) throw new Error('Aba ' + nome + ' não existe. Rode instalar().');
  return s;
}

function pastaRaiz() {
  var id = segredo('PASTA_RAIZ_ID');
  if (!id) throw new Error('Pasta raiz não configurada. Rode instalar().');
  return DriveApp.getFolderById(id);
}

/** Cria a subpasta se ainda não existir, e devolve sempre a mesma. */
function subpasta(pai, nome) {
  var it = pai.getFoldersByName(nome);
  return it.hasNext() ? it.next() : pai.createFolder(nome);
}

function registrar(nivel, programacao, evento, detalhe) {
  var texto = limparSegredos(String(detalhe === undefined ? '' : detalhe)).slice(0, 2000);
  try {
    aba(ABA.LOGS).appendRow([new Date(), nivel, programacao || '', evento, texto]);
  } catch (e) {
    console.error('falha ao registrar: ' + e);
  }
  console.log(nivel + ' | ' + evento + ' | ' + (programacao || '') + ' | ' + texto);
}

/** Nunca deixa token vazar para log, planilha ou e-mail. */
/**
 * Que imagem é esta, de verdade?
 *
 * Olha a marca impressa nos primeiros bytes do arquivo, e não o que o arquivo DIZ
 * ser. O que ele diz é escolhido por quem envia: a inscrição é pública, e bastava
 * chamar qualquer arquivo de "image/png" para ele ser gravado no Drive e, depois,
 * baixado pela pessoa que opera o painel.
 *
 * A lista é a dos formatos que a preparação das imagens CONSEGUE ABRIR. Ela não é
 * mais curta do que isso de propósito: a página de inscrição só converte a foto
 * quando precisa encolher, então foto que já cabe no limite sobe no formato em que
 * saiu do celular. Uma lista só com PNG e JPEG recusaria envio que hoje funciona.
 *
 * Devolve o nome do formato, ou null quando não reconhece nada.
 */
function formatoDaImagem(bytes) {
  if (!bytes || bytes.length < 12) return null;
  // Os bytes chegam com sinal; o "& 255" devolve o número de 0 a 255.
  var b = [];
  for (var i = 0; i < 12; i++) b.push(bytes[i] & 255);
  var texto = function (de, ate) {
    var t = '';
    for (var j = de; j < ate; j++) t += String.fromCharCode(b[j]);
    return t;
  };

  if (b[0] === 0x89 && texto(1, 4) === 'PNG') return 'PNG';
  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'JPEG';
  if (texto(0, 4) === 'GIF8') return 'GIF';
  if (texto(0, 2) === 'BM') return 'BMP';
  if ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2A && b[3] === 0x00) ||
      (b[0] === 0x4D && b[1] === 0x4D && b[2] === 0x00 && b[3] === 0x2A)) return 'TIFF';
  if (texto(0, 4) === 'RIFF' && texto(8, 12) === 'WEBP') return 'WEBP';
  // AVIF e HEIC são parentes e começam igual: o que os distingue é a marca que vem
  // depois de "ftyp". O AVIF a preparação abre; o HEIC não.
  if (texto(4, 8) === 'ftyp') {
    var marca = texto(8, 12).toLowerCase();
    if (marca === 'avif' || marca === 'avis') return 'AVIF';
    return null;
  }
  return null;
}

/**
 * É foto de iPhone no formato que a preparação não abre?
 *
 * Existe só para o recado ser útil. Dizer "não reconheci este arquivo" a quem mandou
 * uma foto do próprio celular não ajuda ninguém: a pessoa olha a foto, vê uma foto, e
 * não entende. Sabendo que é HEIC dá para dizer o que fazer.
 */
function ehHeic(bytes) {
  if (!bytes || bytes.length < 12) return false;
  var t = '';
  for (var i = 4; i < 12; i++) t += String.fromCharCode(bytes[i] & 255);
  if (t.slice(0, 4) !== 'ftyp') return false;
  var marca = t.slice(4, 8).toLowerCase();
  return marca === 'heic' || marca === 'heix' || marca === 'hevc' ||
         marca === 'heim' || marca === 'heis' || marca === 'mif1' || marca === 'msf1';
}

/** O recado para quem mandou um arquivo que não dá para usar. */
function recusaDeImagem(nome, bytes) {
  if (ehHeic(bytes)) {
    return 'A foto ' + nome + ' está no formato HEIC, do iPhone, que o sistema não ' +
      'consegue abrir. No iPhone: Ajustes › Câmera › Formatos › Mais Compatível, e ' +
      'tire a foto de novo. Ou mande uma captura de tela da foto, que já sai em ' +
      'formato comum.';
  }
  return 'O arquivo ' + nome + ' não é uma imagem que o sistema consiga abrir. ' +
    'Mande em JPG ou PNG.';
}

function limparSegredos(texto) {
  var props = PropertiesService.getScriptProperties().getProperties();
  var saida = texto;
  ['IG_TOKEN', 'API_TOKEN', 'FB_APP_SECRET'].forEach(function (k) {
    var v = props[k];
    if (v && v.length > 8) saida = saida.split(v).join('***' + k + '***');
  });
  return saida.replace(/(access_token=)[A-Za-z0-9_\-\.]+/g, '$1***');
}

var DIAS_SEMANA = ['DOMINGO', 'SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA',
  'SEXTA-FEIRA', 'SÁBADO'];
var MESES = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO',
  'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
var MESES_ABREV = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

/** Aceita 2026-12-05, 05/12/2026 e objeto Date; devolve Date. */
function paraData(valor) {
  if (valor instanceof Date && !isNaN(valor.getTime())) {
    return new Date(valor.getFullYear(), valor.getMonth(), valor.getDate());
  }
  var t = String(valor).trim();
  var m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  var d = new Date(t);
  if (!isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  throw new Error('Data do show não reconhecida: ' + valor);
}

/** Aceita "20:00", "8:00 PM", "20h"; devolve {h, min}. */
function paraHora(valor) {
  if (valor instanceof Date && !isNaN(valor.getTime())) {
    return { h: valor.getHours(), min: valor.getMinutes() };
  }
  var t = String(valor).trim().toUpperCase();

  // Rede de segurança: se vier um texto de data inteiro ("SAT DEC 30 1899 08:00:00..."),
  // pegar "os primeiros números" acharia o dia e o ano em vez da hora.
  var comoData = t.match(/\b(\d{1,2}):(\d{2})(?::\d{2})?\b/);
  if (comoData && /\d{4}/.test(t)) {
    return { h: Math.min(Number(comoData[1]), 23), min: Number(comoData[2]) };
  }

  var pm = t.indexOf('PM') >= 0, am = t.indexOf('AM') >= 0;
  var m = t.match(/(\d{1,2})\s*[:H]?\s*(\d{2})?/);
  if (!m) return { h: 20, min: 0 };
  var h = Number(m[1]), min = Number(m[2] || 0);
  if (pm && h < 12) h += 12;
  if (am && h === 12) h = 0;
  if (h > 23) h = 23;
  return { h: h, min: min };
}

/** Junta data e hora num instante só. */
function instante(data, hora) {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate(), hora.h, hora.min, 0, 0);
}

function fmt(data, padrao) {
  return Utilities.formatDate(data, TZ, padrao);
}

/** Identificador no mesmo formato do kit: 05DEZ_nome-da-banda */
function slugDe(data, banda) {
  return fmt(data, 'dd') + MESES_ABREV[data.getMonth()] + '_' + normalizar(banda);
}

function normalizar(texto) {
  return String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

function arrobaLimpa(texto) {
  var t = String(texto || '').trim();
  var m = t.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  if (m) t = m[1];
  t = t.replace(/^@+/, '').replace(/\/+$/, '').trim();
  return t ? '@' + t : '';
}

/** Lê uma aba inteira como lista de objetos, com o número da linha junto. */
function linhas(nomeAba) {
  var dados = aba(nomeAba).getDataRange().getValues();
  if (dados.length < 2) return [];
  var cab = dados[0];
  var saida = [];
  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][0]).trim() === '') continue;
    var o = { _linha: i + 1 };
    for (var c = 0; c < cab.length; c++) o[cab[c]] = dados[i][c];
    saida.push(o);
  }
  return saida;
}

function gravarCampos(nomeAba, numeroLinha, valores) {
  var planilha = aba(nomeAba);
  var cab = planilha.getRange(1, 1, 1, planilha.getLastColumn()).getValues()[0];
  Object.keys(valores).forEach(function (campo) {
    var c = cab.indexOf(campo);
    if (c < 0) throw new Error('Coluna ' + campo + ' não existe em ' + nomeAba);
    planilha.getRange(numeroLinha, c + 1).setValue(valores[campo]);
  });
  // Só carimba a hora quando quem chamou não definiu ela própria.
  var ca = cab.indexOf('AtualizadoEm');
  if (ca >= 0 && !('AtualizadoEm' in valores)) {
    planilha.getRange(numeroLinha, ca + 1).setValue(new Date());
  }
}

function gravarCampo(nomeAba, numeroLinha, campo, valor) {
  var v = {};
  v[campo] = valor;
  gravarCampos(nomeAba, numeroLinha, v);
}

function comTrava(nome, fn) {
  var trava = LockService.getScriptLock();
  if (!trava.tryLock(30000)) throw new Error('Outra execução está em andamento: ' + nome);
  try { return fn(); } finally { trava.releaseLock(); }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Devolve sempre "HH:MM", venha o horário como texto ou como valor de hora da
 * planilha (que chega como data de 1899 e, cru, apareceria assim para quem lê).
 */
function horaTexto(valor) {
  var h = paraHora(valor);
  return pad2(h.h) + ':' + pad2(h.min);
}
