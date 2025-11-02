// services/exportService.ts
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Document, Packer, Paragraph, TextRun } from 'docx';

/**
 * Função utilitária para salvar um blob de arquivo.
 * @param blob O conteúdo do arquivo.
 * @param nome O nome do arquivo a ser salvo.
 */
function salvarArquivo(blob: Blob, nome: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

/**
 * Coleta o HTML renderizado do painel de controle ativo.
 * @returns Uma string HTML do conteúdo do dashboard.
 */
function capturarDadosDashboard(): string {
  const dashboardContent = document.querySelector('#dashboard-view-content > div');
  if (!dashboardContent) {
      return '<h2>📊 Painel Analítico</h2><p>Nenhum conteúdo do dashboard ativo foi encontrado para exportação.</p>';
  }

  const clone = dashboardContent.cloneNode(true) as HTMLElement;
  const titleElement = clone.querySelector('h2');
  const title = titleElement ? titleElement.innerText : 'Painel Analítico';
  
  return `<h2>📊 ${title}</h2>${clone.innerHTML}`;
}

/**
 * Extrai as mensagens do chat interativo a partir do DOM.
 * @returns Um array de objetos representando as mensagens do chat.
 */
function capturarMensagensChat(): { role: string; text: string }[] {
  const mensagens = Array.from(document.querySelectorAll(".chat-message"))
    .map(el => {
      const role = el.classList.contains("user") ? "Usuário" : "Nexus AI";
      // Seleciona o parágrafo principal da mensagem, ignorando avatares ou outros elementos.
      const textElement = el.querySelector('p');
      const text = textElement ? textElement.innerText.trim() : '';
      return { role, text };
    });
  return mensagens;
}

/**
 * Gera um cabeçalho HTML padronizado para os relatórios.
 * @returns Uma string HTML contendo o cabeçalho.
 */
function gerarCabecalhoPadrao(): string {
  const data = new Date().toLocaleString('pt-BR');
  const versao = "v2.1.0"; 
  const usuario = localStorage.getItem("userSession") || "Sessão Anônima";

  return `
  <header style="text-align:center; margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
    <h1 style="font-size: 24px; font-weight: bold; margin: 0; color: #1a1a1a;">Nexus QuantumI2A2 — Relatório Analítico</h1>
    <p style="font-size: 12px; color: #555; margin: 5px 0 0 0;">
      <strong>Versão:</strong> ${versao} | <strong>Exportado em:</strong> ${data} | <strong>Usuário:</strong> ${usuario}
    </p>
  </header>
  `;
}

/**
 * Monta o documento HTML completo a ser exportado.
 * @param dashboardHtml O HTML do dashboard.
 * @param chatMessages As mensagens do chat.
 * @returns Uma string contendo o HTML completo do documento.
 */
function montarDocumentoCompleto(dashboardHtml: string, chatMessages: { role: string; text: string }[]): string {
  const chatHtml = chatMessages.map(m => 
    `<div style="margin-bottom: 10px; padding: 8px; border-radius: 5px; background-color: ${m.role === 'Usuário' ? '#e0e0e0' : '#f0f0f0'};">
        <strong style="color: #333;">${m.role}:</strong>
        <p style="margin: 5px 0 0 0; white-space: pre-wrap; word-wrap: break-word;">${m.text}</p>
     </div>`
  ).join("\n");

  return `
  <section id="dashboard">
    ${dashboardHtml}
  </section>
  <div style="page-break-before: always;"></div>
  <section id="chat">
    <h2>💬 Conversas e Análises Contextuais</h2>
    ${chatHtml}
  </section>
  `;
}

/**
 * Gera e baixa um arquivo PDF com o conteúdo.
 */
async function gerarPDF(conteudo: string, cabecalho: string) {
  const pdf = new jsPDF({
    orientation: 'p',
    unit: 'pt',
    format: 'a4',
  });

  const fullHTML = `
    <div style="font-family: Helvetica, Arial, sans-serif; font-size: 10pt; color: #333; width: 500pt; margin: 0 auto;">
        ${cabecalho}
        ${conteudo}
    </div>`;

  await pdf.html(fullHTML, {
    callback: (doc) => {
      doc.save("Relatorio_NexusQuantumI2A2.pdf");
    },
    margin: [40, 40, 40, 40],
    autoPaging: 'slice',
    html2canvas: {
      scale: 0.75,
      useCORS: true,
      logging: false,
    }
  });
}

/**
 * Gera e baixa um arquivo DOCX com o conteúdo.
 */
async function gerarDOCX(dashboardHtml: string, chatMessages: { role: string; text: string }[]) {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = dashboardHtml;
  
  const dashboardTitle = new Paragraph({ text: "📊 Painel Analítico", heading: 'Heading1' });
  // Simplificado: extrai texto. Uma implementação mais complexa poderia mapear tags para elementos DOCX.
  const dashboardText = new Paragraph({ text: tempDiv.innerText || 'Conteúdo do dashboard indisponível.' });
  
  const chatTitle = new Paragraph({ text: "💬 Conversas e Análises Contextuais", heading: 'Heading1' });
  const chatParagraphs = chatMessages.map(m => 
    new Paragraph({
      children: [
        new TextRun({ text: `${m.role}: `, bold: true }),
        new TextRun(m.text),
      ],
      spacing: { after: 200 }
    })
  );

  const doc = new Document({
    sections: [{
      children: [
        dashboardTitle,
        dashboardText,
        chatTitle,
        ...chatParagraphs,
      ],
    }],
  });
  
  const blob = await Packer.toBlob(doc);
  salvarArquivo(blob, "Relatorio_NexusQuantumI2A2.docx");
}

/**
 * Gera e baixa um arquivo HTML com o conteúdo.
 */
async function gerarHTML(conteudo: string, cabecalho: string) {
  const theme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
  const colors = theme === 'dark' ? 
    { bg: '#0D1117', text: '#D1D5DB', heading: '#F9FAFB', border: '#333' } : 
    { bg: '#F9FAFB', text: '#374151', heading: '#111827', border: '#ddd' };

  const html = `
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <title>Relatório NexusQuantumI2A2</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 40px; background-color: ${colors.bg}; color: ${colors.text}; }
      h1, h2, h3 { color: ${colors.heading}; border-bottom: 1px solid ${colors.border}; padding-bottom: 5px; }
      header { text-align: left; }
      section { margin-bottom: 30px; }
      p { line-height: 1.6; }
      strong { color: ${colors.heading}; }
      /* Adiciona estilos básicos para Tremor components */
      .tremor-Card-root { border: 1px solid ${colors.border}; border-radius: 0.5rem; padding: 1rem; margin-bottom: 1rem; }
      .tremor-Title-root { font-size: 1.25rem; font-weight: 600; }
    </style>
  </head>
  <body>
    ${cabecalho.replace('text-align:center', 'text-align:left')}
    ${conteudo}
  </body>
  </html>
  `;
  salvarArquivo(new Blob([html], { type: "text/html;charset=utf-8" }), "Relatorio_NexusQuantumI2A2.html");
}

/**
 * Função principal que orquestra a exportação completa.
 * @param formato O formato de arquivo desejado.
 */
export async function exportarConteudoCompleto(formato: "pdf" | "docx" | "html") {
  console.log(`[ExportService] Iniciando exportação para ${formato.toUpperCase()}`);
  const dashboardHtml = capturarDadosDashboard();
  const chatMessages = capturarMensagensChat();
  const cabecalho = gerarCabecalhoPadrao();
  const conteudoHtml = montarDocumentoCompleto(dashboardHtml, chatMessages);

  switch (formato) {
    case "pdf":
      await gerarPDF(conteudoHtml, cabecalho);
      break;
    case "docx":
      await gerarDOCX(dashboardHtml, chatMessages);
      break;
    case "html":
      await gerarHTML(conteudoHtml, cabecalho);
      break;
    default:
      console.error(`[ExportService] Formato de exportação desconhecido: ${formato}`);
      throw new Error("Formato de exportação não suportado.");
  }
  console.log(`[ExportService] Exportação para ${formato.toUpperCase()} concluída.`);
}
