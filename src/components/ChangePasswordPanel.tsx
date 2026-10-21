import { useState, type FormEvent } from "react"
import { changePasswordRequest } from "../services/api"

export default function ChangePasswordPanel({ token }: { token: string }) {
  const [expanded, setExpanded] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    setNotice("")

    if (newPassword !== confirmPassword) {
      setError("A confirmação da nova senha não corresponde.")
      return
    }

    setSaving(true)
    try {
      await changePasswordRequest(token, currentPassword, newPassword)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setNotice("Senha atualizada.")
      setExpanded(false)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível atualizar a senha.",
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="max-w-3xl rounded-2xl border border-[#e8edf4] bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-[#102b55]">Segurança da conta</h3>
          <p className="mt-1 text-xs text-[#718096]">
            Altere sua senha informando a senha atual.
          </p>
        </div>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls="change-password-form"
          onClick={() => {
            setExpanded((value) => !value)
            setError("")
          }}
          className="min-h-10 rounded-xl border border-[#e2e8f0] bg-white px-4 text-xs font-bold text-[#52657f] transition hover:border-[#b8dcf2] hover:bg-[#effaff]"
        >
          {expanded ? "Cancelar" : "Alterar senha"}
        </button>
      </div>

      {notice && (
        <p role="status" className="mt-3 text-sm text-emerald-700">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {expanded && (
        <form
          id="change-password-form"
          onSubmit={(event) => void submit(event)}
          className="mt-4 grid gap-3 sm:grid-cols-2"
        >
          <label className="text-xs font-semibold text-[#64748b] sm:col-span-2">
            Senha atual
            <input
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="mt-1 block h-10 w-full rounded-xl border border-[#e2e8f0] bg-white px-3 text-sm font-normal text-[#102b55]"
            />
          </label>
          <label className="text-xs font-semibold text-[#64748b]">
            Nova senha (mínimo 12 caracteres)
            <input
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="mt-1 block h-10 w-full rounded-xl border border-[#e2e8f0] bg-white px-3 text-sm font-normal text-[#102b55]"
            />
          </label>
          <label className="text-xs font-semibold text-[#64748b]">
            Confirmar nova senha
            <input
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="mt-1 block h-10 w-full rounded-xl border border-[#e2e8f0] bg-white px-3 text-sm font-normal text-[#102b55]"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="min-h-11 rounded-xl bg-[#0c225a] px-4 text-sm font-bold text-white disabled:opacity-50 sm:col-span-2 sm:justify-self-start"
          >
            {saving ? "Salvando..." : "Salvar nova senha"}
          </button>
        </form>
      )}
    </section>
  )
}
