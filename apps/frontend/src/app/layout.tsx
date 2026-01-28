import type { Metadata } from 'next';
import './globals.css';
import { ProvidersWrapper } from '@/components/providers/ProvidersWrapper';
import { SuppressHydrationWarnings } from './suppress-warnings';

export const metadata: Metadata = {
  title: 'Auton Health - Plataforma de Consultas',
  description: 'Sistema de transcrição e análise de consultas médicas em tempo real',
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Favicon */}
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="shortcut icon" type="image/png" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/favicon.png" />
        
        {/* Google Fonts - Inter */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" 
          rel="stylesheet" 
        />
        
        {/* CSS Inline - Solução Definitiva */}
        <style dangerouslySetInnerHTML={{
          __html: `
            /* Forçar aplicação da fonte Inter em TODOS os elementos */
            html, body, * {
              font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
            }
            
            /* Garantir que nenhum elemento escape */
            input, textarea, select, button, div, span, p, h1, h2, h3, h4, h5, h6, a, label, form {
              font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
            }
          `
        }} />
      </head>
      <body suppressHydrationWarning>
        <SuppressHydrationWarnings />
        <ProvidersWrapper>
          {children}
        </ProvidersWrapper>
      </body>
    </html>
  );
}