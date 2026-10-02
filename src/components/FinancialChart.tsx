import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

const money = (value: number) =>
  `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

export default function FinancialChart({
  months,
}: {
  months: Array<{ month: string; label: string; income: number; expenses: number }>
}) {
  return (
    <article className="rounded-2xl border border-[#e8edf4] bg-white p-5">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-[#102b55]">Receitas e despesas por mês</h3>
        <p className="mt-1 text-xs text-[#8795a8]">Lançamentos efetivos do ledger · fuso horário de São Paulo</p>
      </div>
      <div className="h-64 min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={months} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid stroke="#edf1f6" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value: number) => money(value)} width={76} />
            <Tooltip formatter={(value) => money(Number(value))} />
            <Legend />
            <Bar dataKey="income" name="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  )
}
