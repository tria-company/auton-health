import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Auton Health - Plataforma de Consultas',
  description: 'Entre ou crie sua conta na plataforma Auton Health',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  );
}
