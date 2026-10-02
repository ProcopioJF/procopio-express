# Procópio Express

Aplicação web mobile-first para solicitar entregas e manter registros gerenciais
de pedidos. O fluxo operacional após o envio acontece pelo WhatsApp; o painel
não acompanha coleta, rota ou conclusão da entrega.

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
5. Publique a API no Render e o frontend na Vercel. Configure
   `DATABASE_URL`, `JWT_SECRET` e `CORS_ORIGINS` no backend; deixe
   `PER_KM_PRICING_ENABLED=false` para manter a consulta manual. Configure
   também `ROUTING_API_URL` somente se decidir ativar o cálculo por KM.
   Configure `VITE_API_URL` com a URL pública da API na Vercel.
6. Após o deploy, confirme migrations aplicadas, health check, login e um
   pedido de ponta a ponta. Configure credenciais e webhook do WhatsApp somente
   se a operação usar envio automático.

Validação:

```powershell
npm run backend:typecheck
npm run backend:build
npm run build
```

## Preparação de publicação (Vercel + Render)

`vercel.json` configura o fallback das rotas da aplicação de página única. Na
Vercel, conecte o repositório, use a raiz do projeto e configure a variável
`VITE_API_URL` como `https://<servico-render>.onrender.com/api/v1` nos ambientes
de produção e preview desejados.

`render.yaml` descreve a API, o health check e a execução das migrations. Ao
criar o serviço Render, informe `DATABASE_URL` (conexão Supabase com SSL),
confirme a geração de `JWT_SECRET` e configure `CORS_ORIGINS` com a origem HTTPS
exata da aplicação Vercel, sem barra final. O backend exige origens explícitas
em produção e não aceita o domínio local por padrão.

Esta pasta do frontend Figma ainda não tem repositório Git próprio. O backend e
as migrations foram integrados a partir da pasta original do projeto. O deploy
depende de publicar a versão consolidada em um host Git, conectar o repositório
às duas plataformas, definir os domínios finais e validar a migration/deploy.
As configurações não publicam serviços por si só e não incluem credenciais do
Supabase ou da Meta.

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
   operacional. Não há atualização posterior de status de entrega no painel.
6. Sem WhatsApp Business API configurada, a interface oferece um link com a
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
- Preparação de publicação: a pasta ativa ainda não possui metadados Git. É
  necessário conectá-la ao repositório autorizado. O remoto existente foi
  confirmado vazio; o commit inicial foi criado localmente, mas o push foi
  recusado por falta de permissão no GitHub. Também é necessário definir os
  domínios finais da Vercel/Render. Nenhum deploy foi feito, e a produção segue
  intacta.
- Confirmar/configurar credenciais do WhatsApp Business, webhook público HTTPS
  e CORS no domínio de produção.
- Publicar a versão consolidada em um repositório e conectar os serviços de
  frontend e backend aos domínios definitivos.
- Validar migrations, health check, login e um pedido de ponta a ponta no
  ambiente de produção somente após a aprovação do teste; a migration atual já
  está aplicada no banco de teste.
- Relatórios contábeis de despesas fora dos valores dos pedidos.
- Painel de operação do motoboy; o atendimento acontece pelo WhatsApp.
