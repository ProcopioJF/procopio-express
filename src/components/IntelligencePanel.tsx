import { useMemo, useState } from "react"

import type { ReactNode } from "react"

import {
  ArrowUpRight,
  BrainCircuit,
  Building2,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react"

import type { ApiCompany, ApiDashboardSummary, ApiOrder } from "../services/api"

type Message = { role: "assistant" | "user"; text: string }

const COMPANY_QUESTIONS = [
  "Quem mais solicitou entregas este mês?",

  "Onde posso reduzir custos?",

  "Qual é o melhor horário para pedir?",

  "Como será o volume do próximo mês?",
]

const ADMIN_QUESTIONS = [
  "Qual empresa mais pediu este mês?",

  "Qual empresa tem mais entregas?",

  "Quais contas precisam de atenção?",

  "Qual é o diagnóstico geral da operação?",
]

function money(value: number) {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function IntelligencePanel({
  orders,

  summary,

  companyName,

  companies = [],

  audience = "company",
}: {
  orders: ApiOrder[]

  summary: ApiDashboardSummary

  companyName: string

  companies?: ApiCompany[]

  audience?: "company" | "admin"
}) {
  const [question, setQuestion] = useState("")

  const [messages, setMessages] = useState<Message[]>([])

  const [answering, setAnswering] = useState(false)

  const company = audience === "company"

  const suggestions = company ? COMPANY_QUESTIONS : ADMIN_QUESTIONS

  const analytics = useMemo(() => {
    const requesters = new Map<string, number>()

    const neighborhoods = new Map<string, number>()

    const hours = new Map<number, number>()

    const orderCompanies = new Map<string, number>()

    orders.forEach((order) => {
      const requester =
        order.requesterName?.trim() || order.recipientName?.trim()

      if (requester)
        requesters.set(requester, (requesters.get(requester) ?? 0) + 1)

      const neighborhood = order.deliveryNeighborhood?.trim()

      if (neighborhood)
        neighborhoods.set(
          neighborhood,
          (neighborhoods.get(neighborhood) ?? 0) + 1,
        )

      const created = new Date(order.createdAt)

      if (!Number.isNaN(created.getTime()))
        hours.set(created.getHours(), (hours.get(created.getHours()) ?? 0) + 1)

      if (order.companyId)
        orderCompanies.set(
          order.companyId,
          (orderCompanies.get(order.companyId) ?? 0) + 1,
        )
    })

    const topRequester = [...requesters.entries()].sort(
      (a, b) => b[1] - a[1],
    )[0]

    const topNeighborhood = [...neighborhoods.entries()].sort(
      (a, b) => b[1] - a[1],
    )[0]

    const peakHour = [...hours.entries()].sort((a, b) => b[1] - a[1])[0]

    const topCompany = [...companies]

      .sort((a, b) => b._count.orders - a._count.orders)[0]

    const companyShare =
      topCompany && summary.allTime.orders
        ? Math.round((topCompany._count.orders / summary.allTime.orders) * 100)
        : 0

    return { topRequester, topNeighborhood, peakHour, topCompany, companyShare }
  }, [companies, orders, summary.allTime.orders])

  const answerFor = (prompt: string) => {
    const normalized = prompt.toLocaleLowerCase("pt-BR")

    if (
      company &&
      (normalized.includes("quem") || normalized.includes("solicit"))
    ) {
      return analytics.topRequester
        ? `${analytics.topRequester[0]} aparece com mais solicitações entre os ${orders.length} registros recentes analisados (${analytics.topRequester[1]} pedidos). O indicador de volume total da empresa é ${summary.allTime.orders.toLocaleString("pt-BR")} entregas.`
        : "Ainda não há solicitantes suficientes nos registros carregados para apontar uma liderança."
    }

    if (
      normalized.includes("bairro") ||
      normalized.includes("reduzir custo") ||
      normalized.includes("região")
    ) {
      const average = summary.allTime.average

      return analytics.topNeighborhood
        ? `O bairro ${analytics.topNeighborhood[0]} concentra mais entregas nos registros recentes (${analytics.topNeighborhood[1]} de ${orders.length}). O custo médio histórico por pedido é ${money(average)}. Compare os valores por rota cadastrados antes de alterar a operação.`
        : "Os endereços dos pedidos recentes ainda não permitem comparar bairros. O custo médio registrado é " +
            money(average) +
            "."
    }

    if (normalized.includes("horário") || normalized.includes("hora")) {
      return analytics.peakHour
        ? `A maior concentração nos registros disponíveis ocorreu às ${String(analytics.peakHour[0]).padStart(2, "0")}h (${analytics.peakHour[1]} pedidos). O conjunto considera os ${orders.length} pedidos carregados, não uma previsão de demanda.`
        : "Ainda não há horários de pedido suficientes para identificar um pico com confiança."
    }

    if (
      company &&
      (normalized.includes("próximo mês") || normalized.includes("previs"))
    ) {
      return "A projeção não está disponível com segurança: o painel recebe os registros recentes e os totais consolidados, mas não dispõe de uma série histórica mensal completa para estimar o próximo mês."
    }

    if (
      !company &&
      (normalized.includes("mais pediu") ||
        normalized.includes("mais entrega") ||
        normalized.includes("volume"))
    ) {
      return analytics.topCompany
        ? `${analytics.topCompany.name} tem o maior volume acumulado entre as empresas cadastradas: ${analytics.topCompany._count.orders.toLocaleString("pt-BR")} pedidos (${analytics.companyShare}% do total consolidado).`
        : "Ainda não há empresas com pedidos registrados para comparar."
    }

    if (
      !company &&
      (normalized.includes("atenção") || normalized.includes("risco"))
    ) {
      const cancelled = orders.filter(
        (order) => order.status === "CANCELLED",
      ).length

      return `Nos ${orders.length} pedidos recentes, ${cancelled} estão cancelados. Para avaliar risco comercial por conta, compare este indicador com a evolução mensal de cada empresa; essa série histórica não está disponível no painel atual.`
    }

    return `Foram registrados ${summary.allTime.orders.toLocaleString("pt-BR")} pedidos no total, com valor médio de ${money(summary.allTime.average)}. Esta análise usa os indicadores consolidados e os ${orders.length} pedidos recentes carregados no painel.`
  }

  const submit = (value = question) => {
    const prompt = value.trim()

    if (!prompt || answering) return

    setQuestion("")

    setMessages((current) => [...current, { role: "user", text: prompt }])

    setAnswering(true)

    window.setTimeout(() => {
      setMessages((current) => [
        ...current,
        { role: "assistant", text: answerFor(prompt) },
      ])

      setAnswering(false)
    }, 350)
  }

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0c225a] via-[#102e68] to-[#173b7b] p-6 text-white shadow-[0_12px_35px_rgba(12,34,90,0.14)]">
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f47b20] text-white">
                <BrainCircuit size={21} />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-extrabold">
                    Procópio Intelligence
                  </h2>
                  <span className="rounded-full border border-white/20 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-white/75">
                    Dados atualizados
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-white/65">
                  {company
                    ? "Inteligência exclusiva da sua empresa"
                    : "Diagnóstico global da operação"}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-white/80">
              {company
                ? "Pergunte sobre suas entregas, custos e padrões. As respostas usam somente os dados vinculados ao seu cadastro."
                : "Pergunte sobre qualquer empresa, compare desempenho e receba uma direção baseada no histórico consolidado da plataforma."}
            </p>
          </div>
          <div className="flex max-w-xs items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-xs text-white/80">
            {company ? <ShieldCheck size={16} /> : <Building2 size={16} />}
            <span>
              <b className="block text-[9px] uppercase tracking-wider text-white/55">
                Escopo dos dados
              </b>
              {company
                ? `${companyName} apenas`
                : "Todas as empresas cadastradas"}
            </span>
          </div>
        </div>
        <Sparkles className="absolute -bottom-8 -right-4 h-36 w-36 text-white/[0.04]" />
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          label="Base analisada"
          value={summary.allTime.orders.toLocaleString("pt-BR")}
          detail={`${orders.length} pedidos recentes disponíveis`}
          icon={<BrainCircuit size={16} />}
        />
        <SummaryCard
          label={company ? "Maior concentração" : "Maior volume"}
          value={
            company
              ? (analytics.topNeighborhood?.[0] ?? "—")
              : (analytics.topCompany?.name ?? "—")
          }
          detail={
            company
              ? analytics.topNeighborhood
                ? `${analytics.topNeighborhood[1]} pedidos nos registros recentes`
                : "Sem dados de bairro"
              : analytics.topCompany
                ? `${analytics.topCompany._count.orders.toLocaleString("pt-BR")} pedidos`
                : "Sem pedidos empresariais"
          }
          icon={<Building2 size={16} />}
        />
        <SummaryCard
          label="Ticket médio"
          value={money(summary.allTime.average)}
          detail="Por entrega registrada"
          icon={<ArrowUpRight size={16} />}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <article className="flex min-h-[460px] min-w-0 flex-col overflow-hidden rounded-2xl border border-[#e8edf4] bg-white shadow-[0_3px_14px_rgba(15,35,65,0.04)]">
          <header className="flex items-center justify-between border-b border-[#eef2f7] px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#fff3e9] text-[#f47b20]">
                <Sparkles size={16} />
              </span>
              <div>
                <h3 className="text-sm font-bold text-[#102b55]">
                  Converse com seus dados
                </h3>
                <p className="text-[10px] text-[#94a3b8]">
                  Análise contextual da operação
                </p>
              </div>
            </div>
            <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600">
              <i className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Pronto para analisar
            </span>
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            <MessageBubble role="assistant">
              {company
                ? "Seus dados estão prontos. Posso transformar o histórico da sua empresa em respostas e próximos passos objetivos."
                : "Visão global pronta. Posso comparar as empresas e resumir volume, concentração de pedidos e pontos que merecem atenção."}
            </MessageBubble>
            {messages.map((message, index) => (
              <MessageBubble
                key={`${message.role}-${index}`}
                role={message.role}
              >
                {message.text}
              </MessageBubble>
            ))}
            {answering && (
              <MessageBubble role="assistant">
                <span className="animate-pulse">Analisando os registros…</span>
              </MessageBubble>
            )}
          </div>

          <form
            className="m-4 flex items-center gap-2 rounded-xl border border-[#e2e8f0] bg-[#fbfcfe] p-2 pl-4 focus-within:border-[#f47b20]"
            onSubmit={(event) => {
              event.preventDefault()
              submit()
            }}
          >
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={
                company
                  ? "Ex.: onde posso reduzir custos?"
                  : "Ex.: qual empresa mais pediu este mês?"
              }
              aria-label="Pergunte à Procópio Intelligence"
              className="min-w-0 flex-1 border-0 bg-transparent text-sm text-[#102b55] outline-none placeholder:text-[#aab5c3]"
            />
            <button
              type="submit"
              disabled={!question.trim() || answering}
              aria-label="Enviar pergunta"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#f47b20] text-white transition hover:bg-[#df6d17] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send size={15} />
            </button>
          </form>
          <p className="px-5 pb-4 text-[10px] text-[#94a3b8]">
            Análise demonstrativa baseada nos registros do painel; valide
            decisões operacionais antes de executá-las.
          </p>
        </article>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-[#e8edf4] bg-white p-5 shadow-[0_3px_14px_rgba(15,35,65,0.04)]">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles size={16} className="text-[#f47b20]" />
              <h3 className="text-sm font-bold text-[#102b55]">
                Perguntas sugeridas
              </h3>
            </div>
            <div className="space-y-2">
              {suggestions.map((item) => (
                <button
                  key={item}
                  onClick={() => submit(item)}
                  disabled={answering}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#edf1f6] px-3 py-3 text-left text-xs font-medium text-[#52647c] transition hover:border-[#f47b20]/40 hover:bg-[#fffaf6] hover:text-[#102b55] disabled:opacity-50"
                >
                  {item}
                  <ArrowUpRight size={13} className="shrink-0 text-[#aab5c3]" />
                </button>
              ))}
            </div>
          </section>
          <section className="rounded-2xl border border-[#f6d7bf] bg-gradient-to-br from-[#fff8f1] to-white p-5">
            <div className="flex items-center gap-2 text-[#c76216]">
              <Sparkles size={15} />
              <h3 className="text-xs font-bold">Direção prioritária</h3>
            </div>
            <p className="mt-3 text-xs leading-5 text-[#6e5b4d]">
              {company
                ? analytics.topNeighborhood
                  ? `Acompanhe a concentração de pedidos em ${analytics.topNeighborhood[0]} e compare o custo médio das rotas desse bairro com o restante da operação.`
                  : "Registre mais pedidos com endereços completos para identificar padrões de demanda e custo por região."
                : analytics.topCompany
                  ? `Revise o desempenho de ${analytics.topCompany.name}, empresa com maior volume acumulado, e compare seus indicadores com os registros recentes.`
                  : "Cadastre empresas e registre pedidos para liberar comparações entre contas."}
            </p>
          </section>
        </aside>
      </section>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string
  value: string
  detail: string
  icon: ReactNode
}) {
  return (
    <article className="min-w-0 rounded-2xl border border-[#e8edf4] bg-white p-4 shadow-[0_3px_14px_rgba(15,35,65,0.04)]">
      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-[#94a3b8]">
        {label}
        <span className="text-[#f47b20]">{icon}</span>
      </div>
      <strong className="mt-2 block truncate text-base font-extrabold text-[#102b55]">
        {value}
      </strong>
      <span className="mt-1 block truncate text-[10px] text-[#94a3b8]">
        {detail}
      </span>
    </article>
  )
}

function MessageBubble({
  role,
  children,
}: {
  role: "assistant" | "user"
  children: ReactNode
}) {
  return (
    <div
      className={`max-w-[88%] rounded-2xl p-3 text-xs leading-5 ${
        role === "user"
          ? "ml-auto bg-[#0c225a] text-white"
          : "border border-[#edf1f6] bg-[#f9fbfd] text-[#52647c]"
      }`}
    >
      {role === "assistant" && (
        <b className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-[#f47b20]">
          Intelligence
        </b>
      )}
      {children}
    </div>
  )
}
