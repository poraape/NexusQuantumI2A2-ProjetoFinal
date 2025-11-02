import React, { useState } from 'react';
import { FileTextIcon } from '../icons/FileTextIcon';
import { ProcessingIcon } from '../icons/ProcessingIcon.tsx';
import { LogError } from '../../types';
import { generateFullTextAnalysis } from '../../services/geminiService.ts';
import { Button } from '@tremor/react';

interface FullTextAnalysisProps {
  initialAnalysisText?: string | null;
  processedFiles: File[];
  logError: (error: Omit<LogError, 'timestamp'>) => void;
  onAnalysisComplete: (text: string) => void;
}

export const FullTextAnalysis: React.FC<FullTextAnalysisProps> = ({ initialAnalysisText, processedFiles, logError, onAnalysisComplete }) => {
  const [analysisText, setAnalysisText] = useState(initialAnalysisText);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);

  const handleStartAnalysis = async () => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);
    setProgressMessage('Iniciando análise profunda...');
    try {
      const fullText = await generateFullTextAnalysis(processedFiles, logError, setProgressMessage);
      setAnalysisText(fullText);
      onAnalysisComplete(fullText); // Notify parent
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Falha ao carregar a análise completa.";
      setError(errorMessage);
      logError({ source: 'FullTextAnalysis', message: errorMessage, severity: 'critical', details: err });
    } finally {
      setIsLoading(false);
      setProgressMessage(null);
    }
  };


  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-content-default">
          <ProcessingIcon />
          <p className="mt-4 text-lg animate-pulse">{progressMessage || 'Gerando análise textual completa...'}</p>
          <p className="text-sm">{progressMessage ? 'Isso pode levar alguns instantes.' : 'Aguarde...'}</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-red-400 text-center">
           <p className="text-lg">Falha ao Carregar Análise</p>
           <p className="text-sm mt-2 p-4 bg-red-500/10 rounded-lg">{error}</p>
           <Button onClick={handleStartAnalysis} className="mt-4">Tentar Novamente</Button>
        </div>
      );
    }
    
    if (analysisText) {
       return (
         <div className="flex-1 overflow-y-auto pr-2 text-content-default leading-relaxed bg-black/20 rounded-xl p-4 border border-border-glass">
            <p className="whitespace-pre-wrap font-mono text-sm">
                {analysisText}
            </p>
         </div>
       );
    }

    // Initial state: waiting for user action
    return (
        <div className="flex flex-col items-center justify-center h-full text-content-default text-center">
            <div className="bg-purple-500/20 p-4 rounded-2xl mb-4">
                <FileTextIcon className="w-10 h-10 text-purple-300" />
            </div>
            <h3 className="text-xl font-bold text-content-emphasis">Análise Textual Completa</h3>
            <p className="mt-2 max-w-md">
                Acesse uma análise detalhada, gerada pela IA, com base no conteúdo integral dos documentos fornecidos.
            </p>
            <p className="text-xs text-content-default/70 mt-2">(Pode consumir mais recursos e levar mais tempo)</p>
            <Button 
                onClick={handleStartAnalysis}
                className="mt-6 bg-purple-600 hover:bg-purple-700 border-purple-500 text-white font-bold"
                loading={isLoading}
            >
                Iniciar Análise Completa
            </Button>
        </div>
    );
  };

  return (
    <div className="bg-bg-secondary backdrop-blur-xl rounded-3xl border border-border-glass shadow-glass p-6 h-full flex flex-col">
      <div className="flex items-center mb-6 flex-shrink-0">
        <div className="bg-purple-500/20 p-3 rounded-xl mr-4">
            <FileTextIcon className="w-6 h-6 text-purple-300" />
        </div>
        <div>
            <h2 className="text-2xl font-bold text-content-emphasis">Análise Textual Completa</h2>
            <p className="text-content-default">Detalhes completos gerados pela IA com base nos documentos.</p>
        </div>
      </div>
      {renderContent()}
    </div>
  );
};