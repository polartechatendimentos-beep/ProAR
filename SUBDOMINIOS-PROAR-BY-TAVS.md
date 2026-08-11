# Subdomínios por empresa — ProAR Gestão de Serviços — BY TAV's

## Padrão definitivo

Cada empresa possui um endereço exclusivo baseado no nome fantasia:

- `polartech.proar.app`
- `abcclimatizacao.proar.app`
- `refrisul.proar.app`

Ambientes reservados:

- `teste.proar.app` — cadastro do trial de 7 dias
- `manager.proar.app` — gerenciador exclusivo TAV's
- `proar.app` / `www.proar.app` — institucional/entrada principal

## O que foi implementado

1. O cadastro do trial gera um slug a partir do nome fantasia.
2. Slugs reservados são bloqueados automaticamente.
3. O retorno do trial já fornece `https://<slug>.proar.app`.
4. O login identifica o tenant pelo hostname, sem depender de `?tenant=`.
5. Usuários globais/estáticos não autenticam dentro de um subdomínio de cliente.
6. A sessão é criada no host da empresa, mantendo cookies separados entre subdomínios.
7. O tenant só entra quando seu banco dedicado está em estado `ready`.
8. Não existe fallback silencioso do banco da empresa para o banco mestre.
9. A rotina antiga de migração a partir de `main` não roda para tenants autenticados.
10. Nome fantasia e logo da empresa são carregados na tela de login e no contexto operacional.

## Configuração Vercel / DNS necessária

Adicionar ao projeto no Vercel:

- `proar.app`
- `*.proar.app` (wildcard)

No DNS, configurar o wildcard conforme os valores indicados pelo próprio Vercel para o domínio. Não criar manualmente um domínio para cada cliente: o wildcard resolve os novos subdomínios automaticamente.

Variável recomendada:

```env
PROAR_ROOT_DOMAIN=proar.app
```

## Segurança

Os nomes abaixo são reservados e não podem ser gerados para empresas: `www`, `app`, `api`, `admin`, `manager`, `teste`, `staging`, `homologacao`, `suporte`, `status`, `cdn`, entre outros nomes técnicos.

Cada tenant utiliza banco dedicado. O navegador não recebe a credencial do banco. O backend resolve o banco usando a sessão da empresa.
