#!/bin/bash
set -e

echo "🔨 Building frontend for Vercel..."

# Navegar para o diretório do frontend
cd "$(dirname "$0")/apps/frontend"

# Instalar dependências
echo "📦 Installing dependencies..."
npm install

# Build
echo "🏗️ Building application..."
npm run build

echo "✅ Build completed!"
