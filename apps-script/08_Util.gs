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
