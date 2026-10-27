# ProAR Mobile — integração para homologação

Origem: https://chatgpt.com/share/6ad182e7-e8f4-83e9-aa83-e5329d523d05

Base: production e08f47cfebf742c5f7173b2570bfc131e2059da1. O chat solicita desenvolvimento separado e homologação antes de produção. Não substituir app/mobile/page.tsx pelo protótipo da branch antiga: isso removeria integrações reais.

## Entrega integrada

- Aparência clara, escura e automática em Mais, preferência local e atualização conforme o aparelho. CSS restrito ao componente Mobile; modo sol forte mantém prioridade.
- Inspeções opcionais de Cassete, Piso-teto e Split/Hi-wall conforme as identificações dos equipamentos selecionados na OS. Reutiliza checklist e rascunho existentes; não torna equipamento obrigatório e não modifica os requisitos obrigatórios do servidor.
- Mantém IndexedDB criptografado e isolado por empresa/usuário, fotos comprimidas no rascunho, comandos estáveis, revisão de conflito e confirmação real de conclusão. Não cria fila paralela de eventos sem tenant.
- Busca de etiqueta por ID/link com equipmentId, validada contra equipamentos retornados na OS autenticada. Leitura por BarcodeDetector quando disponível, fallback manual e liberação da câmera ao fechar, desmontar ou falhar. URLs externas não são abertas. Etiquetas públicas com token continuam no fluxo público existente; não se presume que token equivale ao ID interno.
- Comparação das fotos locais antes/depois na OS, seleção de pares, galeria preservada. As fotos são enviadas pelo fluxo operacional existente, sem gravar apenas metadados fictícios.
- Resumo de supervisão na Central apenas quando bootstrap autoriza manager, usando somente suas OS autorizadas; distingue pendências deste aparelho das equipes. O servidor continua a controlar leitura e ações.

## Limites de homologação

Não adiciona pré-carga completa do dia, BLE/P2P, leitura universal em aparelhos sem BarcodeDetector, geração de IA, catálogo de manuais nem sincronização de dados não suportados. Os rascunhos só existem após abrir a OS; não substituem backup. O checklist contextual é orientação inicial e depende da identificação cadastral; não certifica conformidade PMOC ou execução de procedimentos. O painel não inventa localização ou pendências dos outros dispositivos.

Homologar no celular: alternar temas e preferência do aparelho, testar modo sol forte; preencher OS e recarregar para recuperar fotos e checklist; comparar imagens; bloquear câmera e testar entrada manual; ler etiqueta autorizada e rejeitar de outro cliente; preparar envio sem rede e sincronizar após retorno; comparar perfis técnico/gestor e empresas distintas. Não usar dados fictícios no banco real.

Publicação em produção permanece fora desta entrega. PR de desenvolvimento mantém a versão atual operando.

## Validação executada

`npm run validate:fast`: TypeScript aprovado, ESLint sem erros (com avisos) e 413 testes aprovados. `npm run build`: compilação otimizada e geração das rotas concluídas. Os cinco testes comportamentais adicionais cobrem tema, inspeções opcionais, vínculo seguro da etiqueta, contagens de supervisão e encerramento da câmera; evidências em `docs/validation/mobile-experience-20261015.log`. Homologação visual em aparelho e testes autenticados com os perfis de cliente ainda devem ser executados antes de promover a produção.
