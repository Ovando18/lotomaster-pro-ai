# LotoMaster Pro AI

Gerador inteligente para as Loterias CAIXA: **fechamentos combinatórios com garantia verificada**, filtros estatísticos eliminatórios, conferência automática com ROI e retroalimentação de pesos. Funciona no celular (PWA instalável) e no PC (dashboard).

Modalidades: **Lotofácil · Mega-Sena · Quina · +Milionária · Lotomania · Dia de Sorte**

> ⚠️ **Jogo responsável.** Sorteios são aleatórios e independentes. Filtros e pesos organizam *quais* combinações você joga, mas não aumentam a chance de uma combinação sair. A garantia de um fechamento é matemática e **condicional**: ela vale se as dezenas sorteadas estiverem dentro do grupo escolhido. +18.

---

## Funcionalidades

| Área | O que faz |
|---|---|
| **Gerador** | Concurso alvo, quantidade, estratégia (Equilibrado, Manual + IA, Surpresinha Otimizada, Ciclo + Moldura, Fechamento), dezenas fixas/excluídas tocando no volante, apostas com mais dezenas, trevos extras (+Milionária), Aposta Espelho (Lotomania) |
| **Fechamentos** | Covering designs C(v,k,t,m) gerados por algoritmo guloso com reinícios e **verificação exaustiva** de todos os cenários. Ex.: Lotofácil 18 dezenas com garantia de 14 pontos em ~36 jogos (de 816), Mega 10 dezenas com garantia de quadra em 3 jogos, Quina 10 dezenas com garantia de terno em 2 jogos |
| **Filtros** | Pares/ímpares, soma na faixa central da Gaussiana, linhas/colunas do volante, sequências, repetidas do último concurso, primos, moldura/miolo. Todos editáveis por modalidade |
| **Apostas & Refinamento** | Salva jogos com 1 toque, registra apostas feitas, busca o resultado oficial (ou entrada manual), confere desdobrando apostas múltiplas, calcula ROI e mostra o **Diagnóstico** (grupos quentes/atrasadas/ciclo × esperado, filtros que o resultado passou) com ajuste de pesos |
| **Estatísticas** | Mapa de calor (frequência 10/20/50/100, atraso, ciclo), mais sorteadas, atrasadas, faltantes do ciclo, último resultado com rateio, probabilidades hipergeométricas reais |
| **Exportação** | CSV (Excel), TXT, **PDF estilo volante**, WhatsApp, copiar jogo |
| **Sincronização** | Supabase gratuito (PC ↔ celular por código secreto) + backup/restauração em arquivo JSON |

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · componentes estilo shadcn/ui · Lucide · jsPDF · Supabase · Vitest

```
src/
├── lib/
│   ├── lotteries.ts        # matrizes oficiais, preços, faixas de prêmio, filtros padrão
│   ├── lotteryEngine.ts    # MOTOR: combinatória, fechamentos, filtros, stats, geração, conferência, ROI, diagnóstico
│   ├── normalize.ts        # normaliza respostas das APIs (loteriascaixa-api, CAIXA, lotogestao)
│   ├── server/sources.ts   # busca com fallback em 3 fontes + cache em memória
│   ├── store.tsx           # estado local (localStorage) + merge para sync
│   ├── sync.ts             # Supabase (RPC protegida por código)
│   ├── export.ts           # CSV / TXT / PDF volante / WhatsApp
│   └── __tests__/          # 47 testes unitários
├── app/api/history/[lottery]  # GET histórico (até 1000 concursos)
├── app/api/results/[lottery]  # GET ?contest=N (ou último)
├── components/             # painéis Gerador, Apostas, Estatísticas, Ajustes
└── hooks/use-lottery-data.ts
supabase/schema.sql         # tabela + funções de sincronização
```

## Rodando localmente

Pré-requisito: Node.js 20 ou superior.

```bash
npm install
```

```bash
npm run dev
```

Acesse http://localhost:3000. Para rodar os testes:

```bash
npm test
```

---

## 🚀 Publicar de graça (GitHub + Vercel)

### 1. Subir o código para o GitHub

1. Crie uma conta em https://github.com, se ainda não tiver.
2. Clique em **New repository**, use o nome `lotomaster-pro-ai`, deixe **Private** e **não** marque "Add README". Depois clique em **Create repository**.
3. Na pasta do projeto, rode:

```bash
git init
```

```bash
git add .
```

```bash
git commit -m "LotoMaster Pro AI"
```

```bash
git branch -M main
```

```bash
git remote add origin https://github.com/SEU-USUARIO/lotomaster-pro-ai.git
```

```bash
git push -u origin main
```

### 2. (Opcional) Criar o banco gratuito no Supabase, para sincronizar PC ↔ celular

1. Crie a conta em https://supabase.com e clique em **New project** (plano Free; região *South America (São Paulo)*).
2. Abra **SQL Editor → New query**, cole todo o conteúdo de `supabase/schema.sql` e clique em **Run**.
3. Em **Project Settings → API**, copie a **Project URL** e a chave **anon public**.

> Sem o Supabase o app funciona normalmente: as apostas ficam salvas no aparelho e você pode usar **Ajustes → Backup/Restaurar**.

### 3. Publicar na Vercel

1. Entre em https://vercel.com com a sua conta do GitHub (plano Hobby, gratuito).
2. Clique em **Add New… → Project**, escolha o repositório `lotomaster-pro-ai` e clique em **Import**.
3. A Vercel detecta Next.js sozinha. Se usou o Supabase, abra **Environment Variables** e adicione:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon public key
4. Clique em **Deploy**. Em cerca de 1 minuto você recebe um link como `https://lotomaster-pro-ai.vercel.app`.
5. A cada `git push` na branch `main`, a Vercel publica a nova versão automaticamente.

### 4. Instalar no celular como app

- **Android (Chrome):** abra o link, toque em ⋮ e depois em **Instalar app** (ou **Adicionar à tela inicial**).
- **iPhone (Safari):** abra o link, toque em **Compartilhar** e depois em **Adicionar à Tela de Início**.

### 5. Sincronizar os dois aparelhos

1. No PC, vá em **Ajustes → Sincronizar**, toque no ícone 🔑 para gerar um código e depois em **Enviar**.
2. No celular, cole o **mesmo código** e toque em **Baixar**.
3. Daí em diante, use **Enviar** depois de registrar apostas e **Baixar** no outro aparelho. As apostas são mescladas pelo horário da última alteração.

> Guarde o código em local seguro: quem tiver o código acessa as apostas sincronizadas.

---

## Fontes de resultados

1. `https://loteriascaixa-api.herokuapp.com/api/{modalidade}` (principal, histórico completo)
2. `https://lotogestao.com.br/v1/{modalidade}` (fallback)
3. `https://servicodados.caixa.gov.br/portaldeloterias/api/{modalidade}` (API oficial; pode bloquear acessos de fora do Brasil)

As URLs podem ser trocadas pelas variáveis `LOTTERY_API_*` (veja `.env.example`). O histórico fica em cache no servidor (10 min), na CDN da Vercel e no aparelho (30 min, funciona offline). Se nenhuma fonte responder, use **Apostas → Resultado manual**.

## Preços e prêmios

Preços de referência do reajuste da CAIXA de julho/2025 (Lotofácil R$ 3,50, Mega-Sena R$ 6,00, Quina R$ 3,00, +Milionária R$ 6,00, Lotomania R$ 3,00, Dia de Sorte R$ 2,50). Os prêmios vêm do rateio oficial do concurso; na Lotofácil, as faixas fixas de 11, 12 e 13 pontos (R$ 7, R$ 14 e R$ 35) são usadas quando o rateio ainda não saiu. Se a CAIXA reajustar, altere `src/lib/lotteries.ts`.
