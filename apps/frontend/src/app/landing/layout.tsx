import type { Metadata } from 'next';
import '../globals.css';
import './landing-tailwind.css';
import './landing.css';

export const metadata: Metadata = {
  title: 'AUTON Health - IA para Diagnóstico de Doenças Crônicas e Autoimunes',
  description: 'A primeira IA para diagnosticar e solucionar a causa raiz de doenças crônicas, autoimunes e de saúde mental. Mais de 3.000 médicos confiam na AUTON AI.',
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
