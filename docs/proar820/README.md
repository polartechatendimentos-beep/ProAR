# ProAR — catálogo de 820 melhorias e entrega de 16/10/2026

Catálogo integral recebido em `Catalogo_Completo_820_Melhorias_ProAR_3.0.xlsx`: 820 IDs únicos em 30 domínios, 311 prioridades Alta, 353 Média e 156 Estratégica. Os oito campos de origem foram preservados em `catalog.json`, com dicionários para textos repetidos e hash SHA-256 do arquivo recebido. Não altera a planilha original nem substitui o catálogo histórico de 520 itens.

814 linhas de origem dizem Planejado; seis dizem Implementado v2.2.0. Esses rótulos não constituem prova de implementação. `auditDefault: not_assessed` mantém a auditoria independente e `partialEvidence` aponta somente entregas parciais conferidas. Não foram implementadas 820 melhorias nesta publicação.

## Conectores recebidos

Os anexos `route.ts`, `domain.ts` e `bll_connector.ts` foram adaptados à aplicação oficial, sem substituir o Radar paginado existente ou gerar registros de exemplo. O endpoint `/api/licitacoes/search` oferece o contrato normalizado e reaproveita as consultas reais de `/api/licitacoes`. Ambos exigem sessão, empresa, permissão de visualização e plano de Licitações; respostas privadas sem cache compartilhado.

A consulta existente PNCP continua paginada e identifica a origem BLL pelo domínio ou nome de plataforma, sem tomar `bll` em qualquer trecho de URL por evidência. O diagnóstico BLL via PNCP é explícito e não afirma consulta direta. Um feed autorizado opcional pode ser configurado com `BLL_AUTHORIZED_FEED_URL` e `BLL_API_TOKEN`, somente no servidor; não há endereço fictício de API padrão nem credencial criada. Sem configuração, nenhuma chamada direta é feita. Nenhuma variável de produção foi alterada por esta entrega.

O feed espera `{items:[...]}` e os campos documentados no anexo; não supõe paginação não documentada. Timeout de 8s, sem redirecionamentos autenticados, validação de esquema e limite de tamanho/quantidade. Campo `hasMore`, descarte de linhas inválidas ou limite de quantidade são reportados como cobertura parcial. Não inventa cidade, CNPJ, número, ano, valor ou prazo. Falha no feed não apaga resultados PNCP. Um feed paginado precisa de um contrato validado específico para cobertura completa.

Deduplicação usa controle PNCP ou sequência PNCP comprovada; número do pregão não equivale ao sequencial PNCP. Registros sem identidade comum comprovada permanecem separados. Mantém origens e caminhos de ingestão ao combinar cópias. Distância desconhecida não vira zero; `distanciaMaxKm` estrita não inclui municípios sem cálculo. Filtros de UF, município, modalidade, prazo confirmado e menção textual PMOC são validados. A existência de PMOC no objeto não substitui a conferência humana de exigências no dossiê.

## Interface solicitada durante a execução

- Aparência clara/escura/automática para o sistema completo, independente da preferência Mobile; tokens de cores e tipografia Inter, números tabulares, mínimo legível nos controles. Não representa certificação WCAG de todas as telas antigas.
- Menu completo pode ser recolhido no desktop. Todos os módulos e suas permissões permanecem disponíveis. A busca global Ctrl+K existente é preservada; não se inventam registros de viatura nem integrações de pesquisa ausentes.
- Cards, Tabela Compacta e Kanban no funil de Licitações; preferência local. Arrastar chama as mesmas validações e persistência existentes: habilitação incompleta e homologação sem evidência continuam bloqueadas. Se o navegador não suportar arraste ou o usuário operar por teclado, a etapa é editável no dossiê.
- Dossiê de licitação em gaveta lateral, com foco contido, Esc e retorno ao elemento anterior. A lista permanece visível ao fundo. Checklist e minuta existentes foram preservados; composição de BDI continua na aba Habilitação e BDI. Gaveta para todas as OS e composição BDI dentro da gaveta não foram implementadas.
- Semáforo com rótulos para os prazos reais de licitação, prontidão em anel e progresso linear. Sem prazo, não exibe urgência inventada. Não define SLA de UTI sem regra de serviço homologada.
- Skeleton no carregamento Mobile, alvos de toque de 48px e modo sol forte existente preservado. Navegação inferior operacional continua disponível. Não cria botão de estoque da van sem integração real de saldo por veículo.

Foi tentada a instalação de Radix, mas o registro npm retornou HTTP 403 para os pacotes. Nenhuma dependência indisponível foi adicionada ao projeto. A gaveta usa `<dialog>` nativo e os componentes Tailwind/CSS existentes; a migração integral shadcn/Radix continua pendente.

## Preservação e referências

Nenhuma migração, exclusão, carga de dados fictícios ou alteração dos cadastros reais. Mantém os 26 módulos e a interface operacional exclusiva de `/mobile`. As mudanças de etapa feitas pelos usuários continuam transações normais autenticadas da empresa.

Fontes técnicas consultadas: https://pncp.gov.br/api/consulta/swagger-ui/index.html ; https://www.gov.br/pncp/pt-br/pncp/manuais ; https://bll.org.br/noticias/conheca-os-canais-de-atendimento-oficiais-da-bll-compras-e-acompanhe-tudo-sobre-o-universo-bll/ ; https://www.radix-ui.com/primitives/docs/components/dialog ; https://ui.shadcn.com/docs/components/radix/sheet .

## Validação

Suíte local: 426 testes aprovados; TypeScript aprovado, ESLint sem erros (com avisos), build Next.js concluído. Treze testes adicionais exercitam regras visuais e de conectores, autorização antes das consultas e a orquestração do Radar com respostas externas simuladas. Evidências em `docs/validation/proar820-connectors-design-20261016.log`. Não representam teste de disponibilidade contínua dos portais nem homologação visual autenticada em todos os dispositivos.
