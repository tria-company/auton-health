'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { LoadingScreen } from './LoadingScreen';
import { useAuth } from '@/hooks/useAuth';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [isLayoutReady, setIsLayoutReady] = useState(false);
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  
  // Detectar se está na página de consulta online
  const isConsultationPage = pathname?.includes('/consulta/online');

  useEffect(() => {
    // Se não está carregando autenticação
    if (!authLoading) {
      // Se não tem usuário, redireciona para login
      if (!user) {
        router.push('/auth/signin');
        return;
      }

      // Bloquear acesso de pacientes à área do médico
      const role = (user as { user_metadata?: { role?: string } })?.user_metadata?.role;
      if (role === 'patient') {
        signOut();
        router.replace('/auth/signin?reason=patient');
        return;
      }
      
      // Simula um pequeno delay para garantir que tudo está carregado
      const timer = setTimeout(() => {
        setIsLayoutReady(true);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [user, authLoading, router, signOut]);

  // Mostra loading enquanto verifica autenticação ou carrega layout
  if (authLoading || !isLayoutReady || !user) {
    return <LoadingScreen message="Carregando..." />;
  }

  return (
    <div className={`layout ${isConsultationPage ? 'consultation-layout' : ''}`}>
      <Sidebar 
        expanded={sidebarExpanded}
        onExpandedChange={setSidebarExpanded}
        isTopMenu={isConsultationPage || false}
      />
      
      <div className={`main-content ${sidebarExpanded ? 'expanded' : ''} ${isConsultationPage ? 'consultation-content' : ''}`}>
        <Header />
        
        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  );
}