import React, { useEffect, useState } from 'react';
import { SERVICE_CITY, SERVICE_STATE, StructuredAddress, addressComplete, cleanCep, lookupCep } from '../services/address';

type Props = { label: string; value: StructuredAddress; onChange: (value: StructuredAddress) => void; onLocated?: (value: StructuredAddress) => void; };
export function AddressForm({ label, value, onChange, onLocated }: Props) {
  const [cepError, setCepError] = useState('');
  const [loading, setLoading] = useState(false);
  const update = (key: keyof StructuredAddress, next: string) => onChange({ ...value, [key]: next });
  useEffect(() => {
    if (!/^\d{8}$/.test(cleanCep(value.cep))) return;
    let active = true;
    setLoading(true); setCepError('');
    lookupCep(value.cep).then(result => { if (active) { const next = { ...value, ...result, cidade: SERVICE_CITY, estado: SERVICE_STATE }; onChange(next); onLocated?.(next); } })
      .catch(error => { if (active) setCepError(error instanceof Error ? error.message : 'CEP inválido.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [value.cep]);
  const complete = addressComplete(value);
  return <fieldset className="address-form"><legend>{label}</legend>
    <div className="address-grid">
      <label>CEP (opcional)<input inputMode="numeric" value={value.cep} onChange={e => update('cep', cleanCep(e.target.value))} placeholder="00000-000" maxLength={8} />{loading && <small>Consultando CEP…</small>}{cepError && <small className="error">{cepError}</small>}</label>
      <label className="address-wide">Rua<input value={value.rua} onChange={e => update('rua', e.target.value)} placeholder="Nome da rua" />{!value.rua && value.cep && <small className="error">Informe a rua.</small>}</label>
      <label>Número<input value={value.numero} onChange={e => update('numero', e.target.value)} placeholder="Obrigatório" />{!value.numero && <small className="error">Informe o número.</small>}</label>
      <label>Bairro<input value={value.bairro} onChange={e => update('bairro', e.target.value)} placeholder="Obrigatório" />{!value.bairro && <small className="error">Informe o bairro.</small>}</label>
      <label>Complemento (opcional)<input value={value.complemento || ''} onChange={e => update('complemento', e.target.value)} placeholder="Apto, bloco…" /><small className="hint">Ex.: apartamento 12, loja 3 ou bloco B. Rua e número localizam o ponto automaticamente.</small></label>
    </div>
    {complete && <small className="located">Localização encontrada — confira e edite os dados se necessário.</small>}
  </fieldset>;
}
