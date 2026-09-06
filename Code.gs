/**
 * Portal de Extensão Universitária — API (Google Apps Script)
 * Backend desacoplado: responde apenas JSON, consumido pelo site estático via fetch().
 * A planilha vinculada a este script é o banco de dados (abas Submissoes e Config).
 * Autenticação do painel administrativo por senha (aba Config, chave ADMIN_PASSWORD).
 */

const SHEET_SUBMISSOES = 'Submissoes';
const SHEET_CONFIG = 'Config';

const CABECALHOS_SUBMISSOES = [
  'ID', 'Timestamp', 'Email_Autor', 'Titulo', 'Autores', 'Orientador',
  'Resumo', 'Proposta', 'Objetivo', 'Planejamento', 'Atividades', 'Resultados',
  'Drive_Folder_URL', 'Fotos_URLs', 'Video_URL',
  'Docx_Report_URL', 'Pdf_Report_URL', 'Pptx_Banner_URL', 'Status'
];

const CABECALHOS_CONFIG = ['Chave', 'Valor'];

// Senha usada apenas na primeira configuração da planilha — troque pela tela de configurações do site.
const SENHA_ADMIN_PADRAO = 'admin123';

// ===== Roteamento HTTP =====

function doGet(e) {
  return processarRequisicao_(e);
}

function doPost(e) {
  return processarRequisicao_(e);
}

function processarRequisicao_(e) {
  let acao = '';
  let corpo = {};

  try {
    if (e && e.parameter && e.parameter.action) acao = e.parameter.action;
    if (e && e.postData && e.postData.contents) {
      try {
        corpo = JSON.parse(e.postData.contents);
        if (corpo.action) acao = corpo.action;
      } catch (erroParse) {
        return responderJson_({ sucesso: false, erro: 'Corpo da requisição não é um JSON válido.' });
      }
    }
    if (!acao) return responderJson_({ sucesso: false, erro: 'Parâmetro "action" ausente na requisição.' });

    let resultado;
    switch (acao) {
      case 'ping':
        resultado = { sucesso: true, mensagem: 'API do Portal de Extensão ativa.' };
        break;
      case 'salvarSubmissao':
        resultado = { sucesso: true, dados: salvarSubmissao_(corpo.dados, corpo.fotos, corpo.videoUrl, corpo.emailAutor) };
        break;
      case 'login':
        resultado = { sucesso: true, dados: validarSenhaAdmin_(corpo.senha) };
        break;
      case 'alterarSenhaAdmin':
        resultado = { sucesso: true, dados: alterarSenhaAdmin_(corpo.senhaAtual, corpo.novaSenha) };
        break;
      case 'obterTodasSubmissoes':
        exigirSenhaValida_(corpo.senha);
        resultado = { sucesso: true, dados: obterTodasSubmissoes_() };
        break;
      case 'gerarArquivosWordEPdf':
        exigirSenhaValida_(corpo.senha);
        resultado = { sucesso: true, dados: gerarArquivosWordEPdf_(corpo.id) };
        break;
      case 'gerarBannerPowerPoint':
        exigirSenhaValida_(corpo.senha);
        resultado = { sucesso: true, dados: gerarBannerPowerPoint_(corpo.id) };
        break;
      case 'gerarTodosOsArquivos':
        exigirSenhaValida_(corpo.senha);
        resultado = { sucesso: true, dados: gerarTodosOsArquivos_(corpo.id) };
        break;
      case 'obterConfigVisivel':
        exigirSenhaValida_(corpo.senha);
        resultado = { sucesso: true, dados: obterConfigVisivelParaAdmin_() };
        break;
      case 'atualizarConfig':
        exigirSenhaValida_(corpo.senha);
        resultado = { sucesso: true, dados: atualizarConfig_(corpo.chave, corpo.valor) };
        break;
      default:
        resultado = { sucesso: false, erro: 'Ação desconhecida: ' + acao };
    }
    return responderJson_(resultado);
  } catch (err) {
    return responderJson_({ sucesso: false, erro: err.message || String(err) });
  }
}

function responderJson_(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(ContentService.MimeType.JSON);
}

// ===== Planilha =====

function obterPlanilha_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Nenhuma planilha vinculada foi encontrada. Vincule este script a uma Google Sheet.');
  return ss;
}

function obterOuCriarAba_(nomeAba) {
  const ss = obterPlanilha_();
  let aba = ss.getSheetByName(nomeAba);
  if (!aba) aba = ss.insertSheet(nomeAba);
  return aba;
}

// Idempotente: pode ser executada mais de uma vez sem duplicar cabeçalhos.
// Rode manualmente pelo Editor do Apps Script na configuração inicial.
function configurarPlanilhaInicial() {
  try {
    const abaSub = obterOuCriarAba_(SHEET_SUBMISSOES);
    if (abaSub.getLastRow() === 0) {
      abaSub.appendRow(CABECALHOS_SUBMISSOES);
      abaSub.setFrozenRows(1);
      abaSub.getRange(1, 1, 1, CABECALHOS_SUBMISSOES.length)
        .setFontWeight('bold').setBackground('#1a3c6e').setFontColor('#ffffff');
      abaSub.autoResizeColumns(1, CABECALHOS_SUBMISSOES.length);
    }

    const abaConfig = obterOuCriarAba_(SHEET_CONFIG);
    if (abaConfig.getLastRow() === 0) {
      abaConfig.appendRow(CABECALHOS_CONFIG);
      abaConfig.setFrozenRows(1);
      abaConfig.getRange(1, 1, 1, CABECALHOS_CONFIG.length)
        .setFontWeight('bold').setBackground('#1a3c6e').setFontColor('#ffffff');
      abaConfig.appendRow(['ROOT_FOLDER_ID', '']);
      abaConfig.appendRow(['DOC_TEMPLATE_ID', '']);
      abaConfig.appendRow(['SLIDE_TEMPLATE_ID', '']);
      abaConfig.appendRow(['ADMIN_PASSWORD', SENHA_ADMIN_PADRAO]);
    }

    return 'Planilha configurada. Preencha ROOT_FOLDER_ID, DOC_TEMPLATE_ID e SLIDE_TEMPLATE_ID na aba Config, ' +
      'e troque a senha padrão (ADMIN_PASSWORD = "' + SENHA_ADMIN_PADRAO + '") pela tela de configurações do site.';
  } catch (err) {
    throw new Error('Falha ao configurar a planilha inicial: ' + err.message);
  }
}

function obterConfig_() {
  const aba = obterOuCriarAba_(SHEET_CONFIG);
  const dados = aba.getDataRange().getValues();
  const mapa = {};
  for (let i = 1; i < dados.length; i++) {
    const chave = dados[i][0];
    const valor = dados[i][1];
    if (chave) mapa[String(chave).trim()] = String(valor === undefined || valor === null ? '' : valor).trim();
  }
  return mapa;
}

function obterConfigValidada_() {
  const config = obterConfig_();
  ['ROOT_FOLDER_ID', 'DOC_TEMPLATE_ID', 'SLIDE_TEMPLATE_ID'].forEach(function (chave) {
    if (!config[chave]) throw new Error('Configuração ausente na aba "Config": ' + chave + '. Preencha antes de continuar.');
  });
  return config;
}

// ===== Autenticação por senha =====

function senhaConfere_(senhaInformada) {
  const config = obterConfig_();
  const senhaSalva = config.ADMIN_PASSWORD || SENHA_ADMIN_PADRAO;
  return String(senhaInformada || '') === String(senhaSalva);
}

function exigirSenhaValida_(senhaInformada) {
  if (!senhaConfere_(senhaInformada)) throw new Error('Senha de administrador inválida.');
}

function validarSenhaAdmin_(senha) {
  if (!senhaConfere_(senha)) throw new Error('Senha incorreta.');
  return { autenticado: true };
}

function alterarSenhaAdmin_(senhaAtual, novaSenha) {
  exigirSenhaValida_(senhaAtual);
  if (!novaSenha || String(novaSenha).trim().length < 6) throw new Error('A nova senha deve ter ao menos 6 caracteres.');
  atualizarConfig_('ADMIN_PASSWORD', String(novaSenha).trim());
  return { sucesso: true };
}

function obterConfigVisivelParaAdmin_() {
  const config = obterConfig_();
  return {
    ROOT_FOLDER_ID: config.ROOT_FOLDER_ID || '',
    DOC_TEMPLATE_ID: config.DOC_TEMPLATE_ID || '',
    SLIDE_TEMPLATE_ID: config.SLIDE_TEMPLATE_ID || ''
  };
}

function atualizarConfig_(chave, valor) {
  if (!chave) throw new Error('Chave de configuração não informada.');
  const aba = obterOuCriarAba_(SHEET_CONFIG);
  const dados = aba.getDataRange().getValues();
  for (let i = 1; i < dados.length; i++) {
    if (dados[i][0] === chave) {
      aba.getRange(i + 1, 2).setValue(valor);
      return { chave: chave, valor: valor };
    }
  }
  aba.appendRow([chave, valor]);
  return { chave: chave, valor: valor };
}

// ===== Submissão do estudante =====

function salvarSubmissao_(dados, listaBase64Fotos, videoUrl, emailAutor) {
  if (!dados || !dados.titulo || !dados.autores || !dados.orientador) {
    throw new Error('Campos obrigatórios ausentes: Título, Autores e Orientador são requeridos.');
  }

  const id = Utilities.getUuid();
  const timestamp = new Date();

  const config = obterConfigValidada_();
  const pastaRaiz = DriveApp.getFolderById(config.ROOT_FOLDER_ID);
  const nomePasta = sanitizarNomeArquivo_(dados.titulo) + ' - ' + id.substring(0, 8);
  const pastaSubmissao = pastaRaiz.createFolder(nomePasta);

  const urlsFotos = [];
  if (listaBase64Fotos && listaBase64Fotos.length > 0) {
    listaBase64Fotos.forEach(function (foto, indice) {
      try {
        if (!foto || !foto.base64 || !foto.tipoMime) return;
        const bytes = Utilities.base64Decode(foto.base64);
        const nomeArquivo = 'foto_' + (indice + 1) + '_' + sanitizarNomeArquivo_(foto.nome || 'imagem');
        const blob = Utilities.newBlob(bytes, foto.tipoMime, nomeArquivo);
        const arquivo = pastaSubmissao.createFile(blob);
        arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        urlsFotos.push(arquivo.getUrl());
      } catch (erroFoto) {
        Logger.log('Falha ao salvar foto ' + indice + ': ' + erroFoto.message);
      }
    });
  }

  const aba = obterOuCriarAba_(SHEET_SUBMISSOES);
  aba.appendRow([
    id, timestamp, emailAutor || '', dados.titulo || '', dados.autores || '', dados.orientador || '',
    dados.resumo || '', dados.proposta || '', dados.objetivo || '', dados.planejamento || '',
    dados.atividades || '', dados.resultados || '', pastaSubmissao.getUrl(), urlsFotos.join(', '),
    videoUrl || '', '', '', '', 'Submetido'
  ]);

  return { id: id, mensagem: 'Submissão registrada com sucesso!' };
}

function sanitizarNomeArquivo_(nome) {
  return String(nome || 'sem-titulo').replace(/[\\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().substring(0, 80);
}

// ===== Leitura de dados (painel administrativo) =====

function obterTodasSubmissoes_() {
  const aba = obterOuCriarAba_(SHEET_SUBMISSOES);
  const dados = aba.getDataRange().getValues();
  if (dados.length < 2) return [];

  const cabecalhos = dados[0];
  const resultado = [];
  for (let i = 1; i < dados.length; i++) {
    const linha = dados[i];
    if (!linha[0]) continue;
    const objeto = {};
    cabecalhos.forEach(function (chave, indiceColuna) {
      let valor = linha[indiceColuna];
      if (valor instanceof Date) valor = Utilities.formatDate(valor, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
      objeto[chave] = valor;
    });
    resultado.push(objeto);
  }
  resultado.reverse();
  return resultado;
}

function localizarLinhaPorId_(aba, idSubmissao) {
  const idsColuna = aba.getRange(2, 1, Math.max(aba.getLastRow() - 1, 0), 1).getValues();
  for (let i = 0; i < idsColuna.length; i++) {
    if (idsColuna[i][0] === idSubmissao) return i + 2;
  }
  return -1;
}

function obterSubmissaoPorId_(idSubmissao) {
  const aba = obterOuCriarAba_(SHEET_SUBMISSOES);
  const linha = localizarLinhaPorId_(aba, idSubmissao);
  if (linha === -1) throw new Error('Submissão não encontrada para o ID informado: ' + idSubmissao);
  const cabecalhos = CABECALHOS_SUBMISSOES;
  const valores = aba.getRange(linha, 1, 1, cabecalhos.length).getValues()[0];
  const dados = {};
  cabecalhos.forEach(function (chave, indice) { dados[chave] = valores[indice]; });
  return { linha: linha, dados: dados };
}

// ===== Exportação: Relatório (Docs -> DOCX + PDF) =====

function gerarArquivosWordEPdf_(idSubmissao) {
  const config = obterConfigValidada_();
  const registro = obterSubmissaoPorId_(idSubmissao);
  const dados = registro.dados;

  if (!dados.Drive_Folder_URL) throw new Error('Submissão sem pasta de Drive associada.');
  const idPasta = extrairIdDeUrlDrive_(dados.Drive_Folder_URL);
  const pastaSubmissao = DriveApp.getFolderById(idPasta);

  const templateFile = DriveApp.getFileById(config.DOC_TEMPLATE_ID);
  const nomeCopia = 'Relatorio_' + sanitizarNomeArquivo_(dados.Titulo);
  const arquivoCopia = templateFile.makeCopy(nomeCopia, pastaSubmissao);
  const docCopiaId = arquivoCopia.getId();

  const documento = DocumentApp.openById(docCopiaId);
  const corpo = documento.getBody();

  const mapaTokens = {
    '{{TITULO}}': dados.Titulo, '{{AUTORES}}': dados.Autores, '{{ORIENTADOR}}': dados.Orientador,
    '{{RESUMO}}': dados.Resumo, '{{PROPOSTA}}': dados.Proposta, '{{OBJETIVO}}': dados.Objetivo,
    '{{PLANEJAMENTO}}': dados.Planejamento, '{{ATIVIDADES}}': dados.Atividades, '{{RESULTADOS}}': dados.Resultados
  };
  Object.keys(mapaTokens).forEach(function (token) {
    corpo.replaceText(escaparRegex_(token), String(mapaTokens[token] || '').replace(/\$/g, '$$$$'));
  });

  if (dados.Fotos_URLs) {
    const urlsFotos = String(dados.Fotos_URLs).split(',').map(function (u) { return u.trim(); }).filter(Boolean);
    if (urlsFotos.length > 0) {
      corpo.appendPageBreak();
      corpo.appendParagraph('Registro Fotográfico').setHeading(DocumentApp.ParagraphHeading.HEADING1);
      const LARGURA_MAXIMA_PX = 400;
      urlsFotos.forEach(function (urlFoto) {
        try {
          const idArquivoFoto = extrairIdDeUrlDrive_(urlFoto);
          const blobFoto = DriveApp.getFileById(idArquivoFoto).getBlob();
          const imagemInserida = corpo.appendImage(blobFoto);
          const larguraOriginal = imagemInserida.getWidth();
          const alturaOriginal = imagemInserida.getHeight();
          if (larguraOriginal > LARGURA_MAXIMA_PX) {
            const proporcao = LARGURA_MAXIMA_PX / larguraOriginal;
            imagemInserida.setWidth(LARGURA_MAXIMA_PX);
            imagemInserida.setHeight(Math.round(alturaOriginal * proporcao));
          }
          corpo.appendParagraph(' ');
        } catch (erroImagem) {
          Logger.log('Falha ao inserir imagem no relatório: ' + erroImagem.message);
        }
      });
    }
  }

  documento.saveAndClose();

  const docFile = DriveApp.getFileById(docCopiaId);
  const blobPdf = docFile.getAs('application/pdf');
  blobPdf.setName(nomeCopia + '.pdf');
  const arquivoPdf = pastaSubmissao.createFile(blobPdf);
  arquivoPdf.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const pdfUrl = arquivoPdf.getUrl();

  const docxUrl = exportarComoDocx_(docCopiaId, nomeCopia, pastaSubmissao);

  const abaSub = obterOuCriarAba_(SHEET_SUBMISSOES);
  abaSub.getRange(registro.linha, CABECALHOS_SUBMISSOES.indexOf('Docx_Report_URL') + 1).setValue(docxUrl);
  abaSub.getRange(registro.linha, CABECALHOS_SUBMISSOES.indexOf('Pdf_Report_URL') + 1).setValue(pdfUrl);
  abaSub.getRange(registro.linha, CABECALHOS_SUBMISSOES.indexOf('Status') + 1).setValue('Relatórios Gerados');

  return { docxUrl: docxUrl, pdfUrl: pdfUrl };
}

// Exportação nativa do Drive (Google Doc -> .docx), autenticada com o token OAuth do próprio script.
function exportarComoDocx_(docId, nomeBase, pastaDestino) {
  const url = 'https://docs.google.com/feeds/download/documents/export/Export?id=' + docId + '&exportFormat=docx';
  const resposta = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });
  if (resposta.getResponseCode() !== 200) throw new Error('Exportação DOCX retornou código HTTP ' + resposta.getResponseCode());
  const blobDocx = resposta.getBlob().setName(nomeBase + '.docx');
  const arquivoDocx = pastaDestino.createFile(blobDocx);
  arquivoDocx.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return arquivoDocx.getUrl();
}

// ===== Exportação: Banner (Slides -> PPTX) =====

function gerarBannerPowerPoint_(idSubmissao) {
  const config = obterConfigValidada_();
  const registro = obterSubmissaoPorId_(idSubmissao);
  const dados = registro.dados;

  if (!dados.Drive_Folder_URL) throw new Error('Submissão sem pasta de Drive associada.');
  const idPasta = extrairIdDeUrlDrive_(dados.Drive_Folder_URL);
  const pastaSubmissao = DriveApp.getFolderById(idPasta);

  const templateFile = DriveApp.getFileById(config.SLIDE_TEMPLATE_ID);
  const nomeCopia = 'Banner_' + sanitizarNomeArquivo_(dados.Titulo);
  const arquivoCopia = templateFile.makeCopy(nomeCopia, pastaSubmissao);
  const apresentacaoCopiaId = arquivoCopia.getId();

  const apresentacao = SlidesApp.openById(apresentacaoCopiaId);
  const slides = apresentacao.getSlides();
  if (slides.length === 0) throw new Error('O template de Slides não contém nenhum slide.');
  const slide = slides[0];

  const mapaTokens = {
    '{{TITULO}}': dados.Titulo, '{{AUTORES}}': dados.Autores, '{{RESUMO}}': dados.Resumo,
    '{{ATIVIDADES}}': dados.Atividades, '{{RESULTADOS}}': dados.Resultados
  };
  Object.keys(mapaTokens).forEach(function (token) {
    slide.replaceAllText(token, String(mapaTokens[token] || ''));
  });

  if (dados.Fotos_URLs) {
    const urlsFotos = String(dados.Fotos_URLs).split(',').map(function (u) { return u.trim(); }).filter(Boolean);
    if (urlsFotos.length > 0) {
      try {
        const idPrimeiraFoto = extrairIdDeUrlDrive_(urlsFotos[0]);
        const blobFoto = DriveApp.getFileById(idPrimeiraFoto).getBlob();
        const formas = slide.getShapes();
        let placeholder = null;
        for (let i = 0; i < formas.length; i++) {
          if (formas[i].getTitle && formas[i].getTitle() === 'placeholder_imagem') { placeholder = formas[i]; break; }
        }
        if (placeholder) {
          const x = placeholder.getLeft(), y = placeholder.getTop();
          const largura = placeholder.getWidth(), altura = placeholder.getHeight();
          placeholder.remove();
          slide.insertImage(blobFoto, x, y, largura, altura);
        } else {
          slide.insertImage(blobFoto, 40, 120, 300, 220);
        }
      } catch (erroImagem) {
        Logger.log('Falha ao inserir imagem no banner: ' + erroImagem.message);
      }
    }
  }

  apresentacao.saveAndClose();
  const pptxUrl = exportarComoPptx_(apresentacaoCopiaId, nomeCopia, pastaSubmissao);

  const abaSub = obterOuCriarAba_(SHEET_SUBMISSOES);
  abaSub.getRange(registro.linha, CABECALHOS_SUBMISSOES.indexOf('Pptx_Banner_URL') + 1).setValue(pptxUrl);
  abaSub.getRange(registro.linha, CABECALHOS_SUBMISSOES.indexOf('Status') + 1).setValue('Relatórios Gerados');

  return { pptxUrl: pptxUrl };
}

function exportarComoPptx_(slideId, nomeBase, pastaDestino) {
  const url = 'https://docs.google.com/presentation/d/' + slideId + '/export/pptx';
  const resposta = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });
  if (resposta.getResponseCode() !== 200) throw new Error('Exportação PPTX retornou código HTTP ' + resposta.getResponseCode());
  const blobPptx = resposta.getBlob().setName(nomeBase + '.pptx');
  const arquivoPptx = pastaDestino.createFile(blobPptx);
  arquivoPptx.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return arquivoPptx.getUrl();
}

// ===== Ação combinada =====

function gerarTodosOsArquivos_(idSubmissao) {
  const relatorio = gerarArquivosWordEPdf_(idSubmissao);
  const banner = gerarBannerPowerPoint_(idSubmissao);
  return { docxUrl: relatorio.docxUrl, pdfUrl: relatorio.pdfUrl, pptxUrl: banner.pptxUrl };
}

// ===== Helpers =====

function extrairIdDeUrlDrive_(url) {
  if (!url) throw new Error('URL do Drive vazia ou inválida.');
  const texto = String(url);
  let m = texto.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m && m[1]) return m[1];
  m = texto.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m && m[1]) return m[1];
  m = texto.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (m && m[1]) return m[1];
  throw new Error('Não foi possível extrair o ID a partir da URL: ' + url);
}

function escaparRegex_(token) {
  return String(token).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
