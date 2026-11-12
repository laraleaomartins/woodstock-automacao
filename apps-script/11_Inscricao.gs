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

// O tamanho para o qual a PÁGINA encolhe a foto antes de enviar. Não é uma recusa:
// foto maior que isso é reduzida no navegador, e sobe reduzida.
var LADO_MAXIMO_FOTO = 2400;

// O teto que o SERVIDOR recusa, e que existe só para envio feito fora da página.
// Nenhum celular produz imagem desse tamanho — o maior lado de uma foto de celular
// de hoje fica perto de 4 mil pixels, e a página ainda encolhe para 2400 antes de
// mandar. Serve para uma imagem gigante não derrubar a oficina por falta de memória.
var LADO_MAXIMO_ABSURDO = 12000;

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
  var fotos = (dados.fotos || []).slice(0, 4).map(function (f, i) {
    return blobDeEnvio(f, 'foto' + (i + 1));
  });
  return {
    banda: String(dados.banda || '').trim().slice(0, 80),
    telefone: String(dados.telefone || '').trim().slice(0, 30),
    instagram: arrobaLimpa(dados.instagram),
    dataShow: dados.data ? paraData(dados.data) : null,
    hora: paraHora(dados.hora || '20:00'),
    arquivos: fotos,
    logoArquivo: dados.logo ? blobDeEnvio(dados.logo, 'logo') : null,
    juntar: dados.juntar === true,
    couvert: valorDeCouvert(dados.couvert),
    tributo: nomeDoTributo(dados.tributo),
    colabs: perfisDeColaboracao(dados.colabs)
  };
}

/**
 * Aceita o couvert do jeito que a pessoa escrever e devolve só o número.
 *
 * Quem preenche escreve "15", "R$ 15", "15,00" ou "20.00", e os quatro querem dizer
 * a mesma coisa. Guardar o texto cru faria a arte sair com "R$ R$ 15". Em branco é
 * resposta válida: nem todo show tem couvert, e nesse caso a arte sai sem a linha.
 */
function valorDeCouvert(bruto) {
  var texto = String(bruto == null ? '' : bruto).replace(/[^0-9,.]/g, '').trim();
  if (!texto) return '';

  // Ponto é ambíguo: em "1.500" separa milhar, em "20.00" separa centavos. Vírgula
  // nunca é ambígua aqui — quem escreve vírgula está escrevendo centavos. Então:
  // havendo vírgula, ela manda e os pontos são milhar; não havendo, um ponto com
  // dois dígitos depois é centavo, e qualquer outro é milhar. Sem esta distinção,
  // "20.00" vira vinte mil reais na arte.
  var normalizado;
  if (texto.indexOf(',') >= 0) {
    normalizado = texto.replace(/\./g, '').replace(',', '.');
  } else if (/^\d+\.\d{2}$/.test(texto)) {
    normalizado = texto;
  } else {
    normalizado = texto.replace(/\./g, '');
  }
  var numero = Number(normalizado);
  if (!isFinite(numero) || numero <= 0) return '';
  // Sem centavos quando são zero: "R$15" é como a arte do kit escreve.
  return numero % 1 === 0 ? String(Math.round(numero))
    : numero.toFixed(2).replace('.', ',');
}

/**
 * A banda homenageada, quando o show é tributo.
 *
 * Guardado como texto limpo e nada mais: o sistema não confere se a banda existe
 * nem corrige o nome. Quem escreve é quem vai tocar, e inventar correção aqui
 * daria "Legião Urbana" virando outra coisa sem ninguém pedir.
 */
function nomeDoTributo(bruto) {
  return String(bruto == null ? '' : bruto).trim().slice(0, 80);
}

/**
 * O perfil que vai assinar a publicação junto com o bar.
 *
 * UM, e não três. O Instagram aceita até três coautores, e enquanto o sistema
 * mandava o convite sozinho fazia sentido coletar os três. Hoje quem convida é o
 * bar, à mão, e o que o formulário precisa saber é de quem é o perfil que assina
 * junto. Pedir três campos à banda para usar um é pedir trabalho que não vira nada.
 *
 * Continua devolvendo lista: o campo guardado é uma lista, e trocar o formato
 * quebraria a leitura das inscrições que já existem.
 */
function perfisDeColaboracao(lista) {
  var vistos = {};
  return [].concat(lista || [])
    .map(function (p) { return arrobaLimpa(p); })
    .filter(function (p) {
      if (!p || vistos[p]) return false;
      vistos[p] = true;
      return true;
    })
    .slice(0, 1);
}

function blobDeEnvio(arquivo, nomePadrao) {
  var nome = String(arquivo.nome || nomePadrao);
  var tipo = String(arquivo.tipo || '');
  if (tipo.indexOf('image/') !== 0) {
    throw new Error('Um dos arquivos não é imagem: ' + nome);
  }
  var bytes = Utilities.base64Decode(arquivo.conteudo);
  if (!bytes || !bytes.length) {
    throw new Error('O arquivo ' + nome + ' chegou vazio.');
  }
  if (bytes.length > 15 * 1024 * 1024) {
    throw new Error('A imagem ' + nome + ' é grande demais.');
  }
  // O tipo acima é o que quem envia DIZ que mandou, e a inscrição é pública. Quem
  // responde de verdade são os primeiros bytes do arquivo, que quem envia não
  // escolhe. Sem isto, bastava chamar qualquer arquivo de "image/png" para ele ser
  // gravado no Drive e depois baixado por quem opera o painel.
  //
  // O HEIC do iPhone é recusado AQUI, e não por descuido: a preparação das imagens
  // não abre esse formato. Antes ele era aceito e a arte falhava minutos depois, com
  // um recado que a banda não entende e que chega quando ela já foi embora.
  if (!formatoDaImagem(bytes)) {
    throw new Error(recusaDeImagem(nome, bytes));
  }
  // De propósito, a inscrição NÃO ganha um mínimo de tamanho. A página aceita foto
  // pequena hoje: ela sai borrada na arte, e quem decide se dá para usar é quem
  // aprova, no painel. Passar a recusar aqui seria recusar o que hoje funciona, e a
  // banda ficaria sem nenhuma arte em vez de uma arte ruim.
  //
  // O limite de 2400 da página também não é uma recusa: ali ele ENCOLHE a foto. Então
  // o único teto escrito aqui é o absurdo, que nenhum celular alcança e que serve de
  // guarda contra envio feito fora da página.
  var grandeDemais = problemaDeTamanho(nome, bytes, 0, LADO_MAXIMO_ABSURDO);
  if (grandeDemais) throw new Error(grandeDemais);
  return Utilities.newBlob(bytes, tipo, nome.slice(0, 80));
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
