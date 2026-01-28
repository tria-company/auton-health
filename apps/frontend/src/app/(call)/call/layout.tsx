import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Auton Health - Plataforma de Consultas',
  description: 'Sistema de consulta online com transcrição em tempo real',
};

export default function CallLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="call-layout">
      {children}
    </div>
  );
}
