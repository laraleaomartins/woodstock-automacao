// Monta o HTML do relatório com o MESMO código do Apps Script, usando o simulador
// que os testes já usam, e grava num arquivo para eu poder abrir e olhar.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarAmbiente } from './ambiente_falso.mjs';

const { contexto: ctx, estado } = criarAmbiente();

// Uma banda de teste com artes, para o relatório ter conteúdo.
const hoje = new Date();
const daquiA = (d) => {
  const x = new Date(hoje);
  x.setDate(x.getDate() + d);
  return x.toISOString().slice(0, 10);
};

for (const [banda, dias] of [['Jú Farias e Thiago Mazzo', 2], ['Toka Rock', 5],
                             ['Bakker Indo Trio', -3]]) {
  // A inscrição passa pela mesma porta pública que a página usa, para o relatório
  // ser montado com dados que chegaram pelo caminho de verdade.
  const r = ctx.receberInscricao({
    idEnvio: 'rel-' + banda, banda, telefone: '(62) 99999-0000',
    data: daquiA(dias), hora: '21:00',
    instagram: '@' + banda.toLowerCase().replace(/\W+/g, ''),
    couvert: '15', colabs: [], sobrenome: '', juntar: false,
    fotos: [{ nome: 'foto1.jpg', tipo: 'image/jpeg', conteudo: Buffer.from('x').toString('base64') }],
    logo: null
  });
  if (!r.ok) { console.log("inscricao recusada:", JSON.stringify(r)); continue; }
  const id = r.id;
  ctx.registrarArtesProntas(id, {
    FEED: { A: 'https://exemplo/a.jpg', B: 'https://exemplo/b.jpg', C: 'https://exemplo/c.jpg' },
    STORY: { A: 'https://exemplo/as.jpg', B: 'https://exemplo/bs.jpg', C: 'https://exemplo/cs.jpg' }
  }, ['foto1 entrou inteira, sem recortar']);
  ctx.aprovarProgramacao(id, []);
}

const faixa = ctx.periodoDoRelatorio('MENSAL');
const progs = ctx.linhas('PROGRAMACOES');
const posts = ctx.linhas('AGENDAMENTOS');
const html = ctx.montarHtmlDoRelatorio(faixa, faixa.de, faixa.ate, progs, posts);

const destino = process.argv[2];
fs.writeFileSync(destino, html, 'utf8');
console.log('html gravado:', destino, html.length, 'bytes;', progs.length, 'shows');
