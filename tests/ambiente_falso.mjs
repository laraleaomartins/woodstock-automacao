/**
 * Simulador do ambiente do Google Apps Script.
 *
 * Serve para rodar e testar o cérebro do sistema aqui, antes de instalar na conta
 * da usuária: planilha, Drive, e-mail, trava e chamadas externas viram objetos de
 * mentira guardados na memória, e o código de verdade roda em cima deles sem saber
 * a diferença.
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const FONTES = path.resolve(AQUI, '..', 'apps-script');

export function criarAmbiente() {
  const estado = {
    abas: {},            // nome -> matriz de células
    props: {},
    cache: {},
    pastas: {},
    arquivos: {},
    emails: [],
    chamadasExternas: [],
    logConsole: []
  };

  let proximoId = 1;
  const novoId = (p) => p + (proximoId++);

  // ---------- planilha ----------
  function folha(nome) {
    if (!estado.abas[nome]) estado.abas[nome] = [];
    const celulas = () => estado.abas[nome];
    const largura = () => celulas().reduce((m, l) => Math.max(m, l.length), 0);
    const garantir = (r, c) => {
      while (celulas().length < r) celulas().push([]);
      const linha = celulas()[r - 1];
      while (linha.length < c) linha.push('');
    };
    const faixa = (r, c, nr = 1, nc = 1) => ({
      getValues() {
        const saida = [];
        for (let i = 0; i < nr; i++) {
          const linha = celulas()[r - 1 + i] || [];
          const l = [];
          for (let j = 0; j < nc; j++) l.push(linha[c - 1 + j] === undefined ? '' : linha[c - 1 + j]);
          saida.push(l);
        }
        return saida;
      },
      setValues(m) {
        m.forEach((linha, i) => linha.forEach((v, j) => {
          garantir(r + i, c + j);
          celulas()[r + i - 1][c + j - 1] = v;
        }));
        return faixa(r, c, nr, nc);
      },
      setValue(v) { garantir(r, c); celulas()[r - 1][c - 1] = v; return faixa(r, c, nr, nc); },
      setNumberFormat() { return faixa(r, c, nr, nc); },
      setFontWeight() { return faixa(r, c, nr, nc); },
      setBackground() { return faixa(r, c, nr, nc); },
      setFontColor() { return faixa(r, c, nr, nc); }
    });
    return {
      getName: () => nome,
      appendRow(linha) { celulas().push(linha.slice()); },
      getDataRange: () => faixa(1, 1, Math.max(celulas().length, 1), Math.max(largura(), 1)),
      getRange: (r, c, nr, nc) => faixa(r, c, nr, nc),
      getLastRow: () => celulas().length,
      getLastColumn: () => largura(),
      setFrozenRows() { return this; },
      setColumnWidth() { return this; }
    };
  }

  const planilha = {
    getId: () => 'planilha-de-teste',
    getUrl: () => 'https://docs.google.com/spreadsheets/d/planilha-de-teste',
    getSheetByName: (n) => (estado.abas[n] ? folha(n) : null),
    insertSheet(n) { estado.abas[n] = []; return folha(n); },
    getSheets: () => Object.keys(estado.abas).map(folha),
    deleteSheet(s) { delete estado.abas[s.getName()]; },
    setSpreadsheetTimeZone() { return this; }
  };

  // ---------- Drive ----------
  function pasta(id, nome) {
    estado.pastas[id] = estado.pastas[id] || { id, nome, filhas: {}, arquivos: {} };
    const p = estado.pastas[id];
    return {
      getId: () => id,
      getName: () => p.nome,
      createFolder(n) {
        const fid = novoId('pasta-');
        p.filhas[n] = fid;
        estado.pastas[fid] = { id: fid, nome: n, filhas: {}, arquivos: {} };
        return pasta(fid, n);
      },
      getFoldersByName(n) {
        const fid = p.filhas[n];
        let usado = false;
        return { hasNext: () => !!fid && !usado, next: () => { usado = true; return pasta(fid, n); } };
      },
      createFile(nomeOuBlob, conteudo, tipo) {
        const nomeArq = typeof nomeOuBlob === 'string' ? nomeOuBlob : nomeOuBlob.getName();
        const fid = novoId('arq-');
        estado.arquivos[fid] = {
          id: fid, nome: nomeArq, tipo: tipo || 'application/octet-stream',
          conteudo: typeof conteudo === 'string' ? conteudo : '(binário)', pasta: id
        };
        p.arquivos[nomeArq] = fid;
        return arquivo(fid);
      },
      getFilesByName(n) {
        const fid = p.arquivos[n];
        let usado = false;
        return { hasNext: () => !!fid && !usado, next: () => { usado = true; return arquivo(fid); } };
      }
    };
  }

  function arquivo(id) {
    const a = estado.arquivos[id];
    if (!a) throw new Error('arquivo inexistente: ' + id);
    return {
      getId: () => id,
      getName: () => a.nome,
      getMimeType: () => a.tipo,
      setTrashed(v) { a.lixo = v; return this; },
      makeCopy(nome, destino) {
        const fid = novoId('arq-');
        estado.arquivos[fid] = { ...a, id: fid, nome, pasta: destino.getId() };
        estado.pastas[destino.getId()].arquivos[nome] = fid;
        return arquivo(fid);
      },
      getBlob: () => ({
        getBytes: () => Buffer.from(String(a.conteudo)),
        getContentType: () => a.tipo,
        setName(n) { a.nome = n; return this; },
        getName: () => a.nome
      })
    };
  }

  // ---------- formatação de data ----------
  function formatar(data, _tz, padrao) {
    const d = data instanceof Date ? data : new Date(data);
    const p2 = (n) => String(n).padStart(2, '0');
    return padrao
      .replace(/yyyy/g, d.getFullYear())
      .replace(/MM/g, p2(d.getMonth() + 1))
      .replace(/dd/g, p2(d.getDate()))
      .replace(/HH/g, p2(d.getHours()))
      .replace(/mm/g, p2(d.getMinutes()));
  }

  const contexto = {
    console: {
      log: (...a) => estado.logConsole.push(a.join(' ')),
      error: (...a) => estado.logConsole.push('ERRO ' + a.join(' '))
    },
    JSON, Date, Math, Number, String, Object, Array, Error, RegExp, isNaN, parseInt, parseFloat,
    encodeURIComponent, decodeURIComponent, Buffer, setTimeout,

    SpreadsheetApp: {
      openById: () => planilha,
      getActiveSpreadsheet: () => null,
      create: () => planilha
    },
    DriveApp: {
      getFolderById: (id) => pasta(id, (estado.pastas[id] || {}).nome || 'pasta'),
      createFolder: (n) => { const fid = novoId('pasta-'); estado.pastas[fid] = { id: fid, nome: n, filhas: {}, arquivos: {} }; return pasta(fid, n); },
      getFoldersByName: () => ({ hasNext: () => false, next: () => null }),
      getFileById: (id) => arquivo(id)
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (k in estado.props ? estado.props[k] : null),
        setProperty: (k, v) => { estado.props[k] = v; },
        getProperties: () => ({ ...estado.props })
      })
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => (k in estado.cache ? estado.cache[k] : null),
        put: (k, v) => { estado.cache[k] = v; },
        remove: (k) => { delete estado.cache[k]; }
      })
    },
    LockService: {
      getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} })
    },
    MailApp: {
      sendEmail: (o) => estado.emails.push(o)
    },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'teste@exemplo.com' }) },
    ScriptApp: {
      getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/teste/exec' }),
      getProjectTriggers: () => [],
      newTrigger: () => ({
        forForm: () => ({ onFormSubmit: () => ({ create: () => {} }) }),
        timeBased: () => ({
          everyMinutes: () => ({ create: () => {} }),
          everyDays: () => ({ atHour: () => ({ create: () => {} }) })
        })
      })
    },
    Utilities: {
      formatDate: formatar,
      getUuid: () => 'uuid-' + (proximoId++),
      base64Encode: (b) => Buffer.from(b).toString('base64'),
      base64Decode: (s) => Buffer.from(String(s), 'base64'),
      newBlob: (bytes, tipo, nome) => {
        let n = nome;
        return {
          getBytes: () => bytes,
          getContentType: () => tipo,
          getName: () => n,
          setName(x) { n = x; return this; }
        };
      },
      base64EncodeWebSafe: (b) => Buffer.from(String(b)).toString('base64url'),
      computeDigest: (_a, t) => Buffer.from(String(t)),
      DigestAlgorithm: { MD5: 'MD5' },
      sleep: () => {}
    },
    UrlFetchApp: {
      fetch: (url, opcoes) => {
        estado.chamadasExternas.push({ url, opcoes });
        return {
          getResponseCode: () => 200,
          getContentText: () => JSON.stringify({ id: 'falso-' + (proximoId++) }),
          getBlob: () => ({ setName: (n) => ({ getName: () => n }) })
        };
      }
    },
    ContentService: {
      createTextOutput: (t) => ({ setMimeType: () => ({ _texto: t }), _texto: t }),
      MimeType: { JSON: 'JSON' }
    },
    HtmlService: {
      createHtmlOutput: (h) => ({ setTitle: () => ({ addMetaTag: () => ({ _html: h }), _html: h }) }),
      createHtmlOutputFromFile: (nome) => ({
        getContent: () => fs.readFileSync(path.join(FONTES, nome + '.html'), 'utf8')
      }),
      createTemplateFromFile: () => ({ evaluate: () => ({ setTitle: () => ({ addMetaTag: () => ({}) }) }) })
    },
    MimeType: { PLAIN_TEXT: 'text/plain' },
    FormApp: { create: () => { throw new Error('formulário não é simulado'); } }
  };
  contexto.globalThis = contexto;

  vm.createContext(contexto);
  for (const f of fs.readdirSync(FONTES).filter((x) => x.endsWith('.gs')).sort()) {
    vm.runInContext(fs.readFileSync(path.join(FONTES, f), 'utf8'), contexto, { filename: f });
  }

  // O motor de artes e publicação está DESLIGADO no sistema de verdade desde
  // 12/11/2026 — ver MOTOR_DE_ARTES_LIGADO, em 00_Config.gs. Aqui ele é ligado de
  // propósito: estas baterias existem para provar que o motor continua funcionando,
  // e é isso que permite religá-lo um dia sem redescobrir os defeitos que ele já
  // custou. Que no sistema real ele venha desligado é conferido num teste próprio,
  // que lê a constante no arquivo.
  contexto.MOTOR_DE_ARTES_LIGADO = true;

  // Preparo mínimo: propriedades e abas, como a instalação deixaria.
  estado.props.PLANILHA_ID = 'planilha-de-teste';
  estado.props.PASTA_RAIZ_ID = 'pasta-raiz';
  estado.props.API_TOKEN = 'chave-de-teste';
  estado.pastas['pasta-raiz'] = { id: 'pasta-raiz', nome: 'WOODSTOCK-ARTES', filhas: {}, arquivos: {} };

  const cab = {
    PROGRAMACOES: contexto.COL_PROGRAMACOES,
    AGENDAMENTOS: contexto.COL_AGENDAMENTOS,
    LOGS: contexto.COL_LOGS
  };
  for (const [nome, colunas] of Object.entries(cab)) estado.abas[nome] = [colunas.slice()];
  estado.abas.CONFIG = [['Chave', 'Valor', 'O que faz'], ...contexto.CONFIG_PADRAO.map((c) => c.slice())];

  return { contexto, estado };
}
