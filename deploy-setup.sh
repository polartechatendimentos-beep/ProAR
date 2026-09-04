#!/bin/bash
# Script de automação de instalação e implantação do ProAR

set -e

echo "=== ProAR Setup & Deployment Automation ==="

if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    echo "Criando .env a partir do .env.example..."
    cp .env.example .env
  fi
fi

echo "1. Instalando dependências..."
npm install

echo "2. Gerando e aplicando tabelas no Vercel Postgres..."
if [ -z "$POSTGRES_URL" ]; then
  echo "[Aviso] POSTGRES_URL não definida no ambiente local. Certifique-se de configurar a variável ou conectar via Vercel CLI."
else
  npx drizzle-kit push
fi

echo "3. Testando build do Next.js..."
npm run build

echo "=== Verificação concluída com sucesso! ==="
