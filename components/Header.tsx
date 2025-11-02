import React, { useState, useRef, useEffect } from 'react';
import { Logo } from './Logo.tsx';
import { DownloadIcon } from './icons/DownloadIcon.tsx';
import { SpedExportIcon } from './icons/SpedExportIcon.tsx';
import { BugIcon } from './icons/BugIcon.tsx';
import { SunIcon } from './icons/SunIcon.tsx';
import { MoonIcon } from './icons/MoonIcon.tsx';
import { Theme } from '../types.ts';
import { useErrorLog } from '../hooks/useErrorLog.ts';
import { extrairDadosParaExportacao, gerarSpedFiscalMVP, gerarEfdContribMVP, gerarCsvERP, downloadFile } from '../services/exporter.ts';
import { exportarConteudoCompleto } from '../services/exportService.ts';

interface HeaderProps {
  onLogoClick: () => void;
  theme: Theme;
  onToggleTheme: () => void;
  onOpenErrorLog: () => void;
  processedFiles: File[];
}

const ExportDropdown: React.FC = () => {
    const [isExporting, setIsExporting] = useState<string | null>(null);

    const handleExport = async (format: 'pdf' | 'docx' | 'html') => {
        if (isExporting) return;
        setIsExporting(format);
        try {
            await exportarConteudoCompleto(format);
            alert(`Exportação como ${format.toUpperCase()} concluída com sucesso! Verifique sua pasta de downloads.`);
        } catch (error) {
            console.error(`Export to ${format} failed:`, error);
            alert(`Ocorreu um erro ao exportar como ${format.toUpperCase()}. Verifique o console para mais detalhes.`);
        } finally {
            setIsExporting(null);
        }
    };
    
    return (
        <div className="absolute top-full right-0 mt-2 w-52 bg-bg-secondary-opaque rounded-xl border border-border-glass shadow-glass p-2 z-50">
            {['pdf', 'docx', 'html'].map((format) => (
                <button 
                    key={format}
                    onClick={() => handleExport(format as 'pdf' | 'docx' | 'html')} 
                    disabled={!!isExporting}
                    className="w-full text-left px-3 py-1.5 text-sm rounded-md text-content-default hover:bg-white/10 disabled:opacity-50 disabled:cursor-wait flex items-center justify-between"
                >
                    <span>Exportar como {format.toUpperCase()}</span>
                     {isExporting === format && (
                        <div className="w-4 h-4 border-2 border-content-default border-t-transparent rounded-full animate-spin"></div>
                    )}
                </button>
            ))}
        </div>
    );
};

const FiscalExportDropdown: React.FC<{
    files: File[],
    logError: (error: Omit<any, 'timestamp'>) => void
}> = ({ files, logError }) => {
    const [isExporting, setIsExporting] = useState(false);
    
    const handleExport = async (format: 'sped' | 'efd' | 'csv') => {
        if (isExporting) return;
        setIsExporting(true);
        try {
            logError({ source: 'Exporter', message: `Iniciando exportação para ${format.toUpperCase()}`, severity: 'info'});
            const { documentos, log } = await extrairDadosParaExportacao(files);

            let fileContent: string;
            let fileName: string;
            
            switch(format) {
                case 'sped':
                    fileContent = gerarSpedFiscalMVP(documentos);
                    fileName = 'SPED_FISCAL.txt';
                    break;
                case 'efd':
                    fileContent = gerarEfdContribMVP(documentos);
                    fileName = 'EFD_CONTRIBUICOES.txt';
                    break;
                case 'csv':
                    fileContent = gerarCsvERP(documentos);
                    fileName = 'ERP_IMPORT.csv';
                    break;
            }

            downloadFile(fileName, fileContent);
            if (log.length > 0) {
                downloadFile('export.log', log.join('\n'));
                alert(`Exportação concluída! Verifique o arquivo ${fileName} e o log de exportação 'export.log' com ${log.length} avisos.`);
            } else {
                 alert(`Exportação concluída com sucesso! Verifique o arquivo ${fileName}.`);
            }
            logError({ source: 'Exporter', message: `Exportação para ${format.toUpperCase()} concluída. ${documentos.length} documentos válidos, ${log.length} avisos.`, severity: 'info'});

        } catch(e) {
            console.error('Export failed:', e);
            logError({ source: 'Exporter', message: `Falha na exportação: ${e.message}`, severity: 'critical', details: e });
            alert(`Ocorreu um erro durante a exportação: ${e.message}`);
        } finally {
            setIsExporting(false);
        }
    };
    
    return (
        <div className="absolute top-full right-0 mt-2 w-56 bg-bg-secondary-opaque rounded-xl border border-border-glass shadow-glass p-2 z-50">
            {isExporting ? (
                 <div className="flex items-center justify-center gap-2 px-3 py-1.5 text-sm text-content-default">
                    <div className="w-4 h-4 border-2 border-content-default border-t-transparent rounded-full animate-spin"></div>
                    <span>Exportando...</span>
                 </div>
            ) : (
                <>
                    <button onClick={() => handleExport('sped')} className="w-full text-left px-3 py-1.5 text-sm rounded-md text-content-default hover:bg-white/10">Exportar SPED Fiscal (MVP)</button>
                    <button onClick={() => handleExport('efd')} className="w-full text-left px-3 py-1.5 text-sm rounded-md text-content-default hover:bg-white/10">Exportar EFD Contrib. (MVP)</button>
                    <button onClick={() => handleExport('csv')} className="w-full text-left px-3 py-1.5 text-sm rounded-md text-content-default hover:bg-white/10">Exportar CSV para ERP</button>
                </>
            )}
        </div>
    );
}

export const Header: React.FC<HeaderProps> = ({ onLogoClick, theme, onToggleTheme, onOpenErrorLog, processedFiles }) => {
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isFiscalExportOpen, setIsFiscalExportOpen] = useState(false);
  
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const fiscalExportDropdownRef = useRef<HTMLDivElement>(null);
  
  const { logs, logError } = useErrorLog();
  const canExport = processedFiles.length > 0;
  const canExportDashboard = document.querySelector('#dashboard-view-content') !== null;


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setIsExportOpen(false);
      }
      if (fiscalExportDropdownRef.current && !fiscalExportDropdownRef.current.contains(event.target as Node)) {
        setIsFiscalExportOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="flex items-center justify-between p-4 bg-bg-secondary/30 backdrop-blur-lg border-b border-border-glass sticky top-0 z-50 h-[80px]">
      <Logo onLogoClick={onLogoClick} />
      <div className="flex items-center space-x-2">
        
        {/* Report Export Dropdown */}
        <div className="relative" ref={exportDropdownRef}>
            <button 
                onClick={() => canExportDashboard && setIsExportOpen(o => !o)} 
                disabled={!canExportDashboard}
                className="text-content-default hover:text-content-emphasis p-2 rounded-full bg-bg-secondary hover:bg-white/10 border border-border-glass disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Exportar Relatório Completo"
                >
                <DownloadIcon className="w-5 h-5"/>
            </button>
            {isExportOpen && <ExportDropdown />}
        </div>
        
        {/* Fiscal Data Export Dropdown */}
        <div className="relative" ref={fiscalExportDropdownRef}>
            <button 
                onClick={() => canExport && setIsFiscalExportOpen(o => !o)} 
                disabled={!canExport}
                className="text-content-default hover:text-content-emphasis p-2 rounded-full bg-bg-secondary hover:bg-white/10 border border-border-glass disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Exportar Dados Fiscais"
            >
                <SpedExportIcon className="w-5 h-5"/>
            </button>
             {isFiscalExportOpen && <FiscalExportDropdown files={processedFiles} logError={logError} />}
        </div>


        {/* Error Log */}
        <button onClick={onOpenErrorLog} className="relative text-content-default hover:text-content-emphasis p-2 rounded-full bg-bg-secondary hover:bg-white/10 border border-border-glass">
            <BugIcon className="w-5 h-5"/>
            {logs.length > 0 && (
                <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-bg-secondary-opaque text-[8px] flex items-center justify-center text-white">
                    {logs.length}
                </span>
            )}
        </button>

        {/* Theme Toggle */}
        <button onClick={onToggleTheme} className="text-content-default hover:text-content-emphasis p-2 rounded-full bg-bg-secondary hover:bg-white/10 border border-border-glass">
            {theme === 'dark' ? <SunIcon className="w-5 h-5"/> : <MoonIcon className="w-5 h-5"/>}
        </button>
      </div>
    </header>
  );
};