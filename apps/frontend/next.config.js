/** @type {import('next').NextConfig} */
const path = require('path');
const fs = require('fs');

// Em produção (Vercel), as variáveis de ambiente vêm do Dashboard. Não carregar .env manualmente aqui.

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // experimental.appDir não é mais necessário nas versões atuais
  // Garantir que as variáveis NEXT_PUBLIC_ sejam expostas ao cliente
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_GATEWAY_URL: process.env.NEXT_PUBLIC_GATEWAY_URL,
    NEXT_PUBLIC_GATEWAY_HTTP_URL: process.env.NEXT_PUBLIC_GATEWAY_HTTP_URL,
  },
  
  // Permitir acesso de domínios de túnel durante desenvolvimento
  // Evita o aviso: "Cross origin request detected ... configure allowedDevOrigins"
  //allowedDevOrigins: [
  //  'https://*.loca.lt',
  //],
  
  // Variáveis NEXT_PUBLIC_ são automaticamente expostas ao cliente
  
  // Configurações para audio worklets e WebRTC
  webpack: (config, { isServer }) => {
    // Alias "@" → "src" para garantir resolução consistente em build
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(__dirname, 'src'),
    };
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    // Permitir importação de worklets
    config.module.rules.push({
      test: /\.worklet\.(js|ts)$/,
      use: {
        loader: 'worklet-loader',
        options: {
          name: 'static/worklets/[name].[hash:8].[ext]',
        },
      },
    });

    return config;
  },

  // Configurações de imagens (unoptimized para export estático)
  images: {
    unoptimized: true,
  },

  // Configurações de transpilação
  transpilePackages: [],

  // Configurações de output para export estático
  output: 'export',
  trailingSlash: true,
  
  // Configurações de compilação
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  // Configurações de bundle
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{member}}',
    },
  },

  // Configurações de ESLint
  eslint: {
    dirs: ['src'],
    ignoreDuringBuilds: true,
  },

  // Configurações de TypeScript
  typescript: {
    // Em produção, pule a checagem de tipos (o SWC ainda transpila TS)
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;