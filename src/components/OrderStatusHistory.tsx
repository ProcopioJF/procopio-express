import { ORDER_STATUS_LABELS, type ApiOrder } from "../services/api"

export default function OrderStatusHistory({
  history,
}: {
  history?: ApiOrder["history"]
}) {
  const events = history ?? []

  return (
    <details className="text-[10px] text-[#64748b]">
      <summary className="cursor-pointer font-semibold text-[#52657f]">
        Histórico de status ({events.length})
      </summary>
      {events.length > 0 ? (
        <ol className="mt-2 space-y-2 border-l border-[#e2e8f0] pl-3">
          {events.map((event) => (
            <li key={event.id}>
              <strong className="text-[#334155]">
                {ORDER_STATUS_LABELS[event.status]}
              </strong>
              <time className="ml-1">
                {new Date(event.createdAt).toLocaleString("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                })}
              </time>
              {event.note && <p className="mt-0.5">{event.note}</p>}
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2">Nenhum evento de status registrado.</p>
      )}
    </details>
  )
}
