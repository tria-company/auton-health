import { Layout } from '@/components/shared/Layout';

export default function CadastroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Layout>
      {children}
    </Layout>
  );
}
