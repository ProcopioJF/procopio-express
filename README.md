# Procópio Express

Aplicação web mobile-first para solicitar entregas e manter registros gerenciais
de pedidos. O WhatsApp apoia o atendimento operacional, e o painel Admin
permite acompanhar e atualizar as etapas de entrega.

## Estrutura ativa

- `src/App.tsx`: sessão e seleção das áreas pública, Admin e Empresa.
- `src/pages/PublicPortal.tsx`: formulário público que grava pedidos pela API.
- `src/pages/LoginPage.tsx`: autenticação real por e-mail e senha.
- `src/pages/AdminDashboard.tsx`: visão geral, pedidos, empresas, financeiro,
  tabelas de preços e configurações.
- `src/pages/CompanyDashboard.tsx`: indicadores e registros limitados à empresa
  autenticada, relatórios CSV e perfil empresarial.
- `backend/`: Express, JWT, Prisma e PostgreSQL/Supabase.

`src/main.tsx` é a entrada do Vite e monta `src/App.tsx`.

## Executar localmente

Para desenvolvimento local, configure o `.env` da raiz com uma URL PostgreSQL
local e um `JWT_SECRET` forte. O `.env` não deve ser commitado. Para o Supabase
de teste, siga o procedimento de status/deploy da próxima seção; não use
`migrate dev` contra o banco Supabase.

```powershell
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

Para preparar o Supabase de teste, somente depois de configurar localmente
`DATABASE_URL` apontando para o projeto de teste:

```powershell
npm run prisma:migrate:status
npm run prisma:migrate:deploy
```

Execute `npm run prisma:seed` apenas se quiser também criar dados demonstrativos
no projeto de teste.

### Gerar dados sintéticos para Procópio Intelligence

Use um projeto Supabase de teste, nunca o Supabase comercial. O seed cria dados
fictícios no projeto configurado; não altera tarifas.

1. Copie `backend/intelligence-test-env.example` para `backend/.env.test`.
2. Preencha nesse arquivo a URL PostgreSQL e o project ref do Supabase de teste.
   Defina uma senha privada de pelo menos 12 caracteres para os usuários
   sintéticos. O arquivo `.env.test` é ignorado pelo Git.
3. Confira novamente que o project ref corresponde ao projeto de teste. Se o
   `.env` principal também apontar para esse mesmo projeto de teste, autorize o
   uso somente para essa execução no PowerShell:

```powershell
$env:INTELLIGENCE_TEST_ALLOW_PRIMARY_DATABASE = "true"
npm run intelligence:test-seed
Remove-Item Env:INTELLIGENCE_TEST_ALLOW_PRIMARY_DATABASE
```

O comando aplica as migrations pendentes no destino validado e cria uma conta
Admin e três contas Empresa `@test.invalid`, com a senha definida localmente em
`INTELLIGENCE_TEST_USER_PASSWORD`, além de pedidos sintéticos por sete meses.
Os volumes das empresas são diferentes; parte dos pedidos tem distância e
tarifa por KM registradas e parte permanece sem distância. O seed pode ser
repetido: antes de inserir de novo, remove apenas pedidos sintéticos marcados
`is_seed` das empresas de homologação. Ele compara o project ref com o `.env`
principal e recusa a execução se o mesmo projeto Supabase estiver configurado
nos dois locais, a menos que `INTELLIGENCE_TEST_ALLOW_PRIMARY_DATABASE=true`
seja definido explicitamente para uma execução. Não exibe a senha. Essas contas
e os dados são fictícios e não devem ser usados em produção.

Inicie a API e o frontend em terminais separados:

```powershell
npm run backend:dev
npm run dev
```

O backend usa a porta `3333`; o Vite usa a porta configurada em `vite.config.ts`
(`8443` por padrão). `GET http://localhost:3333/health` verifica banco e API.

## Sequência para liberar o projeto

1. Configure `.env` local com `DATABASE_URL` PostgreSQL, `JWT_SECRET` e
   `CORS_ORIGINS`. O padrão do cálculo por KM é opcional e desativado:
   “Consultar valor” permanece como principal. Para ativá-lo explicitamente,
   configure `PER_KM_PRICING_ENABLED=true` e `ROUTING_API_URL`. Para
   desenvolvimento, `DATABASE_URL` pode apontar para PostgreSQL local.
2. Para o Supabase de teste, confira o projeto selecionado no painel e configure
   `DATABASE_URL` no `.env` local. Rode primeiro `npm run prisma:migrate:status`
   para verificar o histórico. Se o destino e as migrations pendentes estiverem
   corretos, aplique-as com `npm run prisma:migrate:deploy`. Use
   `npm run prisma:migrate` apenas para desenvolvimento local de migrations.
   Rode `npm run prisma:seed` no teste somente se quiser criar as contas e
   tarifas demonstrativas descritas abaixo. Nunca aponte esses comandos ao
   banco principal para esta etapa.
3. Inicie backend e frontend, confirme `GET /health` com status `ok` e teste
   login, permissões, criação de pedido, preços FIXED/RANGE/PER_KM/QUOTE e
   pedido sem tarifa.
4. As quatro tabelas oficiais foram importadas e conferidas no Supabase de
   teste. O seed continua contendo dados de demonstração; não o use para
   substituir as tarifas comerciais.
5. A arquitetura inicial será Supabase para PostgreSQL e Vercel para frontend
   (Vite) e API Express (`api/[...path].ts`). Configure no projeto Vercel
   `DATABASE_URL` com o pooler do Supabase, `JWT_SECRET` forte e
   `PER_KM_PRICING_ENABLED=false`; `CORS_ORIGINS` é opcional para URLs geradas
   pela Vercel e deve incluir qualquer domínio personalizado adicional. Deixe
   `VITE_API_URL` vazio ou como `/api/v1` para manter a API no mesmo domínio.
6. As migrations devem ser verificadas e aplicadas manualmente ao banco de teste
   com `npm run prisma:migrate:status` e `npm run prisma:migrate:deploy`, usando
   a conexão PostgreSQL direta do Supabase. O build/deploy Vercel não executa
   migrations automaticamente. Depois da autorização para publicar, confirme
   health check, login e um pedido de ponta a ponta. Configure credenciais e
   webhook do WhatsApp somente se a operação usar envio automático.

Validação:

```powershell
npm run backend:typecheck
npm run backend:build
npm run build
node --import tsx --test backend/src/services/intelligence.test.ts
node --import tsx --test backend/prisma/intelligence-test-seed-config.test.ts
```

## Arquitetura inicial: Supabase + Vercel

- **Supabase:** PostgreSQL e migrations Prisma. A aplicação acessa o banco pelo
  backend Express; não usa a chave `service_role` nem expõe credenciais de banco
  ao navegador.
- **Vercel:** frontend Vite como conteúdo estático e API Express como função
  Node.js em `api/[...path].ts`, no mesmo domínio. O fallback SPA preserva as
  rotas do frontend, `/api/*` atende o backend, `/health` encaminha ao health
  check da API e `/webhooks/whatsapp` encaminha ao webhook Express.
- O frontend usa `/api/v1` por padrão, então preview e produção usam a API do
  mesmo deployment, sem URL de API externa nem variável `VITE_API_URL`
  específica.
- `VERCEL_URL` e `VERCEL_PROJECT_PRODUCTION_URL` são aceitos automaticamente
  para CORS. Configure `CORS_ORIGINS` apenas para domínios adicionais, como um
  domínio próprio. No painel Vercel, habilite **System Environment Variables**
  para disponibilizar essas origens à função.

No projeto Vercel, conecte este repositório pela raiz e use o comando de build
`npm run vercel-build` (também configurado em `vercel.json`). O comando gera o
cliente Prisma, compila o backend e cria o frontend. Configure as variáveis no
ambiente Vercel, nunca no código:

- `DATABASE_URL`: URL PostgreSQL do pooler Supabase compatível com Prisma, SSL
  obrigatório e limite de conexões apropriado a funções serverless. Use o
  **Transaction pooler** do Supabase para a função Vercel e acrescente
  `pgbouncer=true&connection_limit=1` à query string. Copie o host, porta e
  usuário exibidos pelo painel Supabase; não monte a URL manualmente.
- `JWT_SECRET`: segredo forte e exclusivo do ambiente.
- `NODE_ENV=production`: configure para os ambientes Production e Preview,
  garantindo as verificações de segurança do backend em funções Vercel.
- `CORS_ORIGINS`: opcional; liste origens HTTPS adicionais separadas por vírgula.
- `PER_KM_PRICING_ENABLED=false`: mantém “Consultar valor” como padrão.
- `ROUTING_API_URL` e credenciais WhatsApp: opcionais, somente se os recursos
  correspondentes forem ativados.
- `VITE_API_URL`: omita ou defina como `/api/v1` para usar o mesmo domínio.

Use a conexão PostgreSQL direta do Supabase apenas para administrar migrations
manualmente, após confirmar o project ref e o ambiente; o Transaction pooler é
para as requisições serverless, não para migrations. O build e a inicialização
das funções Vercel não aplicam migrations. A produção permanece sem alterações
até a autorização explícita para a etapa final de publicação. Nenhuma credencial
do Supabase ou da Meta deve ser commitada.

### Estado das migrations do Supabase de teste

As migrations `20261001010000_figma_business_modules` e
`20261002000000_origin_destination_pricing` foram recuperadas do histórico Git e
seus conteúdos correspondem exatamente aos arquivos registrados na versão
original. A introspecção somente de leitura confirmou que o banco de teste já
contém os módulos de gestão e preços direcionais. A migration pendente
`20261002010000_management_and_pricing_api` foi reconciliada para acrescentar
somente `perKmRate` em `PriceTableDestination` e `Order`; não recria tabelas,
tipos, índices ou dados existentes.

Essa migration foi aplicada somente no Supabase de teste; `npm run
prisma:migrate:status` confirmou que as 11 migrations estão sincronizadas e a
introspecção confirmou as duas colunas. O endpoint `GET /health` também respondeu
com API e banco saudáveis. A produção permanece sem alterações. Antes de liberar
o uso, ainda valide login, permissões, criação e consulta de pedidos com dados
de teste e confira as tarifas comerciais.

## Fluxo de pedidos

1. O cliente preenche coleta, destino, contato do solicitante/destinatário e
   observações.
2. A aplicação consulta a tabela associada ao bairro de coleta e, nela, a tarifa
   do bairro de entrega. Alterar qualquer bairro dispara uma nova consulta.
3. O backend recalcula a tarifa ao gravar o pedido; não aceita preço do
   navegador. Pedidos FIXED guardam o valor; RANGE guarda os limites; PER_KM,
   QUOTE ou uma rota sem tarifa são registrados sem preço e exibidos como
   “Consultar valor”.
4. Pedidos empresariais são associados somente à empresa presente no JWT.
5. Ao finalizar, grava o pedido com status `FINALIZED` e dispara a notificação
   operacional.
6. No painel Admin, a mesma conta pode confirmar o pedido, confirmar a coleta,
   iniciar a entrega e confirmar a conclusão. Cada etapa é sequencial, exige
   confirmação para concluir a entrega e fica registrada no histórico.
7. Sem WhatsApp Business API configurada, a interface oferece um link com a
   mensagem preenchida para continuar o atendimento manualmente.

O nome e o telefone do solicitante são armazenados separadamente dos dados do
destinatário e aparecem nas listas/relatórios. A migration
`20261001003000_order_requester_and_notification_status` adiciona esses campos
sem apagar os pedidos existentes; registros anteriores não terão o nome do
solicitante preenchido automaticamente.

Os indicadores usam agregações no banco, considerando todos os pedidos dentro
do escopo autorizado (Admin: geral; Empresa: apenas seu próprio `companyId`).
“Total” e “média” representam valores registrados nos pedidos, não despesas
operacionais contábeis da Procópio Express.

## Procópio Intelligence local

A conversa da área Intelligence consulta `POST /api/v1/intelligence/ask`, uma
análise determinística executada no backend e no banco do próprio app; não usa
API paga, modelo externo nem envia dados a terceiros. O endpoint exige sessão
autenticada: Admin consulta a operação global e usuários Empresa consultam
somente pedidos do `companyId` presente na sessão.

As respostas consideram todo o histórico dentro desse escopo, não apenas os
100 pedidos recentes exibidos nas tabelas. A análise cobre volumes e status,
valores realmente registrados, distâncias gravadas, bairros de coleta/entrega,
horário de cadastro no fuso de Brasília e volumes mensais. Valores ausentes,
faixas ainda não fechadas e quilômetros não registrados não são inventados;
concentração por bairro não é apresentada como prova de menor custo. O sistema
também não prevê demanda futura. É uma inteligência analítica baseada em regras
e agregações, não um modelo generativo; perguntas fora das métricas disponíveis
recebem os dados gerais e seus limites.

## Tarifas: estado da integração

A tela Figma é integrada às rotas `/admin/price-tables` para tabelas direcionais,
origens, destinos, tarifas fixas, faixas, por KM, sob consulta e importação
CSV/XLSX. A consulta pública e a criação do pedido usam o mesmo resolvedor; a
tarifa é recalculada no backend, sem confiar no preço informado pelo navegador.
As rotas legadas de tarifa fixa permanecem como fallback compatível. Quando
não existe tarifa para a combinação de bairros, ou quando o tipo de tarifa não
tem valor calculável, o pedido pode ser registrado sem preço e a interface
mostra “Consultar valor”.

A migration `20261002010000_management_and_pricing_api` e as tarifas oficiais
foram aplicadas somente no Supabase de teste; a produção permanece sem
alterações. As quatro origens (Altos dos Passos, Cascatinha, Centro e São
Mateus) agora têm 189 destinos ativos cada, incluindo faixas e tarifas de
R$ 1,30/km conforme as imagens. Os valores com barra foram importados como
faixas mínima/máxima, conforme confirmado pelo usuário. O seed continua
cadastrando tarifas de demonstração; não o use para substituir as oficiais.
“Consultar valor” é o comportamento principal para as tarifas PER_KM. O cálculo
é opcional e fica desativado por padrão; somente será utilizado se
`PER_KM_PRICING_ENABLED=true`, `ROUTING_API_URL` e coordenadas válidas forem
configurados. Sem todos esses itens, o pedido continua sob consulta.

## Mapa

O formulário usa Leaflet e tiles OpenStreetMap, sem chave de API ou faturamento.
A geocodificação usa Nominatim. Para produção com volume elevado, configure um
provedor de mapas/geocodificação dedicado e respeite os limites dos serviços
públicos. O cálculo PER_KM é opcional, desativado por padrão e só consulta um
endpoint de roteamento OSRM se `PER_KM_PRICING_ENABLED=true` e `ROUTING_API_URL`
estiverem configurados; caso contrário, a tarifa permanece “Consultar valor”.

## WhatsApp

Credenciais opcionais do backend:

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_OPERATIONS_NUMBER`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_APP_SECRET`

Sem as credenciais da Meta, o pedido continua sendo persistido e a mensagem pode
ser aberta via link `wa.me`. Configure webhook público HTTPS antes de ativar a
integração em produção.

## Autenticação e contas de desenvolvimento

O login consulta `/api/v1/auth/login` e mantém o token JWT no navegador. O
backend autoriza cada rota, limita CORS aos domínios configurados e aplica o
isolamento empresarial. A consulta pública de pedido exige seu token. O seed cria as
contas de desenvolvimento abaixo quando ainda não existem:

| Perfil | E-mail | Senha inicial |
|---|---|---|
| Administrador | `admin@procopio.com` | `Procopio@123` |
| Empresa | `empresa@acme.com` | `Procopio@123` |
| Motoboy | `joao@procopio.com` | `Procopio@123` |

O seed não redefine a senha de contas já existentes. Troque as senhas iniciais,
configure um `JWT_SECRET` seguro e restrinja CORS antes do uso real.

## Funcionalidades ainda dependentes de configuração ou validação

- Recuperação automática de senha por e-mail (a tela informa que deve ser
  solicitada ao administrador).
- O cálculo PER_KM é opcional e começa desativado; para habilitá-lo, configure
  `PER_KM_PRICING_ENABLED=true`, `ROUTING_API_URL` e valide com coordenadas de
  teste. Sem ativação explícita, a cotação permanece como “Consultar valor”.
- Publicação online está deliberadamente adiada para a última etapa, conforme
  decisão do usuário. A arquitetura inicial definida é Supabase + Vercel;
  configurar projetos, domínios e variáveis, e publicar somente com autorização
  explícita.
- Confirmar/configurar credenciais do WhatsApp Business, webhook público HTTPS
  e CORS no domínio de produção.
- Validar migrations, health check, login e um pedido de ponta a ponta no
  ambiente de produção somente depois da autorização explícita para publicação;
  a migration atual já está aplicada no banco de teste.
- Relatórios contábeis de despesas fora dos valores dos pedidos.
- O painel separado do motoboy continua disponível para operações com contas
  Courier; para operação individual, a conta Admin atualiza as etapas sem
  atribuição ou login separado.
