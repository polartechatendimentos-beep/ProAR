# ProAR Field — integração inicial do aplicativo enviado

## Origem e decisão arquitetural

O arquivo enviado `proar-field-enterprise-complete.zip` é um protótipo **Expo SDK 57 / React Native 0.86**, com UI local no `App.tsx`. A documentação original declara que o login, ordens, sincronização, check-in, OCR, voz, assinaturas, PDF, NPS, Pix e geocerca são demonstrativos ou não integrados.

O ERP ProAR de produção é **Next.js 16** e utiliza autenticação por cookie HTTP-only, permissões e bancos por empresa. Um componente React Native não pode ser inserido diretamente na árvore Next sem portar a UI e suas dependências. Esta primeira integração implementa **uma adaptação web responsiva** no domínio existente `/mobile`, sem misturar dependências Expo com o build Next.

**Não é APK nem app Expo nativo.** O ZIP original deve ser preservado como referência de interface e para uma futura versão nativa em projeto isolado.

## Implementado neste PR

- Rota `/mobile` substitui o espelho do desktop por uma interface própria, inspirada no ProAR Field: Início, Agenda, Ordens, Mais e detalhe de OS.
- Endpoint `GET /api/mobile/bootstrap` usa sessão ProAR, `os.visualizar`, ID de empresa da sessão e banco da empresa.
- Projeção estrita dos dados de OS; sem documentos, credenciais, valores, observações internas ou payload integral do ERP.
- Técnicos veem apenas OS atribuídas exatamente a seu nome de exibição ou login; gerência/administradores com permissão podem ver todas as OS da empresa.
- Painel, agenda e busca exibem **dados reais**, sem clientes e OS fictícios do ZIP.
- Erros de autenticação, autorização, banco e conexão são exibidos; não são simuladas sincronizações ou alterações.
- Detalhe com rota do endereço via mapa externo; link para o ProAR completo para edição.
- Testes de isolamento de OS por técnico, campos permitidos e métricas.

## Ainda não implementado

- Criação/edição/conclusão de OS na interface mobile, check-in e ponto reais.
- Fila offline persistente, anexos e sincronização com resolução de conflitos.
- Scanner QR/NFC, fotos, OCR, ditado por voz, assinatura, PDF, pagamentos e NPS.
- GPS em segundo plano e rastreamento: exigem consentimento explícito, políticas de retenção, backend e build nativo.
- APK/AAB ou publicação nas lojas. O ZIP Expo original permanece um protótipo independente.

## Próximas fases recomendadas

1. **P1**: endpoint transacional específico para OS com autorização, revisão otimista, idempotência, auditoria e testes de conflito; liberar ações mobile gradualmente.
2. **P1**: check-in por OS, checklist e fotos com upload seguro, vínculo por ID, limites e permissão por técnico.
3. **P1**: fila offline durável com escopo por tenant e usuário, operações com IDs idempotentes, retomada e sincronização segura.
4. **P2**: assinatura, relatório PDF, scanner QR da etiqueta permanente e histórico.
5. **P2**: jornada/ponto e GPS, com consentimento e configuração adequada do app nativo.
6. **P3**: empacotar o Expo como app nativo com autenticação segura por token de curta duração e endpoints próprios, sem copiar cookies/segredos do navegador.

## Homologação obrigatória

- [ ] CI completo (typecheck, lint, testes, build, smoke).
- [ ] Sessão válida e expirada; usuário sem `os.visualizar`.
- [ ] Técnico não acessa OS de outro técnico, nem de outra empresa.
- [ ] Gerente visualiza apenas OS da sua empresa.
- [ ] Banco indisponível não exibe dados fictícios.
- [ ] Layout em Android e iPhone, telas 320px–820px.
- [ ] O ProAR desktop e os 26 módulos continuam operacionais.
- [ ] Nenhuma publicação ou migração sem aprovação explícita.

## Compatibilidade

O protótipo original informa Expo 57 e permissões de localização em primeiro plano. Uma futura integração nativa deve verificar a documentação da versão e requerer build próprio para módulos nativos e background location. Nenhuma dependência Expo foi adicionada ao Next.js.
