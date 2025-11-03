# Nexus QuantumI2A2 - Interactive Insight & Intelligence from Fiscal Analysis

**Nexus QuantumI2A2** é um ecossistema de inteligência fiscal que transforma documentos tributários complexos em insights acionáveis. Utilizando um sistema multi-agente simulado pela API Google Gemini, a plataforma automatiza o processamento, validação e análise de uma vasta gama de arquivos fiscais brasileiros, entregando relatórios interativos, simulações e um assistente de IA contextual.

---

## Principais Funcionalidades

A plataforma opera com uma arquitetura de **análise em camadas**, permitindo que o usuário comece com uma visão geral rápida e aprofunde a investigação sob demanda, otimizando performance e custos de API.

#### 1. **Processamento Inteligente de Arquivos**
- **Amplo Suporte a Formatos:** Faça upload de múltiplos arquivos, incluindo `XML` (NF-e), `PDF` (com OCR integrado para documentos digitalizados), `CSV`, `SPED`, `DOCX`, `XLSX`, e mais.
- **Extração Automática de `.zip`:** Arquivos compactados são descompactados e processados individualmente no cliente, respeitando limites de tamanho para garantir performance.
- **Parsing Especializado:** O sistema utiliza parsers específicos para cada formato, extraindo e estruturando dados de forma otimizada para a análise da IA.

#### 2. **Dashboard de Análise em Camadas**
- **Análise Executiva:** Logo após o processamento, um dashboard interativo apresenta um resumo com métricas chave, risco tributário, composição de impostos e insights acionáveis gerados pela IA.
- **Simulador Tributário Inteligente:** Projete cenários para os regimes `Lucro Presumido`, `Lucro Real` e `Simples Nacional`. O sistema realiza os cálculos localmente para precisão e utiliza a IA para gerar a análise textual e as recomendações.
- **Análise Comparativa (Sob Demanda):** Compare dois ou mais conjuntos de arquivos para que a IA identifique automaticamente discrepâncias, padrões e anomalias entre eles.
- **Análise Textual Completa (Sob Demanda):** Para uma investigação profunda, solicite um relatório textual completo. A IA processa o conteúdo integral dos documentos para gerar uma análise exaustiva.

#### 3. **Chat Interativo com RAG (Retrieval-Augmented Generation)**
- **Consultoria Contextual:** Converse com a IA, que responde com base no conteúdo completo dos documentos previamente indexados em uma base vetorial local (simulada).
- **Geração de Gráficos:** Solicite visualizações de dados e a IA gera gráficos dinamicamente dentro do chat.
- **Anexo de Arquivos:** Anexe novos arquivos diretamente na conversa para obter respostas imediatas sobre eles, sem a necessidade de um novo processamento completo.

#### 4. **Exportação Avançada de Dados**
- **Relatórios Gerenciais:** Exporte a visualização do dashboard (Análise Executiva, Simulador, etc.) para os formatos `PDF`, `DOCX` e `HTML`.
- **Dados Fiscais Estruturados:** Exporte os dados processados em formatos compatíveis com sistemas de contabilidade, como `SPED Fiscal (MVP)`, `EFD Contribuições (MVP)` e `CSV para ERP`.
- **Automação Contábil:** Gere sugestões de lançamentos contábeis e exporte-os em formato `CSV`.

---

## Arquitetura e Pilha Tecnológica

Nexus QuantumI2A2 é um **Single Page Application (SPA)** moderno, projetado para operar com máxima eficiência e privacidade no cliente.

- **Arquitetura "No-Build"**: O projeto é executado diretamente no navegador sem a necessidade de um processo de build (Webpack, Vite). As dependências são gerenciadas via `importmap` no `index.html`.

- **Pilha Tecnológica**:
  - **Frontend**: React 18 com TypeScript.
  - **Estilização**: Tailwind CSS (via CDN) com um sistema de temas customizável (Dark/Light).
  - **Componentes de UI & Gráficos**: [Tremor React](https://www.tremor.so/), para dashboards e gráficos interativos.
  - **Inteligência Artificial**: API Google Gemini (modelo `gemini-2.5-flash`), orquestrada através de um serviço robusto (`geminiService.ts`) com fila de requisições, retries com backoff exponencial e um mecanismo de fallback de proxy para alta disponibilidade.
  - **Bibliotecas de Parsing no Cliente**:
    - **`jszip`**: Descompactação de arquivos `.zip`.
    - **`xml-js`**: Conversão de XML (NF-e) para JSON.
    - **`papaparse`**: Parsing de arquivos `.csv`.
    - **`pdfjs-dist`**: Extração de texto de arquivos PDF nativos.
    - **`tesseract.js`**: Reconhecimento Óptico de Caracteres (OCR) em PDFs de imagem.
    - **`compromise`**: NLP local para extração semântica e enriquecimento de contexto.

- **Segurança da Chave de API**:
  - **IMPORTANTE:** No estado atual, a chave da API Gemini é **embutida e ofuscada em Base64** no arquivo `config.ts`. Este método **NÃO É SEGURO PARA PRODUÇÃO**, pois a chave pode ser extraída do código do cliente. A abordagem recomendada para um ambiente de produção seria usar um servidor proxy (Backend-for-Frontend) que injete a chave de forma segura.

---

## Sistema de Memória Cognitiva

A aplicação utiliza o `localStorage` do navegador para implementar um sistema de "memória" que aprimora a experiência e otimiza o desempenho.

- **Índice de Documentos (RAG):** O conteúdo dos arquivos é segmentado e indexado localmente, permitindo que o Chat Interativo encontre o contexto relevante para cada pergunta.
- **Cache de Simulação:** Resultados de simulações tributárias são armazenados para evitar recálculos.
- **Cache de Validação:** Resultados de validação de CNPJ são cacheados para reduzir chamadas de API externas.
- **Memória de Conversa e Feedback:** Perguntas e respostas do chat, bem como o feedback do usuário (👍/👎), são armazenados para enriquecer o contexto de prompts futuros.
- **Resumo da Última Sessão:** O resumo executivo da última análise é salvo, permitindo a restauração rápida do dashboard.

---

## 🧩 Capacidades Avançadas

### Automação Contábil
O sistema gera sugestões de lançamentos contábeis com base no CFOP e tipo de operação dos documentos fiscais, que podem ser exportados em formato CSV para integração com ERPs.

### Feedback Adaptativo
O chat integra um sistema de feedback (👍/👎). As avaliações são armazenadas e utilizadas para enriquecer o contexto dos prompts futuros, permitindo que a IA aprimore a precisão de suas análises ao longo do tempo.

### NLP Fiscal Local
Uma camada semântica de pré-processamento utiliza NLP (`compromise`) localmente no navegador para aprimorar o reconhecimento de entidades fiscais chave (CNPJs, impostos), otimizando o consumo de tokens e melhorando a qualidade do contexto para o sistema de RAG.

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
│   ├── geminiService.ts # Orquestrador de chamadas para a API Gemini
│   ├── fileParsers.ts   # Módulo com parsers especializados e NLP local
│   ├── taxCalculator.ts # Lógica para os cálculos do simulador
│   ├── contextMemory.ts # Gerenciamento do RAG, cache e estado no localStorage
│   ├── classifier.ts    # Agente de classificação de documentos
│   ├── rulesValidator.ts# Agente de validação de regras fiscais
│   └── ...             # Outros serviços
├── types.ts            # Definições de tipos TypeScript globais
├── App.tsx             # Componente raiz da aplicação
├── index.html          # Ponto de entrada HTML (contém o importmap)
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
    git clone <URL_DO_REPOSITORIO>
    cd <NOME_DA_PASTA>
    ```

2.  **Configure sua Chave de API:**
    -   Codifique sua chave de API em Base64. Você pode usar uma ferramenta online ou o seguinte comando no seu terminal:
        ```bash
        echo -n "SUA_CHAVE_API_AQUI" | base64
        ```
    -   Abra o arquivo `config.ts`.
    -   Substitua o valor da constante `_obfKey` pela sua chave codificada em Base64.
        ```typescript
        // config.ts
        const _obfKey = "SUA_CHAVE_CODIFICADA_EM_BASE64_AQUI";
        ```

3.  **Inicie um servidor web local:**
    Se você tem Python 3, use o servidor embutido:
    ```bash
    python -m http.server 8000
    ```
    Alternativamente, use qualquer outro servidor de arquivos estáticos.

4.  **Acesse a aplicação:**
    Abra seu navegador e navegue para `http://localhost:8000`.

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
