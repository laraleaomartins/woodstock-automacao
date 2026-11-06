/**
 * Sobe um servidor local que se comporta como o Apps Script publicado, apoiado no
 * simulador. Serve para rodar o worker de verdade (worker/produzir.mjs) de ponta a
 * ponta, sem precisar da conta Google.
 *
 * uso: node tests/servidor_falso.mjs [porta]
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarAmbiente } from './ambiente_falso.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const PORTA = Number(process.argv[2] || 8777);

const { contexto: ctx, estado } = criarAmbiente();

/** Fotos de verdade, para o worker ter o que recortar e renderizar. */
function registrarArquivoReal(caminho, nome) {
  const id = 'arq-' + nome;
  estado.arquivos[id] = {
    id, nome, tipo: 'image/jpeg', pasta: 'entrada',
    conteudo: fs.readFileSync(caminho)
  };
  return id;
}

// O getBlob do simulador converte conteúdo em Buffer; aqui já é Buffer.
const originalGetFileById = ctx.DriveApp.getFileById;
ctx.DriveApp.getFileById = (id) => {
  const a = estado.arquivos[id];
  if (!a || !Buffer.isBuffer(a.conteudo)) return originalGetFileById(id);
  return {
    getId: () => id,
    getName: () => a.nome,
    getMimeType: () => a.tipo,
    getBlob: () => ({ getBytes: () => a.conteudo, getContentType: () => a.tipo })
  };
};

// Monta uma programação pendente, como se uma banda tivesse acabado de se inscrever.
const entrada = path.join(RAIZ, 'tmp', 'job', 'entrada');
const fotos = ['foto1.jpg', 'foto2.jpg'].map((n) => registrarArquivoReal(path.join(entrada, n), n));
const logo = registrarArquivoReal(path.join(entrada, 'logo.png'), 'logo.png');

const daquiA = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

ctx.aba('PROGRAMACOES').appendRow([
  '12DEZ_teste-ponta-a-ponta', new Date(), 'TESTE PONTA A PONTA', '(62) 99999-0000', '@testebanda',
  daquiA(9), '20:00', 'SEXTA-FEIRA', 'pasta-prog', 'AGUARDANDO_ARTES', 'APROVACAO',
  JSON.stringify({ recebidos: {
    fotos: fotos.map((id) => ({ id, nome: estado.arquivos[id].nome })),
    logo: { id: logo, nome: 'logo.png' }
  } }), '', '', 'resp-teste', new Date()
]);
estado.pastas['pasta-prog'] = { id: 'pasta-prog', nome: '12DEZ_teste', filhas: {}, arquivos: {} };

// O Apps Script baixaria as artes publicadas para o Drive; aqui elas são locais.
ctx.salvarArtesNoDrive = () => {};

const servidor = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://local');
  const responder = (saida) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(saida._texto);
  };
  if (req.method === 'GET') {
    const parametro = Object.fromEntries(url.searchParams);
    return responder(ctx.doGet({ parameter: parametro }));
  }
  let corpo = '';
  req.on('data', (c) => { corpo += c; });
  req.on('end', () => responder(ctx.doPost({ postData: { contents: corpo } })));
});

servidor.listen(PORTA, () => {
  console.log('servidor falso do Apps Script em http://127.0.0.1:' + PORTA);
  console.log('chave: chave-de-teste');
});

process.on('SIGTERM', () => servidor.close());

// Quando o worker terminar, o estado final é despejado neste arquivo para conferência.
process.on('SIGINT', () => {
  fs.writeFileSync(path.join(RAIZ, 'tmp', 'estado_final.json'),
    JSON.stringify({
      programacoes: ctx.linhas('PROGRAMACOES'),
      agendamentos: ctx.linhas('AGENDAMENTOS'),
      logs: ctx.linhas('LOGS'),
      emails: estado.emails
    }, null, 2));
  servidor.close();
  process.exit(0);
});

// Atalho para o teste: despeja o estado quando chamado com ?acao=despejar
const despejar = () => fs.writeFileSync(path.join(RAIZ, 'tmp', 'estado_final.json'),
  JSON.stringify({
    programacoes: ctx.linhas('PROGRAMACOES'),
    agendamentos: ctx.linhas('AGENDAMENTOS'),
    logs: ctx.linhas('LOGS'),
    emails: estado.emails
  }, null, 2));
const doGetOriginal = ctx.doGet;
ctx.doGet = (e) => {
  if (e && e.parameter && e.parameter.acao === 'despejar') {
    despejar();
    setTimeout(() => process.exit(0), 150);
    return ctx.json({ ok: true, despejado: true });
  }
  return doGetOriginal(e);
};
