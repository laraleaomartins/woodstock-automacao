/**
 * Testes da oficina — o programa que roda no GitHub e produz as artes.
 *
 * Aqui mora uma responsabilidade que é fácil de quebrar sem perceber: quando algo
 * dá errado lá, é esta parte que decide O QUE a pessoa vai ler no painel. Durante
 * um tempo ela mandava "Command failed: python /home/runner/work/..." — o comando
 * inteiro, sem o motivo. A preparação das imagens recusava uma foto com uma
 * explicação boa, dizendo exatamente o que reenviar, e essa explicação se perdia
 * no caminho.
 *
 * uso: node tests/testar_oficina.mjs
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let passou = 0;
let falhou = 0;

function conferir(ok, oque) {
  if (ok) { passou++; console.log('   ok   ' + oque); }
  else { falhou++; console.log('   FALHA ' + oque); }
}

// A função é lida do próprio arquivo da oficina, para o teste não se desatualizar
// em relação ao que roda de verdade.
const fonte = fs.readFileSync(path.join(RAIZ, 'worker', 'produzir.mjs'), 'utf8');
const corpo = fonte.slice(fonte.indexOf('function rodarContandoOErro'),
                          fonte.indexOf('async function baixarArquivo'));
const rodarContandoOErro = new Function('spawnSync', 'process',
  corpo + '; return rodarContandoOErro;')(spawnSync, process);

function erroDe(script) {
  try {
    rodarContandoOErro(process.execPath, ['-e', script]);
    return null;
  } catch (e) {
    return e.message;
  }
}

console.log('\nTESTES DA OFICINA');

console.log('\n• A explicação do programa que falhou chega inteira');
const pedido = 'Mande essa foto já recortada em PNG com fundo transparente';
const msg = erroDe(
  'process.stderr.write("Traceback (most recent call last):" + String.fromCharCode(10) +' +
  ' "RuntimeError: ' + pedido + '" + String.fromCharCode(10)); process.exit(1)');
conferir(msg !== null, 'a falha foi percebida');
conferir(msg && msg.includes(pedido), 'o pedido chegou junto: ' + String(msg).slice(0, 70));
conferir(msg && !msg.includes('Command failed'),
  'e não virou "Command failed", que não diz nada a quem lê o painel');
conferir(msg && !msg.startsWith('RuntimeError:'),
  'sem o nome técnico do erro na frente');

console.log('\n• Morte sem mensagem nenhuma é explicada, não deixada em branco');
// É o que acontece quando o sistema operacional mata o programa por falta de
// memória: não sobra erro, o processo só deixa de existir.
const calado = erroDe('process.exit(137)');
conferir(calado && calado.includes('sem deixar mensagem'),
  'avisa que parou sem mensagem');
conferir(calado && calado.includes('falta de memória'),
  'e aponta a causa mais provável, em vez de deixar sem pista');

console.log('\n• Quando dá certo, não inventa erro');
let deuCerto = true;
try { rodarContandoOErro(process.execPath, ['-e', 'process.exit(0)']); }
catch { deuCerto = false; }
conferir(deuCerto, 'programa que termina bem não levanta falha');

console.log('\n======================================');
console.log(`${passou} verificações passaram, ${falhou} falharam\n`);
process.exit(falhou ? 1 : 0);
