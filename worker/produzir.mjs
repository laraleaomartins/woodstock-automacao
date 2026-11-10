/**
 * Oficina das artes. Roda no GitHub Actions, a cada 15 minutos, sem computador ligado.
 *
 * O que faz: pergunta ao Apps Script se tem banda esperando arte, baixa as fotos,
 * prepara as imagens, roda o gerador do kit, converte as peças para JPEG (a API da Meta
 * só aceita JPEG), publica os arquivos no GitHub Pages e devolve os endereços.
 *
 * Variáveis de ambiente: APPS_SCRIPT_URL, APPS_SCRIPT_TOKEN, PAGES_BASE_URL.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const GERADOR = path.join(RAIZ, 'gerador');
const PUBLICO = path.join(RAIZ, 'docs', 'artes');
const TRABALHO = path.join(RAIZ, '.trabalho');

const URL_API = exigir('APPS_SCRIPT_URL');
const CHAVE = exigir('APPS_SCRIPT_TOKEN');
const BASE_PAGES = exigir('PAGES_BASE_URL').replace(/\/+$/, '');
const PYTHON = process.env.PYTHON_BIN || 'python3';

function exigir(nome) {
  const v = process.env[nome];
  if (!v) {
    console.error(`Falta a variável ${nome}. Configure os segredos do repositório.`);
    process.exit(1);
  }
  return v;
}

async function api(acao, parametros = {}) {
  const url = new URL(URL_API);
  url.searchParams.set('chave', CHAVE);
  url.searchParams.set('acao', acao);
  for (const [k, v] of Object.entries(parametros)) url.searchParams.set(k, v);
  const r = await fetch(url, { redirect: 'follow' });
  const texto = await r.text();
  let dados;
  try { dados = JSON.parse(texto); } catch { throw new Error(`resposta inesperada da API: ${texto.slice(0, 300)}`); }
  if (!dados.ok) throw new Error(dados.erro || 'a API recusou a chamada');
  return dados;
}

async function apiPost(corpo) {
  const r = await fetch(URL_API, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chave: CHAVE, ...corpo })
  });
  const texto = await r.text();
  let dados;
  try { dados = JSON.parse(texto); } catch { throw new Error(`resposta inesperada da API: ${texto.slice(0, 300)}`); }
  if (!dados.ok) throw new Error(dados.erro || 'a API recusou a chamada');
  return dados;
}

function rodar(cmd, args, opcoes = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opcoes });
}

async function baixarArquivo(fileId, destino) {
  const r = await api('arquivo', { id: fileId });
  fs.writeFileSync(destino, Buffer.from(r.arquivo.conteudo, 'base64'));
  return r.arquivo.nome;
}

function limpar(pasta) {
  fs.rmSync(pasta, { recursive: true, force: true });
  fs.mkdirSync(pasta, { recursive: true });
}

async function produzir(job) {
  console.log(`\n=== ${job.id} — ${job.banda} ===`);
  const entrada = path.join(TRABALHO, job.id);
  const saidaPng = path.join(TRABALHO, job.id + '_saida');
  limpar(entrada);
  limpar(saidaPng);

  for (let i = 0; i < job.fotos.length; i++) {
    const ext = path.extname(job.fotos[i].nome) || '.jpg';
    await baixarArquivo(job.fotos[i].id, path.join(entrada, `foto${i + 1}${ext}`));
  }
  if (job.logo) {
    const ext = path.extname(job.logo.nome) || '.png';
    await baixarArquivo(job.logo.id, path.join(entrada, `logo${ext}`));
  }
  console.log(`  arquivos baixados: ${job.fotos.length} foto(s)${job.logo ? ' + logo' : ''}`);

  const jsonImagens = path.join(entrada, 'imagens.json');
  const argumentos = [path.join(AQUI, 'preparar_imagens.py'), entrada, GERADOR, job.id,
    '--json', jsonImagens];
  if (job.juntar) argumentos.push('--juntar');
  // Refazer tem de tentar um caminho diferente: o recorte é determinístico, e
  // repetir a mesma conta devolveria a mesma arte.
  if (job.tentativa && job.tentativa > 1) argumentos.push('--tentativa', String(job.tentativa));
  rodar(PYTHON, argumentos, { stdio: ['ignore', 'inherit', 'inherit'] });
  const imagens = JSON.parse(fs.readFileSync(jsonImagens, 'utf8'));
  const avisos = imagens._avisos || [];
  avisos.forEach((a) => console.log(`  aviso: ${a}`));
  delete imagens._avisos;

  const show = {
    slug: job.id,
    band: job.banda,
    day: job.dia,
    weekday: job.diaSemana,
    mes: job.mes,
    mesAbrev: job.mesAbrev,
    couvert: job.couvert || '',
    ...imagens
  };
  const arquivoShow = path.join(entrada, 'show.json');
  fs.writeFileSync(arquivoShow, JSON.stringify([show], null, 1));

  rodar('node', ['render3.js', arquivoShow, saidaPng], { cwd: GERADOR, stdio: ['ignore', 'inherit', 'inherit'] });

  const destino = path.join(PUBLICO, job.id);
  limpar(destino);
  rodar(PYTHON, [path.join(AQUI, 'para_jpeg.py'), saidaPng, destino],
    { stdio: ['ignore', 'inherit', 'inherit'] });

  const artes = { FEED: {}, STORY: {} };
  for (const nome of fs.readdirSync(destino)) {
    const m = nome.match(/_([ABC])_(feed|story)\.jpg$/);
    if (!m) continue;
    artes[m[2] === 'feed' ? 'FEED' : 'STORY'][m[1]] =
      `${BASE_PAGES}/artes/${job.id}/${nome}`;
  }
  const total = Object.keys(artes.FEED).length + Object.keys(artes.STORY).length;
  if (total === 0) throw new Error('o gerador não produziu nenhuma peça');
  console.log(`  ${total} peças prontas`);
  return { artes, avisos };
}

function publicarNoRepositorio(mensagem) {
  if (process.env.PULAR_GIT === '1') {
    console.log('(teste local: não vou commitar nem publicar no GitHub Pages)');
    return false;
  }
  rodar('git', ['config', 'user.name', 'automacao-woodstock']);
  rodar('git', ['config', 'user.email', 'automacao@users.noreply.github.com']);
  rodar('git', ['add', 'docs']);
  const mudou = rodar('git', ['status', '--porcelain', 'docs']).trim();
  if (!mudou) {
    console.log('nada novo para publicar');
    return false;
  }
  rodar('git', ['commit', '-m', mensagem]);
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      rodar('git', ['push']);
      return true;
    } catch (e) {
      if (tentativa === 3) throw e;
      console.log(`  push recusado, puxando e tentando de novo (${tentativa}/3)`);
      rodar('git', ['pull', '--rebase']);
    }
  }
  return true;
}

/** Espera o GitHub Pages servir de fato o arquivo, senão a Meta recebe um 404. */
async function esperarPublicacao(url, tentativas = 20) {
  for (let i = 0; i < tentativas; i++) {
    try {
      const r = await fetch(url, { method: 'HEAD' });
      if (r.ok) return true;
    } catch { /* a página ainda não subiu */ }
    await new Promise((r) => setTimeout(r, 15000));
  }
  return false;
}

async function principal() {
  fs.mkdirSync(TRABALHO, { recursive: true });
  fs.mkdirSync(PUBLICO, { recursive: true });

  // Uma programação por rodada, não três. O recorte com matting é lento de
  // propósito — é ele que entrega a borda sem contorno — e uma banda pode mandar
  // quatro fotos. Medido na bateria: quatro fotos levaram 650 segundos, quase 11
  // minutos. A oficina do GitHub tem 25 no total, contando instalar o navegador,
  // gerar as seis peças e publicar. Com mais de uma programação o pior caso
  // estourava, e a rodada morria no meio, deixando programação marcada como
  // "gerando artes" sem arte nenhuma — o pior dos mundos, porque ela não volta
  // sozinha para a fila.
  //
  // Ninguém espera mais por isso: a rodada seguinte vem em 15 minutos, e o
  // Apps Script empurra uma na hora assim que uma banda se inscreve. Duas bandas
  // no mesmo minuto é o caso raro; a segunda sai no ciclo seguinte.
  const { jobs } = await api('jobs', { limite: 1 });
  if (!jobs.length) {
    console.log('Nenhuma banda esperando arte.');
    return;
  }
  console.log(`${jobs.length} programação(ões) na fila.`);

  const prontos = [];
  for (const job of jobs) {
    try {
      prontos.push({ job, ...(await produzir(job)) });
    } catch (e) {
      console.error(`  FALHOU: ${e.message}`);
      await apiPost({ acao: 'falha_artes', id: job.id, erro: e.message.slice(0, 600) });
    }
  }

  if (!prontos.length) return;

  publicarNoRepositorio('artes: ' + prontos.map((p) => p.job.id).join(', '));

  const primeira = Object.values(prontos[0].artes.FEED)[0] ||
    Object.values(prontos[0].artes.STORY)[0];
  if (primeira && process.env.PULAR_GIT !== '1') {
    const noAr = await esperarPublicacao(primeira);
    console.log(noAr ? 'GitHub Pages já está servindo as artes.'
      : 'Atenção: o GitHub Pages ainda não respondeu; as artes podem demorar a aparecer.');
  }

  for (const { job, artes, avisos } of prontos) {
    try {
      await apiPost({ acao: 'artes_prontas', id: job.id, artes, avisos });
      console.log(`  ${job.id}: entregue ao Apps Script.`);
    } catch (e) {
      console.error(`  ${job.id}: as artes ficaram prontas mas a entrega falhou: ${e.message}`);
      process.exitCode = 1;
    }
  }
}

principal().catch((e) => {
  console.error(e);
  process.exit(1);
});
