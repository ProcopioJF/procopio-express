import { useEffect, useState } from "react"

import type { ReactNode } from "react"

import {
  ArrowUpRight,
  BrainCircuit,
  Building2,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react"

import { askIntelligence, type ApiIntelligenceMetrics } from "../services/api"

type Message = { role: "assistant" | "user"; text: string }

const COMPANY_QUESTIONS = [
  "Quem mais solicitou entregas este mês?",

  "Onde posso reduzir custos?",

  "Qual é o melhor horário para pedir?",

  "Como será o volume do próximo mês?",
]

const ADMIN_QUESTIONS = [
  "Qual empresa mais pediu este mês?",

  "Qual bairro recebe mais pedidos?",

  "Qual bairro tem maior valor médio?",

  "Qual é o diagnóstico geral da operação?",
]

function money(value: number) {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function IntelligencePanel({
  token,
  companyName,
  audience = "company",
}: {
  token: string
  companyName: string
  audience?: "company" | "admin"
}) {
  const [question, setQuestion] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [answering, setAnswering] = useState(false)
  const [metrics, setMetrics] = useState<ApiIntelligenceMetrics | null>(null)
  const company = audience === "company"
  const suggestions = company ? COMPANY_QUESTIONS : ADMIN_QUESTIONS

  useEffect(() => {
    let active = true
    setAnswering(true)
    askIntelligence(token, "resumo geral")
      .then((result) => {
        if (!active) return
        setMetrics(result.metrics)
        setMessages([{ role: "assistant", text: result.answer }])
      })
      .catch((error: unknown) => {
        if (!active) return
        const detail =
          error instanceof Error ? error.message : "Erro desconhecido."
        setMessages([
          {
            role: "assistant",
            text: `Não foi possível consultar os dados do app: ${detail}`,
          },
        ])
      })
      .finally(() => {
        if (active) setAnswering(false)
      })

    return () => {
      active = false
    }
  }, [token])

  const submit = async (value = question) => {
    const prompt = value.trim()
    if (!prompt || answering) return
    setQuestion("")
    setMessages((current) => [...current, { role: "user", text: prompt }])
    setAnswering(true)
    try {
      const result = await askIntelligence(token, prompt)
      setMetrics(result.metrics)
      setMessages((current) => [
        ...current,
        { role: "assistant", text: result.answer },
      ])
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "Erro desconhecido."
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: `Não foi possível consultar os dados do app: ${detail}`,
        },
      ])
    } finally {
      setAnswering(false)
    }
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
                    Análise local
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
                ? "Pergunte sobre pedidos, valores, quilômetros e bairros. A análise consulta todo o histórico da sua empresa no banco do app."
                : "Pergunte sobre pedidos, valores, quilômetros, bairros e empresas usando o histórico consolidado do app."}
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
          value={metrics?.ordersAnalyzed.toLocaleString("pt-BR") ?? "—"}
          detail={
            metrics
              ? `${metrics.ordersWithDistance} com km · ${metrics.ordersWithoutDistance} sem km`
              : "Carregando o histórico do app"
          }
          icon={<BrainCircuit size={16} />}
        />
        <SummaryCard
          label={company ? "Maior concentração" : "Maior volume no mês"}
          value={
            company
              ? (metrics?.topDeliveryNeighborhood?.name ?? "—")
              : (metrics?.topCompanyThisMonth?.name ?? "—")
          }
          detail={
            company
              ? metrics?.topDeliveryNeighborhood
                ? `${metrics.topDeliveryNeighborhood.count} pedidos no histórico`
                : "Sem dados de bairro"
              : metrics?.topCompanyThisMonth
                ? `${metrics.topCompanyThisMonth.count} pedidos neste mês`
                : "Sem pedidos empresariais"
          }
          icon={<Building2 size={16} />}
        />
        <SummaryCard
          label="Preço médio registrado"
          value={
            metrics
              ? metrics.ordersWithRecordedPrice > 0
                ? money(metrics.averageRecordedPrice)
                : "—"
              : "Carregando"
          }
          detail={
            metrics
              ? metrics.ordersWithRecordedPrice > 0
                ? `Entre ${metrics.ordersWithRecordedPrice} pedidos com valor informado`
                : "Sem pedidos com preço registrado"
              : "Valores registrados no banco"
          }
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
              <i
                className={`h-1.5 w-1.5 rounded-full ${answering ? "animate-pulse bg-amber-500" : metrics ? "bg-emerald-500" : "bg-red-500"}`}
              />
              {answering
                ? "Consultando o banco"
                : metrics
                  ? "Análise local ativa"
                  : "Dados indisponíveis"}
            </span>
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.length === 0 && !answering && (
              <MessageBubble role="assistant">
                Aguardando consulta ao banco do aplicativo.
              </MessageBubble>
            )}
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
            Análise determinística local sobre os dados do banco; valores e
            distâncias ausentes não são estimados.
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
              {metrics?.highestAveragePriceNeighborhood
                ? `${metrics.highestAveragePriceNeighborhood.name} tem o maior valor médio registrado (${money(metrics.highestAveragePriceNeighborhood.averagePrice)}). Use a concentração e o volume de pedidos para investigar as rotas; esse valor não representa, sozinho, custo operacional.`
                : company
                  ? "Ainda não há valores e bairros suficientes para comparar rotas. Registre pedidos com preço e endereço para habilitar essa análise."
                  : metrics?.topCompanyThisMonth
                    ? `Revise o volume de ${metrics.topCompanyThisMonth.name}, empresa com mais pedidos registrados neste mês.`
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
