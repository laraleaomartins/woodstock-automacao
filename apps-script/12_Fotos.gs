/**
 * As fotos de uma programação, vistas e trocadas pelo painel.
 *
 * O problema que isto resolve: o tratamento automático acerta na maioria das
 * fotos, mas não em todas. Quando erra numa, até aqui não havia saída — a
 * programação inteira ficava com o resultado ruim, ou a banda tinha de preencher o
 * formulário de novo. Agora dá para baixar a foto original, arrumar fora do
 * sistema e devolver a versão corrigida, sem incomodar quem se inscreveu.
 *
 * Três versões convivem, e NUNCA uma apaga a outra:
 *   - a ORIGINAL que a banda enviou, que fica intocada e sempre disponível;
 *   - o resultado do tratamento automático, que é refeito a cada produção;
 *   - a EDITADA à mão, quando existir.
 *
 * A regra de prioridade é uma só, e vale em toda produção: havendo editada, é ela
 * que vai para a arte. Produzir de novo não desfaz uma edição manual — seria
 * jogar fora o trabalho de quem editou, justamente no momento em que o sistema
 * está tentando de novo porque errou antes.
 */

/** A pasta onde ficam as versões editadas à mão, criada quando a primeira chega. */
function pastaDasEditadas(prog) {
  return subpasta(DriveApp.getFolderById(prog.PastaId), 'EDITADAS');
}

function recebidosDe(prog) {
  try {
    return JSON.parse(prog.Artes || '{}').recebidos || {};
  } catch (x) {
    return {};
  }
}

function gravarRecebidos(prog, recebidos) {
  var artes = {};
  try { artes = JSON.parse(prog.Artes || '{}'); } catch (x) { artes = {}; }
  artes.recebidos = recebidos;
  gravarCampos(ABA.PROGRAMACOES, prog._linha, { Artes: JSON.stringify(artes) });
}

/**
 * As fotos de uma programação, do jeito que o painel precisa mostrar.
 *
 * Cada foto vem com o que se sabe dela: o nome do arquivo, qual versão está
 * valendo, o que o tratamento automático achou dela e, quando houve problema, o
 * motivo em português.
 *
 * O estado distingue o que a MÁQUINA mediu do que a PESSOA viu. O sistema sabe
 * dizer que não conseguiu separar alguém do fundo; não sabe dizer que a arte ficou
 * feia. Misturar as duas coisas faria o painel afirmar uma capacidade que não
 * existe.
 */
function fotosDaProgramacao(prog) {
  var recebidos = recebidosDe(prog);
  return (recebidos.fotos || []).map(function (f, i) {
    var manual = f.manual || null;
    return {
      indice: i,
      nome: String(f.nome || ('foto' + (i + 1))),
      idOriginal: String(f.id || ''),
      previaOriginal: f.id ? 'https://drive.google.com/thumbnail?id=' + f.id + '&sz=w400' : '',
      editada: manual ? {
        nome: String(manual.nome || ''),
        quando: manual.quando ? fmt(new Date(manual.quando), 'dd/MM/yyyy HH:mm') : '',
        previa: 'https://drive.google.com/thumbnail?id=' + manual.id + '&sz=w400'
      } : null,
      usando: manual ? 'editada' : 'original',
      estado: String(f.estado || 'sem_informacao'),
      motivo: String(f.motivo || '')
    };
  });
}

/**
 * Guarda o que a produção descobriu sobre cada foto.
 *
 * Vem da oficina junto com as artes. Sem isto, o painel só saberia dizer que
 * "houve um erro no processamento", e quem precisa consertar teria de adivinhar
 * qual das quatro fotos é a culpada.
 */
function anotarEstadoDasFotos(prog, porFoto) {
  if (!porFoto || !porFoto.length) return;
  var recebidos = recebidosDe(prog);
  var fotos = recebidos.fotos || [];
  porFoto.forEach(function (info) {
    var i = Number(info.indice);
    if (!fotos[i]) return;
    fotos[i].estado = String(info.estado || 'ok');
    fotos[i].motivo = String(info.motivo || '');
  });
  recebidos.fotos = fotos;
  gravarRecebidos(prog, recebidos);
}

/** O arquivo que deve ser usado para esta foto: a editada, se houver. */
function arquivoValidoDaFoto(foto) {
  var manual = foto && foto.manual;
  return manual && manual.id
    ? { id: manual.id, nome: manual.nome, manual: true }
    : { id: foto.id, nome: foto.nome, manual: false };
}

// ---------------------------------------------------------------- painel

function painelFotos(chave, id) {
  exigirChave(chave);
  var prog = acharProgramacao(id);
  if (!prog) throw new Error('Programação não encontrada.');
  return fotosDaProgramacao(prog);
}

/**
 * Baixa uma foto no tamanho em que ela chegou.
 *
 * A original, e não a miniatura: o objetivo é justamente poder editá-la fora do
 * sistema, e uma imagem reduzida não serve para isso.
 */
function painelBaixarFoto(chave, id, indice, qual) {
  exigirChave(chave);
  var prog = acharProgramacao(id);
  if (!prog) throw new Error('Programação não encontrada.');

  var foto = (recebidosDe(prog).fotos || [])[Number(indice)];
  if (!foto) throw new Error('Foto não encontrada nesta programação.');

  var alvo = (qual === 'editada' && foto.manual) ? foto.manual : foto;
  var arq = DriveApp.getFileById(alvo.id);
  var blob = arq.getBlob();
  return {
    nome: arq.getName(),
    tipo: blob.getContentType(),
    conteudo: Utilities.base64Encode(blob.getBytes())
  };
}

/** Junta num .zip as fotos como estão valendo hoje, para baixar de uma vez. */
function painelBaixarFotosTodas(chave, id) {
  exigirChave(chave);
  var prog = acharProgramacao(id);
  if (!prog) throw new Error('Programação não encontrada.');

  var arquivos = [];
  var falhas = [];
  (recebidosDe(prog).fotos || []).forEach(function (foto, i) {
    [['original', foto], ['editada', foto.manual]].forEach(function (par) {
      if (!par[1] || !par[1].id) return;
      try {
        var arq = DriveApp.getFileById(par[1].id);
        var ext = (String(arq.getName()).match(/\.[A-Za-z0-9]+$/) || ['.jpg'])[0];
        arquivos.push(arq.getBlob().setName(
          'foto' + (i + 1) + '_' + par[0] + ext));
      } catch (e) {
        falhas.push('foto' + (i + 1) + ' (' + par[0] + ')');
      }
    });
  });
  if (!arquivos.length) throw new Error('Não consegui baixar nenhuma foto.');

  var zip = Utilities.zip(arquivos, id + '_fotos.zip');
  return {
    nome: zip.getName(), tipo: 'application/zip',
    conteudo: Utilities.base64Encode(zip.getBytes()),
    quantas: arquivos.length, falhas: falhas
  };
}

// Limites do que o painel aceita receber. Imagem muito pequena não tem como
// render arte de 1080 pixels sem ficar borrada, e arquivo grande demais não cabe
// no que o Apps Script consegue manipular de uma vez.
var LADO_MINIMO_EDITADA = 600;
var BYTES_MAXIMO_EDITADA = 15 * 1024 * 1024;

/**
 * Põe no lugar de uma foto a versão editada à mão.
 *
 * A original NÃO é apagada nem sobrescrita: a editada é gravada ao lado, numa
 * pasta própria, e passa a ser a que vale. Dá para voltar atrás a qualquer
 * momento, e é por isso que o botão de restaurar existe.
 *
 * Trocar uma foto não encosta nas outras — cada uma tem o seu lugar na lista.
 */
function painelSubstituirFoto(chave, id, indice, arquivo) {
  exigirChave(chave);
  var prog = acharProgramacao(id);
  if (!prog) throw new Error('Programação não encontrada.');

  var recebidos = recebidosDe(prog);
  var fotos = recebidos.fotos || [];
  var i = Number(indice);
  if (!fotos[i]) throw new Error('Foto não encontrada nesta programação.');

  var tipo = String((arquivo && arquivo.tipo) || '');
  if (tipo.indexOf('image/') !== 0) {
    throw new Error('Isso não é uma imagem. Envie um arquivo JPG ou PNG.');
  }
  var bytes = Utilities.base64Decode(arquivo.conteudo);
  if (!bytes.length) throw new Error('O arquivo chegou vazio.');
  if (bytes.length > BYTES_MAXIMO_EDITADA) {
    throw new Error('A imagem tem ' + Math.round(bytes.length / 1048576) +
      ' MB e o limite é ' + Math.round(BYTES_MAXIMO_EDITADA / 1048576) + ' MB.');
  }
  // A mesma conferência da inscrição, pela mesma função: aqui a porta é sua, mas o
  // arquivo vem de fora do sistema do mesmo jeito, e um HEIC trocado à mão quebraria
  // a produção igual.
  var nomeEnviado = String(arquivo.nome || 'enviado');
  if (!formatoDaImagem(bytes)) {
    throw new Error(recusaDeImagem(nomeEnviado, bytes));
  }
  // O LADO_MINIMO_EDITADA acima existia escrito e NINGUÉM o usava: a conferência dos
  // 600 pixels acontecia só no navegador, e uma troca feita fora da tela passava por
  // cima dela. Para quem usa o painel nada muda — o navegador já barra antes de subir.
  var pequena = problemaDeTamanho(nomeEnviado, bytes, LADO_MINIMO_EDITADA, LADO_MAXIMO_ABSURDO);
  if (pequena) throw new Error(pequena);

  var ext = tipo.indexOf('png') >= 0 ? '.png' : '.jpg';
  var nome = 'foto' + (i + 1) + '_editada_' + fmt(new Date(), 'yyyyMMdd_HHmmss') + ext;
  var novo = pastaDasEditadas(prog).createFile(
    Utilities.newBlob(bytes, tipo, nome));

  var anterior = fotos[i].manual || null;
  fotos[i].manual = { id: novo.getId(), nome: nome, quando: new Date().toISOString() };
  // Uma foto recém-editada não carrega mais o problema que o tratamento automático
  // apontou na original: esse motivo era sobre a imagem antiga.
  fotos[i].estado = 'editada';
  fotos[i].motivo = '';

  recebidos.fotos = fotos;
  recebidos.historico = registrarNoHistorico(recebidos.historico, {
    foto: i + 1, acao: 'substituída à mão',
    de: anterior ? anterior.nome : String(fotos[i].nome || ''),
    para: nome
  });
  gravarRecebidos(prog, recebidos);

  registrar('INFO', id, 'FOTO_SUBSTITUIDA',
    'foto' + (i + 1) + ' trocada pela versão editada ' + nome);
  return fotosDaProgramacao(acharProgramacao(id));
}

/** Desfaz a troca: a foto volta a ser a que a banda enviou. */
function painelRestaurarFoto(chave, id, indice) {
  exigirChave(chave);
  var prog = acharProgramacao(id);
  if (!prog) throw new Error('Programação não encontrada.');

  var recebidos = recebidosDe(prog);
  var fotos = recebidos.fotos || [];
  var i = Number(indice);
  if (!fotos[i] || !fotos[i].manual) {
    throw new Error('Esta foto não tem versão editada para desfazer.');
  }

  var saindo = fotos[i].manual;
  // O arquivo editado NÃO é apagado do Drive: ele fica na pasta EDITADAS, caso se
  // queira voltar a usá-lo. O que muda é qual versão vale.
  fotos[i].manual = null;
  fotos[i].estado = 'sem_informacao';
  fotos[i].motivo = '';

  recebidos.fotos = fotos;
  recebidos.historico = registrarNoHistorico(recebidos.historico, {
    foto: i + 1, acao: 'voltou para a original',
    de: saindo.nome, para: String(fotos[i].nome || '')
  });
  gravarRecebidos(prog, recebidos);

  registrar('INFO', id, 'FOTO_RESTAURADA', 'foto' + (i + 1) + ' voltou para a original');
  return fotosDaProgramacao(acharProgramacao(id));
}

/**
 * O histórico das trocas, guardado junto com a programação.
 *
 * Simples de propósito: uma linha por troca, com data, qual foto e o que entrou no
 * lugar do quê. Dá para saber o que foi mexido e voltar atrás, que é o necessário.
 * Guardar todas as versões de todos os arquivos seria um sistema de versionamento,
 * e isso o Drive já faz para quem precisar.
 */
function registrarNoHistorico(historico, evento) {
  var lista = [].concat(historico || []);
  lista.push({
    quando: new Date().toISOString(),
    foto: evento.foto, acao: evento.acao,
    de: String(evento.de || ''), para: String(evento.para || '')
  });
  return lista.slice(-40);
}

function painelHistoricoDeFotos(chave, id) {
  exigirChave(chave);
  var prog = acharProgramacao(id);
  if (!prog) throw new Error('Programação não encontrada.');
  return (recebidosDe(prog).historico || []).slice().reverse().map(function (h) {
    return {
      quando: fmt(new Date(h.quando), 'dd/MM/yyyy HH:mm'),
      foto: h.foto, acao: h.acao, de: h.de, para: h.para
    };
  });
}
