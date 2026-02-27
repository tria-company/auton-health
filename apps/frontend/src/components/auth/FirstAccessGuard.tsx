'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export function FirstAccessGuard({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        // If auth is loading, wait
        if (loading) return;

        // If no user, stop checking (middleware or other guards handle auth)
        if (!user) {
            setChecking(false);
            return;
        }

        // Check Medico Profile
        const checkProfile = async () => {
            try {
                const { data, error } = await supabase
                    .from('medicos')
                    .select('id, primeiro_acesso')
                    .eq('user_auth', user.id)
                    .single();

                if (data?.primeiro_acesso) {
                    // If first access is true, and NOT on update-password page, redirect
                    if (pathname !== '/auth/update-password') {
                        router.replace('/auth/update-password');
                        return;
                    }
                }

                // Verificar assinatura ativa
                if (data?.id) {
                    const { data: assinatura } = await supabase
                        .from('assinaturas')
                        .select('assinatura_ativa, event')
                        .eq('doctor_id', data.id)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .single();

                    if (assinatura && assinatura.assinatura_ativa === false) {
                        await supabase.auth.signOut();
                        const event = assinatura.event || '';
                        router.replace(`/auth/signin?subscription=inactive&event=${encodeURIComponent(event)}`);
                        return;
                    }
                }
            } catch (err) {
                console.error('Error checking first access:', err);
            } finally {
                setChecking(false);
            }
        };

        checkProfile();
    }, [user, loading, pathname, router]);

    // Optionally show loading state while checking
    // For now we render children to avoid layout flash, but logic redirects fast

    return <>{children}</>;
}
