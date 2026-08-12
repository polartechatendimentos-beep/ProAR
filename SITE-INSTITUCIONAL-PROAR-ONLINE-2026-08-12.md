# Site institucional do ProAR Online

O domínio raiz `proar.online` e `www.proar.online` apresenta o site público da plataforma. Os ambientes operacionais permanecem separados por subdomínio:

- `teste.proar.online`: cadastro e teste gratuito;
- `manager.proar.online`: gerenciador administrativo TAV's;
- `polartech.proar.online`: sistema operacional PolarTech;
- `nomefantasia.proar.online`: ambiente individual de cada empresa.

O roteamento é feito no proxy da aplicação sem remover ou substituir as rotas anteriores do ERP.

- `PROAR_ROOT_DOMAIN=proar.online`: domínio raiz configurado na Vercel.
