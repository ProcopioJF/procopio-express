import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import { FileUp, Plus, RefreshCw, Save, Search, X } from "lucide-react"
import {
  createAdminPriceTable,
  createPriceTableOrigin,
  getAdminPriceTables,
  importPriceTableDestinations,
  savePriceTableDestination,
  setPriceTableDestinationActive,
  updateAdminPriceTable,
  updatePriceTableOrigin,
  type ApiPriceTable,
  type ApiPriceTableDestination,
  type ApiPricingType,
} from "../services/api"
import { parsePriceTableCsv, parsePriceTableXlsx } from "../services/pricing"

type DestinationForm = {
  destinationName: string
  pricingType: ApiPricingType
  fixedPrice: string
  minimumPrice: string
  maximumPrice: string
  perKmRate: string
}

const emptyDestination: DestinationForm = {
  destinationName: "",
  pricingType: "FIXED",
  fixedPrice: "",
  minimumPrice: "",
  maximumPrice: "",
  perKmRate: "",
}

const typeLabel: Record<ApiPricingType, string> = {
  FIXED: "Preço fixo",
  RANGE: "Faixa",
  PER_KM: "Por KM",
  QUOTE: "Sob consulta",
}

function formatAmount(value: number | string | null | undefined) {
  return value === null || value === undefined ? "—" : `R$ ${Number(value).toFixed(2).replace(".", ",")}`
}

function formatDestination(destination: ApiPriceTableDestination) {
  if (destination.pricingType === "FIXED") return formatAmount(destination.fixedPrice)
  if (destination.pricingType === "RANGE") return `${formatAmount(destination.minimumPrice)} a ${formatAmount(destination.maximumPrice)}`
  if (destination.pricingType === "PER_KM") return destination.perKmRate == null ? "Consultar valor" : `${formatAmount(destination.perKmRate)}/km`
  return "Consultar valor"
}

function formFromDestination(destination: ApiPriceTableDestination): DestinationForm {
  return {
    destinationName: destination.destinationName,
    pricingType: destination.pricingType,
    fixedPrice: destination.fixedPrice === null ? "" : String(destination.fixedPrice),
    minimumPrice: destination.minimumPrice === null ? "" : String(destination.minimumPrice),
    maximumPrice: destination.maximumPrice === null ? "" : String(destination.maximumPrice),
    perKmRate: destination.perKmRate == null ? "" : String(destination.perKmRate),
  }
}

export default function AdminPricingPanel({ token }: { token: string }) {
  const [tables, setTables] = useState<ApiPriceTable[]>([])
  const [selectedTableId, setSelectedTableId] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [search, setSearch] = useState("")
  const [originName, setOriginName] = useState("")
  const [tableName, setTableName] = useState("")
  const [tableDescription, setTableDescription] = useState("")
  const [showTableForm, setShowTableForm] = useState(false)
  const [editingDestinationId, setEditingDestinationId] = useState<string | null>(null)
  const [destinationForm, setDestinationForm] = useState<DestinationForm>(emptyDestination)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const result = await getAdminPriceTables(token)
      setTables(result.tables)
      setSelectedTableId((current) => current && result.tables.some((table) => table.id === current)
        ? current
        : result.tables[0]?.id ?? "")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar as tabelas de preços.")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { void refresh() }, [refresh])

  const selectedTable = tables.find((table) => table.id === selectedTableId) ?? null
  const filteredDestinations = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("pt-BR")
    return (selectedTable?.destinations ?? []).filter((destination) =>
      !needle || destination.destinationName.toLocaleLowerCase("pt-BR").includes(needle),
    )
  }, [selectedTable, search])

  const runAction = async (successMessage: string, action: () => Promise<string | void>) => {
    setBusy(true)
    setError("")
    setNotice("")
    try {
      const actionMessage = await action()
      await refresh()
      setNotice(actionMessage ?? successMessage)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar as alterações.")
    } finally {
      setBusy(false)
    }
  }

  const submitTable = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!tableName.trim()) return
    await runAction("Tabela criada.", async () => {
      const result = await createAdminPriceTable(token, { name: tableName.trim(), description: tableDescription.trim() || undefined })
      setTableName("")
      setTableDescription("")
      setShowTableForm(false)
      setSelectedTableId(result.table.id)
    })
  }

  const addOrigin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedTable || !originName.trim()) return
    await runAction("Origem adicionada à tabela.", async () => {
      await createPriceTableOrigin(token, selectedTable.id, originName.trim())
      setOriginName("")
    })
  }

  const saveDestination = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedTable || !destinationForm.destinationName.trim()) return
    const input = {
      destinationName: destinationForm.destinationName.trim(),
      pricingType: destinationForm.pricingType,
      ...(destinationForm.pricingType === "FIXED" ? { fixedPrice: Number(destinationForm.fixedPrice) } : {}),
      ...(destinationForm.pricingType === "RANGE" ? {
        minimumPrice: Number(destinationForm.minimumPrice),
        maximumPrice: Number(destinationForm.maximumPrice),
      } : {}),
      ...(destinationForm.pricingType === "PER_KM" && destinationForm.perKmRate.trim() ? { perKmRate: Number(destinationForm.perKmRate) } : {}),
    }
    await runAction(editingDestinationId ? "Destino atualizado." : "Destino adicionado.", async () => {
      await savePriceTableDestination(token, selectedTable.id, input, editingDestinationId ?? undefined)
      setDestinationForm(emptyDestination)
      setEditingDestinationId(null)
    })
  }

  const importFile = async (file: File) => {
    await runAction("Importação concluída; destinos existentes foram atualizados sem duplicação.", async () => {
      if (!selectedTable) throw new Error("Selecione uma tabela antes de importar.")
      const filename = file.name.toLocaleLowerCase("pt-BR")
      const destinations = filename.endsWith(".xlsx")
        ? await parsePriceTableXlsx(file)
        : filename.endsWith(".csv")
          ? parsePriceTableCsv(await file.text())
          : null
      if (!destinations) throw new Error("Selecione um arquivo CSV ou XLSX.")
      const result = await importPriceTableDestinations(token, selectedTable.id, destinations)
      return `${result.imported} destinos importados ou atualizados.`
    })
  }

  const toggleOrigin = async (table: ApiPriceTable, originId: string, active: boolean) => {
    await runAction(active ? "Origem reativada." : "Origem desativada.", async () => {
      await updatePriceTableOrigin(token, table.id, originId, { active })
    })
  }

  const toggleDestination = async (table: ApiPriceTable, destinationId: string, active: boolean) => {
    await runAction(active ? "Destino reativado." : "Destino desativado.", async () => {
      await setPriceTableDestinationActive(token, table.id, destinationId, active)
    })
  }

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-[#102b55]">Tabelas de preços</h3>
          <p className="mt-1 text-xs text-[#64748b]">A tarifa é escolhida pela origem da coleta e pelo bairro de destino.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void refresh()} disabled={loading || busy} className="rounded-xl border border-[#e2e8f0] px-3 py-2 text-xs font-bold text-[#334155] disabled:opacity-50">
            <RefreshCw size={13} className="mr-1.5 inline" /> Atualizar
          </button>
          <button onClick={() => setShowTableForm((value) => !value)} className="rounded-xl bg-[#f47b20] px-3 py-2 text-xs font-bold text-white">
            <Plus size={13} className="mr-1.5 inline" /> Nova tabela
          </button>
        </div>
      </header>

      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p>}

      {showTableForm && (
        <form onSubmit={(event) => void submitTable(event)} className="grid gap-3 rounded-2xl border border-[#e8edf4] bg-white p-4 md:grid-cols-[1fr_2fr_auto]">
          <input value={tableName} onChange={(event) => setTableName(event.target.value)} required placeholder="Nome da tabela" className="rounded-xl border border-[#e2e8f0] px-3 py-2 text-sm" />
          <input value={tableDescription} onChange={(event) => setTableDescription(event.target.value)} placeholder="Descrição (opcional)" className="rounded-xl border border-[#e2e8f0] px-3 py-2 text-sm" />
          <button disabled={busy} className="rounded-xl bg-[#102b55] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Save size={14} className="mr-1.5 inline" /> Criar tabela</button>
        </form>
      )}

      {loading ? <p className="p-8 text-center text-sm text-[#64748b]">Carregando tabelas...</p> : tables.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#cbd5e1] p-8 text-center text-sm text-[#64748b]">Nenhuma tabela cadastrada. Execute o seed oficial ou crie uma tabela para começar.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#e8edf4] bg-white p-4">
            <label className="min-w-64 flex-1 text-xs font-bold text-[#64748b]">
              Tabela selecionada
              <select value={selectedTableId} onChange={(event) => { setSelectedTableId(event.target.value); setEditingDestinationId(null); setDestinationForm(emptyDestination) }} className="mt-1 w-full rounded-xl border border-[#e2e8f0] px-3 py-2 text-sm text-[#102b55]">
                {tables.map((table) => <option key={table.id} value={table.id}>{table.name}{table.active ? "" : " (inativa)"}</option>)}
              </select>
            </label>
            {selectedTable && (
              <button disabled={busy} onClick={() => void runAction(selectedTable.active ? "Tabela desativada." : "Tabela ativada.", async () => {
                await updateAdminPriceTable(token, selectedTable.id, { active: !selectedTable.active })
              })} className={`mt-4 rounded-full px-3 py-2 text-xs font-bold ${selectedTable.active ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                {selectedTable.active ? "Ativa — desativar" : "Inativa — ativar"}
              </button>
            )}
            <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#e2e8f0] px-3 py-2 text-xs font-bold text-[#334155] hover:bg-[#f8fafc]">
              <FileUp size={14} /> Importar CSV/XLSX
              <input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" disabled={busy || !selectedTable} onChange={(event) => {
                const file = event.currentTarget.files?.[0]
                event.currentTarget.value = ""
                if (file) void importFile(file)
              }} />
            </label>
          </div>

          {selectedTable && (
            <>
              <div className="rounded-2xl border border-[#e8edf4] bg-white p-4">
                <h4 className="text-sm font-bold text-[#102b55]">Origens associadas</h4>
                <form onSubmit={(event) => void addOrigin(event)} className="mt-3 flex flex-wrap gap-2">
                  <input value={originName} onChange={(event) => setOriginName(event.target.value)} placeholder="Nova origem" className="min-w-56 flex-1 rounded-xl border border-[#e2e8f0] px-3 py-2 text-sm" />
                  <button disabled={busy || !originName.trim()} className="rounded-xl bg-[#102b55] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><Plus size={13} className="mr-1 inline" /> Adicionar origem</button>
                </form>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedTable.origins.map((origin) => (
                    <button key={origin.id} disabled={busy} onClick={() => void toggleOrigin(selectedTable, origin.id, !origin.active)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${origin.active ? "bg-blue-50 text-[#1d4ed8]" : "bg-slate-100 text-slate-500 line-through"}`}>
                      {origin.originName} · {origin.active ? "ativa" : "inativa"}
                    </button>
                  ))}
                  {selectedTable.origins.length === 0 && <span className="text-xs text-[#94a3b8]">Nenhuma origem associada.</span>}
                </div>
                <p className="mt-2 text-[11px] text-[#94a3b8]">Clique em uma origem para ativar ou desativar a associação.</p>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
                <form onSubmit={(event) => void saveDestination(event)} className="h-fit space-y-3 rounded-2xl border border-[#e8edf4] bg-white p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-[#102b55]">{editingDestinationId ? "Editar destino" : "Adicionar destino"}</h4>
                    {editingDestinationId && <button type="button" onClick={() => { setEditingDestinationId(null); setDestinationForm(emptyDestination) }} className="text-xs font-semibold text-[#64748b]"><X size={14} className="inline" /> Cancelar edição</button>}
                  </div>
                  <input value={destinationForm.destinationName} onChange={(event) => setDestinationForm((form) => ({ ...form, destinationName: event.target.value }))} required maxLength={100} placeholder="Nome do bairro de destino" className="w-full rounded-xl border border-[#e2e8f0] px-3 py-2 text-sm" />
                  <select value={destinationForm.pricingType} onChange={(event) => setDestinationForm((form) => ({ ...form, pricingType: event.target.value as ApiPricingType }))} className="w-full rounded-xl border border-[#e2e8f0] px-3 py-2 text-sm">
                    {Object.entries(typeLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  {destinationForm.pricingType === "FIXED" && <input type="number" min="0.01" step="0.01" value={destinationForm.fixedPrice} onChange={(event) => setDestinationForm((form) => ({ ...form, fixedPrice: event.target.value }))} required placeholder="Preço em R$" className="w-full rounded-xl border border-[#e2e8f0] px-3 py-2 text-sm" />}
                  {destinationForm.pricingType === "RANGE" && (
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" min="0.01" step="0.01" value={destinationForm.minimumPrice} onChange={(event) => setDestinationForm((form) => ({ ...form, minimumPrice: event.target.value }))} required placeholder="Mínimo (R$)" className="w-full rounded-xl border border-[#e2e8f0] px-3 py-2 text-sm" />
                      <input type="number" min="0.01" step="0.01" value={destinationForm.maximumPrice} onChange={(event) => setDestinationForm((form) => ({ ...form, maximumPrice: event.target.value }))} required placeholder="Máximo (R$)" className="w-full rounded-xl border border-[#e2e8f0] px-3 py-2 text-sm" />
                    </div>
                  )}
                  {destinationForm.pricingType === "PER_KM" && (
                    <>
                      <input type="number" min="0.01" step="0.01" value={destinationForm.perKmRate} onChange={(event) => setDestinationForm((form) => ({ ...form, perKmRate: event.target.value }))} placeholder="Preço por KM em R$ (opcional)" className="w-full rounded-xl border border-[#e2e8f0] px-3 py-2 text-sm" />
                      <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">Informe o valor por KM e configure o provedor de rotas no backend. Sem tarifa ou rota disponível, o pedido será “Consultar valor”.</p>
                    </>
                  )}
                  {destinationForm.pricingType === "QUOTE" && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">O pedido será registrado como valor sob consulta, sem gravar preço zero.</p>}
                  <button disabled={busy} className="w-full rounded-xl bg-[#f47b20] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Save size={14} className="mr-1.5 inline" /> {editingDestinationId ? "Salvar destino" : "Adicionar destino"}</button>
                </form>

                <div className="overflow-hidden rounded-2xl border border-[#e8edf4] bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eef2f7] p-4">
                    <div><h4 className="text-sm font-bold text-[#102b55]">Destinos</h4><p className="mt-1 text-[11px] text-[#94a3b8]">{selectedTable.destinations.filter((destination) => destination.active).length} ativos de {selectedTable.destinations.length}</p></div>
                    <label className="relative w-full max-w-64">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
                      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar destino" className="w-full rounded-xl border border-[#e2e8f0] py-2 pl-9 pr-3 text-xs" />
                    </label>
                  </div>
                  <div className="max-h-[560px] overflow-auto">
                    <table className="w-full min-w-[520px] text-left text-xs">
                      <thead className="sticky top-0 bg-[#f8fafc] text-[10px] uppercase tracking-wide text-[#7b8ba1]">
                        <tr><th className="px-4 py-3">Destino</th><th className="px-4 py-3">Tipo / valor</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Ações</th></tr>
                      </thead>
                      <tbody>
                        {filteredDestinations.map((destination) => (
                          <tr key={destination.id} className="border-t border-[#f1f4f8]">
                            <td className="px-4 py-3 font-semibold text-[#334155]">{destination.destinationName}</td>
                            <td className="px-4 py-3"><span className="font-semibold text-[#102b55]">{formatDestination(destination)}</span><span className="mt-1 block text-[10px] text-[#94a3b8]">{typeLabel[destination.pricingType]}</span></td>
                            <td className="px-4 py-3">{destination.active ? "Ativo" : "Inativo"}</td>
                            <td className="space-x-3 px-4 py-3 whitespace-nowrap">
                              <button disabled={busy} onClick={() => { setEditingDestinationId(destination.id); setDestinationForm(formFromDestination(destination)) }} className="font-bold text-blue-700">Editar</button>
                              <button disabled={busy} onClick={() => void toggleDestination(selectedTable, destination.id, !destination.active)} className="font-bold text-[#64748b]">{destination.active ? "Desativar" : "Ativar"}</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredDestinations.length === 0 && <p className="p-8 text-center text-sm text-[#64748b]">Nenhum destino encontrado.</p>}
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </section>
  )
}
