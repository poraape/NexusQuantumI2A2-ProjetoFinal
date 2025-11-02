# Nexus QuantumI2A2 - Interactive Insight & Intelligence from Fiscal Analysis

**Nexus QuantumI2A2** é um ecossistema de inteligência fiscal que transforma documentos tributários complexos em insights acionáveis. Utilizando um sistema multi-agente simulado pela API Google Gemini, a plataforma automatiza o processamento, validação e análise de uma vasta gama de arquivos fiscais brasileiros, entregando relatórios interativos, simulações e um assistente de IA contextual.

---

## Principais Funcionalidades

A plataforma opera com uma arquitetura de **análise em camadas**, permitindo que o usuário comece com uma visão geral rápida e aprofunde a investigação sob demanda, otimizando performance e custos de API.

#### 1. **Processamento Inteligente de Arquivos**
- **Amplo Suporte a Formatos:** Faça upload de múltiplos arquivos, incluindo `XML` (NF-e), `PDF` (com OCR integrado para documentos digitalizados), `CSV`, `SPED`, `DOCX`, `XLSX`, `TXT`, `JSON` e imagens.
- **Extração Automática de `.zip`:** Arquivos compactados são descompactados e processados individualmente no cliente.
- **Parsing Especializado:** O sistema utiliza parsers específicos para cada formato, extraindo e estruturando dados de forma otimizada para a análise da IA.

#### 2. **Dashboard de Análise Executiva**
- **Visão Imediata:** Logo após o processamento, um dashboard interativo apresenta um resumo executivo com as principais métricas, como Valor Total de NF-e, Risco Tributário, composição de impostos e tendências de faturamento.
- **Insights Acionáveis:** A IA fornece uma lista de pontos de atenção e recomendações com base na análise inicial.

#### 3. **Simulador Tributário Inteligente**
- **Otimização Fiscal:** Projete cenários para os regimes `Lucro Presumido`, `Lucro Real` e `Simples Nacional`.
- **Análise Híbrida:** Os cálculos de impostos são realizados localmente para precisão, e a IA gera a análise textual, recomendações e o resumo comparativo.

#### 4. **Análise Comparativa (Sob Demanda)**
- **Detecção de Anomalias:** Envie dois ou mais conjuntos de arquivos para que a IA realize uma comparação profunda, identificando automaticamente discrepâncias, padrões e anomalias entre eles.

#### 5. **Análise Textual Completa (Sob Demanda)**
- **Investigação Profunda:** Para uma análise detalhada, solicite um relatório textual completo. A IA processa o conteúdo integral dos documentos para gerar uma análise exaustiva, ideal para auditorias.

#### 6. **Chat Interativo com RAG (Retrieval-Augmented Generation)**
- **Consultoria Contextual:** Converse com a IA, que responde com base no conteúdo completo dos documentos previamente indexados em uma base vetorial local.
- **Anexo de Arquivos no Chat:** Anexe novos arquivos diretamente na conversa para obter respostas imediatas sobre eles, sem a necessidade de um novo processamento completo.

---

## Arquitetura e Pilha Tecnológica

Nexus QuantumI2A2 é um **Single Page Application (SPA)** moderno, projetado para operar com máxima eficiência no cliente, garantindo privacidade e performance.

- **Arquitetura "No-Build"**: O projeto é executado diretamente no navegador sem a necessidade de um processo de build (Webpack, Vite). As dependências são gerenciadas via `importmap` no `index.html`.

- **Pilha Tecnológica**:
  - **Frontend**: React 18 com TypeScript.
  - **Estilização**: Tailwind CSS (via CDN) com um sistema de temas customizável (Dark/Light).
  - **Componentes de UI & Gráficos**: [Tremor React](https://www.tremor.so/), para dashboards, gráficos e tabelas interativas.
  - **Inteligência Artificial**: API Google Gemini (modelo `gemini-2.5-flash`), orquestrada através de um serviço com um **mecanismo de fallback inteligente** que alterna automaticamente entre um proxy e a API direta para garantir alta disponibilidade.

- **Bibliotecas de Parsing no Cliente**:
  - **`jszip`**: Descompactação de arquivos `.zip`.
  - **`xml-js`**: Conversão de XML (NF-e) para JSON.
  - **`papaparse`**: Parsing de arquivos `.csv`.
  - **`pdfjs-dist`**: Leitura e extração de texto de arquivos PDF nativos.
  - **`tesseract.js`**: Reconhecimento Óptico de Caracteres (OCR) em PDFs baseados em imagem.

---

## Sistema de Memória Cognitiva

A aplicação utiliza o `localStorage` do navegador para implementar um sistema de "memória" que aprimora a experiência do usuário e otimiza o desempenho.

- **Índice de Documentos (RAG):** O conteúdo dos arquivos é segmentado, vetorizado (através de palavras-chave) e armazenado localmente, permitindo que o Chat Interativo realize buscas de similaridade para encontrar o contexto relevante para cada pergunta.
- **Cache de Q&A:** Perguntas e respostas do chat são cacheadas para fornecer respostas instantâneas a perguntas repetidas.
- **Cache de Simulação:** Resultados de simulações tributárias são armazenados para evitar recálculos e novas chamadas de API para os mesmos parâmetros.
- **Resumo da Última Sessão:** O resumo executivo da última análise é salvo, permitindo a restauração rápida do dashboard ao reabrir a aplicação.

---

## Estrutura do Projeto

```
/
├── components/         # Componentes React reutilizáveis
│   ├── dashboard/      # Componentes específicos do Dashboard de análise
│   └── icons/          # Ícones SVG como componentes
├── contexts/           # Provedores de Contexto React (ex: ErrorLogContext)
├── hooks/              # Hooks customizados (ex: useErrorLog)
├── services/           # Lógica de negócio, parsers e comunicação com APIs
│   ├── geminiService.ts # Orquestrador de chamadas para a API Gemini e prompts
│   ├── fileParsers.ts   # Módulo com parsers especializados por tipo de arquivo
│   ├── taxCalculator.ts # Lógica para os cálculos do simulador tributário
│   └── contextMemory.ts # Gerenciamento do RAG, cache e estado no localStorage
├── types.ts            # Definições de tipos TypeScript globais
├── App.tsx             # Componente raiz da aplicação
├── index.html          # Ponto de entrada HTML (contém o importmap de dependências)
├── index.tsx           # Ponto de montagem do React no DOM
└── README.md           # Este arquivo
```

---

## Instalação e Execução Local

### Pré-requisitos
1.  **Chave da API Google Gemini**: Obtenha uma chave de API válida no [Google AI Studio](https://aistudio.google.com/app/apikey).
2.  **Servidor Web Local**: Um servidor simples para servir arquivos estáticos.

### Executando o Projeto
1.  **Clone o repositório:**
    ```bash
    git clone https://github.com/seu-usuario/nexus-quantumi2a2.git
    cd nexus-quantumi2a2
    ```

2.  **Inicie um servidor web local:**
    Se você tem Python 3, use o servidor embutido:
    ```bash
    python -m http.server 8000
    ```
    Alternativamente, use qualquer outro servidor de arquivos estáticos.

3.  **Acesse a aplicação:**
    Abra seu navegador e navegue para `http://localhost:8000`. Na primeira visita, um modal solicitará que você insira sua chave da API Gemini, que será armazenada com segurança no `localStorage` do seu navegador.

## Como Contribuir

Contribuições são bem-vindas! Siga os passos abaixo:

1.  **Faça um Fork** do repositório.
2.  **Crie uma nova branch** para sua feature ou correção (`git checkout -b feature/minha-feature`).
3.  **Implemente suas alterações**, seguindo os padrões de código existentes.
4.  **Faça o commit** das suas alterações com uma mensagem clara (`git commit -m 'feat: Adiciona nova funcionalidade'`).
5.  **Faça o push** para a sua branch (`git push origin feature/minha-feature`).
6.  **Abra um Pull Request** detalhando as mudanças realizadas.

## Licença

Este projeto está licenciado sob a Licença MIT.
