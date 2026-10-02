import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, ChevronLeft } from 'lucide-react';
import { auth, Order, repo } from '../services/storage';
import { AddressForm } from './AddressForm';
import { DeliveryMap } from './DeliveryMap';
import { emptyAddress, StructuredAddress, Coordinates, geocodeAddress, addressComplete, SERVICE_CITY, SERVICE_STATE } from '../services/address';
import { createPublicOrder, getRoutePrice, type ApiDeliveryPrice } from '../services/api';

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return <label>{label}<input required value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} /></label>;
}

export function PublicOrderForm() {
  const [step, setStep] = useState(1);
  const [pickup, setPickup] = useState<StructuredAddress>(emptyAddress());
  const [delivery, setDelivery] = useState<StructuredAddress>(emptyAddress());
  const [form, setForm] = useState({ requester: '', requesterPhone: '', recipient: '', phone: '', packageInfo: '' });
  const [coords, setCoords] = useState<{ pickup?: Coordinates; delivery?: Coordinates }>({});
  const [created, setCreated] = useState<Order | null>(null);
  const [whatsappUrl, setWhatsappUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [pricingResult, setPricingResult] = useState<ApiDeliveryPrice | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState('');
  const updateAddress = (kind: 'pickup' | 'delivery', value: StructuredAddress) => {
    if (kind === 'pickup') setPickup(value); else setDelivery(value);
    setCoords(current => ({ ...current, [kind]: undefined }));
  };
  const valid = addressComplete(pickup) && addressComplete(delivery) &&
    !!form.requester.trim() && !!form.requesterPhone.trim() && !!form.recipient.trim() && !!form.phone.trim() && !!form.packageInfo.trim();
  useEffect(() => {
    if (!pickup.bairro.trim() || !delivery.bairro.trim()) {
      setPricingResult(null);
      setPricingError('');
      setPricingLoading(false);
      return;
    }
    let active = true;
    setPricingResult(null);
    setPricingLoading(true);
    setPricingError('');
    getRoutePrice(pickup.bairro, delivery.bairro, SERVICE_CITY, { pickup: coords.pickup, delivery: coords.delivery })
      .then(result => {
        if (!active) return;
        setPricingResult(result);
      })
      .catch(error => { if (active) setPricingError(error instanceof Error ? error.message : 'Não foi possível consultar o preço.'); })
      .finally(() => { if (active) setPricingLoading(false); });
    return () => { active = false; };
  }, [pickup.bairro, delivery.bairro, coords.pickup?.latitude, coords.pickup?.longitude, coords.delivery?.latitude, coords.delivery?.longitude]);
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (addressComplete(pickup)) { const c = await geocodeAddress(pickup); if (c) setCoords(x => ({ ...x, pickup: c })); }
      if (addressComplete(delivery)) { const c = await geocodeAddress(delivery); if (c) setCoords(x => ({ ...x, delivery: c })); }
    }, 700);
    return () => clearTimeout(timer);
  }, [pickup, delivery]);
  if (created) return <main className="center"><section className="card success"><CheckCircle2 size={54} /><h1>Pedido registrado!</h1><p>O pedido foi salvo para controle de gestão. O atendimento continuará pelo WhatsApp.</p><strong className="code">{created.publicId}</strong>{whatsappUrl && <a className="whatsapp" href={whatsappUrl} target="_blank" rel="noreferrer">Abrir mensagem completa no WhatsApp</a>}</section></main>;
  const submitOrder = async () => {
    setSaving(true); setSaveError('');
    const input = { pickupAddress: { ...pickup, cidade: SERVICE_CITY, estado: SERVICE_STATE, coordinates: coords.pickup }, deliveryAddress: { ...delivery, cidade: SERVICE_CITY, estado: SERVICE_STATE, coordinates: coords.delivery }, requesterName: form.requester, requesterPhone: form.requesterPhone, recipientName: form.recipient, recipientPhone: form.phone, notes: form.packageInfo };
    try {
      const apiOrder = await createPublicOrder(input, auth.token() || undefined);
      const price = apiOrder.price === null ? null : Number(apiOrder.price);
      const order = repo.orders.create({ pickupAddress: input.pickupAddress, deliveryAddress: input.deliveryAddress, from: `${pickup.rua}, ${pickup.numero}, ${pickup.bairro}`, to: `${delivery.rua}, ${delivery.numero}, ${delivery.bairro}`, recipient: form.recipient, phone: form.phone, packageInfo: form.packageInfo, zone: `${pickup.bairro} → ${delivery.bairro}`, price, pricingType: apiOrder.pricingType, minimumPrice: apiOrder.minimumPrice === null ? null : Number(apiOrder.minimumPrice), maximumPrice: apiOrder.maximumPrice === null ? null : Number(apiOrder.maximumPrice) });
      repo.orders.update(order.id, { publicId: apiOrder.publicId, token: apiOrder.trackingToken });
      setCreated({ ...order, publicId: apiOrder.publicId, token: apiOrder.trackingToken });
      const fallbackUrl = apiOrder.whatsapp?.fallbackUrl ?? '';
      setWhatsappUrl(fallbackUrl);
      if (fallbackUrl) window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
    } catch (error) { setSaveError(error instanceof Error ? error.message : 'Não foi possível enviar o pedido.'); }
    finally { setSaving(false); }
  };
  const priceLabel = !pricingResult?.success ? 'Consultar valor'
    : pricingResult.pricingType === 'FIXED' ? `R$ ${pricingResult.price.toFixed(2).replace('.', ',')}`
      : pricingResult.pricingType === 'RANGE' ? `Valor estimado: R$ ${pricingResult.minimumPrice.toFixed(2).replace('.', ',')} a R$ ${pricingResult.maximumPrice.toFixed(2).replace('.', ',')}`
        : pricingResult.pricingType === 'PER_KM' && pricingResult.price !== undefined ? `R$ ${pricingResult.price.toFixed(2).replace('.', ',')}`
        : 'Consultar valor';
  return <main><div className="hero"><span className="eyebrow">ENTREGAS SEM COMPLICAÇÃO</span><h1>Seu pedido, do seu jeito.</h1><p>Logística urbana com rastreio em tempo real e cuidado em cada etapa.</p></div><section className="card"><div className="steps">{['Origem e destino', 'Detalhes', 'Revisão'].map((x, i) => <div className={step === i + 1 ? 'active' : ''} key={x}><b>{i + 1}</b>{x}</div>)}</div>
    {step === 1 && <div className="formgrid"><AddressForm label="Endereço de coleta" value={pickup} onChange={v => updateAddress('pickup', v)} /><AddressForm label="Endereço de entrega" value={delivery} onChange={v => updateAddress('delivery', v)} /><Field label="Nome do solicitante" value={form.requester} onChange={v => setForm({ ...form, requester: v })} placeholder="Nome completo" /><Field label="Telefone do solicitante" value={form.requesterPhone} onChange={v => setForm({ ...form, requesterPhone: v })} placeholder="(32) 99999-0000" /><Field label="Nome de quem recebe" value={form.recipient} onChange={v => setForm({ ...form, recipient: v })} placeholder="Nome completo" /><Field label="Telefone de quem recebe" value={form.phone} onChange={v => setForm({ ...form, phone: v })} placeholder="(32) 98888-0000" /><Field label="O que será transportado?" value={form.packageInfo} onChange={v => setForm({ ...form, packageInfo: v })} placeholder="Ex.: documentos, pequeno pacote" /><div className="delivery-price"><strong>{pricingLoading ? 'Consultando preço...' : priceLabel}</strong>{(pricingError || (pricingResult?.success && pricingResult.pricingType === 'QUOTE')) && <small>{pricingError || 'Valor sob consulta.'}</small>}</div><DeliveryMap pickup={coords.pickup} delivery={coords.delivery} /><button className="btn full" disabled={!valid} onClick={() => setStep(2)}>Continuar <ArrowRight size={17} /></button></div>}
    {step === 2 && <div className="formgrid"><div className="delivery-price"><strong>{pricingLoading ? 'Consultando preço...' : priceLabel}</strong>{pricingError && <small>{pricingError}</small>}</div><div className="actions"><button className="btn ghost" onClick={() => setStep(1)}><ChevronLeft />Voltar</button><button className="btn" disabled={!valid} onClick={() => setStep(3)}>Revisar <ArrowRight size={17} /></button></div></div>}
    {step === 3 && <div><div className="review"><p><b>Solicitante</b><span>{form.requester} {form.requesterPhone}</span></p><p><b>Coleta</b><span>{pickup.rua}, {pickup.numero} — {pickup.bairro}, {SERVICE_CITY}/{SERVICE_STATE}</span></p><p><b>Entrega</b><span>{delivery.rua}, {delivery.numero} — {delivery.bairro}, {SERVICE_CITY}/{SERVICE_STATE}</span></p><p><b>Destinatário</b><span>{form.recipient} {form.phone}</span></p><p><b>Volume</b><span>{form.packageInfo}</span></p></div><div className="total"><span>Preço calculado pela origem e destino</span><strong>{pricingLoading ? 'Consultando preço...' : priceLabel}</strong></div>{pricingError && <p className="error">{pricingError}</p>}{saveError && <p className="error">{saveError}</p>}<div className="actions"><button className="btn ghost" onClick={() => setStep(2)}><ChevronLeft />Editar</button><button className="btn" disabled={!valid || !pricingResult?.success || pricingLoading || saving} onClick={submitOrder}>{saving ? 'Enviando...' : 'Confirmar pedido'} <CheckCircle2 size={17} /></button></div></div>}</section></main>;
}
