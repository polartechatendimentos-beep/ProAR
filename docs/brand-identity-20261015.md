# Identidade ProAR e ProAR Mobile

Referência visual: símbolo P metálico azul, floco de neve e ondas de ar fornecidos pelo cliente em 15/10/2026.

- Sistema: `public/brand/proar-system.svg` e marca horizontal `proar-system-wordmark.svg`.
- Mobile: `public/brand/proar-mobile.svg` e marca horizontal `proar-mobile-wordmark.svg`; identificador de celular diferencia a instalação.
- Galeria pública e downloads: `/brand/index.html`.
- Fonte editável: `lib/brand-assets.ts`. Sem dependências de serviços de imagem ou credenciais.
- Exportar PNGs: `node --experimental-strip-types scripts/generate-brand-assets.mjs` (usa sharp disponível no ambiente Next.js).
- PWA completo: `/manifest-system.webmanifest`. PWA de campo mantém `/manifest.webmanifest` e entrada `/mobile`.
- Android: `node scripts/prepare-android-brand.mjs` após `npx cap sync android`. A pipeline aplica os ícones antes do build.

Os ícones móveis e do sistema são exportados em 32, 180, 192 e 512 px. As imagens de launcher Android têm cinco densidades e foreground adaptativo com área de segurança. Instalações existentes podem exigir atualização ou reinstalação para renovar ícones armazenados pelo sistema operacional.
