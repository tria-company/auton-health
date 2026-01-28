"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { gatewayClient } from '@/lib/gatewayClient';

function GoogleCallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [status, setStatus] = useState('Processando autenticação...');

    useEffect(() => {
        const code = searchParams.get('code');
        const error = searchParams.get('error');

        if (error) {
            console.error('Erro retornado pelo Google:', error);
            setStatus('Erro na autenticação. Redirecionando...');
            setTimeout(() => router.replace(`/agenda?google_calendar_error=${error}`), 2000);
            return;
        }

        if (!code) {
            setStatus('Código de autorização não encontrado.');
            setTimeout(() => router.replace('/agenda'), 2000);
            return;
        }

        const exchangeToken = async () => {
            try {
                setStatus('Trocando código por token...');
                const response = await gatewayClient.post('/api/auth/google-calendar/exchange', { code });

                if (response.success) {
                    setStatus('Conectado com sucesso! Redirecionando...');
                    router.replace('/agenda?google_calendar_connected=true');
                } else {
                    console.error('Erro na troca de token:', response);
                    setStatus('Falha ao concluir conexão. Tente novamente.');
                    setTimeout(() => router.replace('/agenda?google_calendar_error=token_exchange_failed'), 3000);
                }
            } catch (err) {
                console.error('Erro inesperado:', err);
                setStatus('Erro inesperado. Tente novamente.');
                setTimeout(() => router.replace('/agenda?google_calendar_error=unknown'), 3000);
            }
        };

        exchangeToken();
    }, [searchParams, router]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-50 p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-neutral-100 p-8 text-center sm:p-10">
                <div className="mb-6 flex justify-center">
                    {/* Minimalist animated icon */}
                    <div className="relative">
                        <div className="w-16 h-16 rounded-full border-4 border-blue-50 border-t-blue-600 animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xl">📅</span>
                        </div>
                    </div>
                </div>

                <h2 className="text-2xl font-bold text-neutral-900 mb-2 tracking-tight">
                    Conectando Agenda
                </h2>

                <p className="text-neutral-500 text-sm font-medium animate-pulse">
                    {status}
                </p>

                <div className="mt-8 pt-6 border-t border-neutral-100">
                    <p className="text-xs text-neutral-400">
                        Você será redirecionado automaticamente em instantes.
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function GoogleCallbackPage() {
    return (
        <Suspense fallback={<div>Carregando...</div>}>
            <GoogleCallbackContent />
        </Suspense>
    );
}
