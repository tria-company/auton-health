import { Layout } from '@/components/shared/Layout';

export default function ConexaoLayout({
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
