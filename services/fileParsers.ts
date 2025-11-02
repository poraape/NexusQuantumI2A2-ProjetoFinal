import { xml2json } from 'xml-js';
import Papa from 'papaparse';
import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.3.136/build/pdf.worker.min.mjs`;

interface ParsedFileResult {
  type: 'text' | 'binary';
  content: string;
}

// --- Summarizer Functions ---

const resumirNFe = (nfeData: any) => {
    const nfe = nfeData.n_fe_proc?.n_fe || nfeData.nfe || nfeData;
    const infNFe = nfe?.inf_n_fe;
    if (!infNFe) return { erro: "Estrutura da NF-e não reconhecida." };

    const itensResumidos = (Array.isArray(infNFe.det) ? infNFe.det : [infNFe.det]).map((item: any) => ({
        n_item: item?._attributes?.n_item,
        c_prod: item?.prod?.c_prod,
        // Reduz o nome do produto para economizar tokens, mas mantém o essencial
        x_prod_resumo: item?.prod?.x_prod?.substring(0, 40), 
        ncm: item?.prod?.ncm,
        cfop: item?.prod?.cfop,
        v_prod: item?.prod?.v_prod,
        icms: item?.imposto?.icms, // Mantém o bloco de imposto
    }));

    return {
        resumo_nfe: {
            ide: { c_uf: infNFe.ide?.c_uf, nat_op: infNFe.ide?.nat_op, n_nf: infNFe.ide?.n_nf, dh_emi: infNFe.ide?.dh_emi },
            emit: { cnpj: infNFe.emit?.cnpj, x_nome: infNFe.emit?.x_nome?.substring(0, 50) },
            dest: { cnpj: infNFe.dest?.cnpj || infNFe.dest?.cpf, x_nome: infNFe.dest?.x_nome?.substring(0, 50) },
            total: { icms_tot: infNFe.total?.icms_tot },
            // Amostra de itens para reduzir o tamanho do payload
            itens_amostra: itensResumidos.slice(0, 10) 
        }
    };
};

const resumirCSV = (data: any[], fileName: string) => {
    const totalRows = data.length;
    if (totalRows === 0) return { resumo_csv: { file_name: fileName, total_rows: 0 }};

    const columns = Object.keys(data[0]);
    const numericColumns = columns.filter(col => typeof data[0][col] === 'number');
    
    const aggregates = numericColumns.reduce((acc, col) => {
        const values = data.map(row => row[col]).filter(v => typeof v === 'number');
        if (values.length > 0) {
            const sum = values.reduce((a, b) => a + b, 0);
            acc[col] = { sum: sum.toFixed(2) };
        }
        return acc;
    }, {} as {[key: string]: any});

    return {
        resumo_csv: {
            file_name: fileName,
            total_rows: totalRows,
            columns,
            numeric_aggregates: aggregates,
        }
    };
};

const resumirPDF = (text: string): string => {
    const MAX_LENGTH = 7000; // Reduzido para estar bem dentro do limite por lote
    if (text.length <= MAX_LENGTH) return text;
    // Tenta preservar o início e o fim do documento
    return `${text.substring(0, MAX_LENGTH / 2)}\n\n... (CONTEÚDO TRUNCADO) ...\n\n${text.substring(text.length - MAX_LENGTH / 2)}`;
};

// --- Helper Functions ---

const compactText = (text: string): string => text.replace(/(\r\n|\n|\r)/gm, " ").replace(/\s{2,}/g, ' ');

const simplifyJson = (obj: any): any => {
    if (Array.isArray(obj)) return obj.map(v => simplifyJson(v));
    if (obj !== null && typeof obj === 'object') {
        const keys = Object.keys(obj);
        if (keys.length === 1 && keys[0] === '_text') return obj._text;
        return keys.reduce((acc, key) => {
            const simplifiedValue = simplifyJson(obj[key]);
            if(simplifiedValue != null) acc[key] = simplifiedValue;
            return acc;
        }, {} as { [key: string]: any });
    }
    return obj;
};

const keysToSnakeCase = (obj: any): any => {
    if (Array.isArray(obj)) return obj.map(v => keysToSnakeCase(v));
    if (obj !== null && typeof obj === 'object') {
        return Object.keys(obj).reduce((result, key) => {
            const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            result[snakeKey] = keysToSnakeCase(obj[key]);
            return result;
        }, {} as { [key: string]: any });
    }
    return obj;
};

const stringifyForIndexing = (parsed: any): string => {
    try {
        return JSON.stringify(parsed).replace(/["{}\[\]]/g, ' ').replace(/,/g, ',\n').replace(/\s+/g, ' ').trim();
    } catch { return ""; }
};

// --- Main Parser Functions ---

const parseXml = (xmlContent: string, fileName: string): string => {
  try {
    const jsonResult = xml2json(xmlContent, { compact: true, spaces: 2 });
    const jsonObj = JSON.parse(jsonResult);
    const simplifiedObj = simplifyJson(jsonObj);
    const snakeCaseObj = keysToSnakeCase(simplifiedObj);
    
    // A summarização agora é o padrão para otimização de tokens
    const summaryObj = resumirNFe(snakeCaseObj);
    return `<!-- O CONTEÚDO XML FOI SUMARIZADO PARA OTIMIZAÇÃO -->\n${JSON.stringify(summaryObj, null, 2)}`;
  } catch (e) {
    console.warn(`[Parser: ${fileName}] Falha ao converter XML. Enviando como texto plano.`, e);
    return compactText(xmlContent);
  }
};

const parseSped = (spedContent: string, fileName: string): string => {
    try {
        const lines = spedContent.split('\n');
        const summary: { [key: string]: any } = {
            identificacao: [], totais_bloco_c: { count: 0, sample: [] },
            inventario_h: { count: 0, sample: [] }, producao_k: { count: 0, sample: [] },
        };
        for (const line of lines) {
             if (!line.startsWith('|')) continue;
             const fields = line.split('|');
             const recordType = fields[1];
             if (recordType?.startsWith('0')) { summary.identificacao.push(fields); } 
             else if (recordType?.startsWith('C')) { summary.totais_bloco_c.count++; if(summary.totais_bloco_c.sample.length < 5) summary.totais_bloco_c.sample.push(fields); } 
             else if (recordType?.startsWith('H')) { summary.inventario_h.count++; if(summary.inventario_h.sample.length < 5) summary.inventario_h.sample.push(fields); } 
             else if (recordType?.startsWith('K')) { summary.producao_k.count++; if(summary.producao_k.sample.length < 5) summary.producao_k.sample.push(fields); }
        }
        return `<!-- O ARQUIVO SPED FOI SUMARIZADO DEVIDO AO TAMANHO -->\n${JSON.stringify(summary, null, 2)}`;
    } catch (e) {
        console.warn(`[Parser: ${fileName}] Falha ao processar SPED. Enviando como texto plano.`, e);
        return compactText(spedContent);
    }
};

const parseCsv = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true, dynamicTyping: true, skipEmptyLines: true,
            complete: (results) => {
                const summaryObj = resumirCSV(results.data as any[], file.name);
                resolve(`<!-- RESUMO ESTATÍSTICO DO ARQUIVO CSV -->\n${JSON.stringify(summaryObj, null, 2)}`);
            },
            error: (error) => reject(error)
        });
    });
};

const parsePdfWithOcr = async (file: File, onProgress: (info: string) => void): Promise<string> => {
    const fileReader = new FileReader();
    return new Promise((resolve, reject) => {
        fileReader.onload = async (event) => {
            try {
                const typedarray = new Uint8Array(event.target!.result as ArrayBuffer);
                const pdf = await pdfjsLib.getDocument(typedarray).promise;
                let fullText = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                    onProgress(`Lendo página ${i}/${pdf.numPages}...`);
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    if (textContent.items.length > 10) {
                        fullText += textContent.items.map(item => 'str' in item ? item.str : '').join(' ');
                    } else {
                        onProgress(`Página ${i} parece ser imagem. Iniciando OCR...`);
                        const viewport = page.getViewport({ scale: 1.5 });
                        const canvas = document.createElement('canvas');
                        const context = canvas.getContext('2d')!;
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;
                        await page.render({ canvasContext: context, viewport: viewport }).promise;
                        const { data: { text } } = await Tesseract.recognize(canvas, 'por', {
                            logger: m => {
                                if (m.status === 'recognizing text') {
                                    onProgress(`OCR (pág ${i}): ${Math.round(m.progress * 100)}%`);
                                }
                            }
                        });
                        fullText += text;
                    }
                    fullText += '\n\n--- FIM PÁG. ---\n\n';
                }
                const summarizedText = resumirPDF(fullText);
                resolve(compactText(`<!-- TEXTO EXTRAÍDO DO PDF (SUMARIZADO) -->\n${summarizedText}`));
            } catch (error) { reject(error); }
        };
        fileReader.readAsArrayBuffer(file);
    });
};

export const parseFile = async (file: File, onProgress: (info: string) => void): Promise<ParsedFileResult> => {
    const mimeType = file.type || '';
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.xml') || mimeType.includes('xml')) {
        return { type: 'text', content: parseXml(await file.text(), file.name) };
    }
    if (fileName.endsWith('.csv') || mimeType.includes('csv')) {
        return { type: 'text', content: await parseCsv(file) };
    }
    if (fileName.endsWith('.txt') && (fileName.includes('sped'))) {
        return { type: 'text', content: parseSped(await file.text(), file.name) };
    }
    if (fileName.endsWith('.pdf') || mimeType.includes('pdf')) {
        return { type: 'text', content: await parsePdfWithOcr(file, onProgress) };
    }
    if (mimeType.startsWith('text/')) {
        return { type: 'text', content: compactText(`<!-- CONTEÚDO DE TEXTO SIMPLES -->\n${await file.text()}`) };
    }
    
    return { type: 'binary', content: file.name };
};

export const extractFullTextFromFile = async (file: File): Promise<string> => {
    const mimeType = file.type || '';
    const fileName = file.name.toLowerCase();

    try {
        if (fileName.endsWith('.xml') || mimeType.includes('xml')) {
            const xmlContent = await file.text();
            const jsonResult = xml2json(xmlContent, { compact: true });
            return stringifyForIndexing(JSON.parse(jsonResult));
        }
        if (fileName.endsWith('.csv') || mimeType.includes('csv')) {
             return new Promise((resolve, reject) => {
                Papa.parse(file, {
                    header: true, dynamicTyping: true, skipEmptyLines: true,
                    complete: (results) => resolve(stringifyForIndexing(results.data)),
                    error: (error) => reject(error)
                });
            });
        }
        if (fileName.endsWith('.pdf') || mimeType.includes('pdf')) {
            const typedarray = new Uint8Array(await file.arrayBuffer());
            const pdf = await pdfjsLib.getDocument(typedarray).promise;
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                fullText += textContent.items.map(item => 'str' in item ? item.str : '').join(' ') + '\n';
            }
            return fullText;
        }
        if (mimeType.startsWith('text/')) {
            return file.text();
        }
    } catch(e) {
        console.error(`[FullTextExtractor] Failed to parse ${file.name}:`, e);
    }
    return '';
};