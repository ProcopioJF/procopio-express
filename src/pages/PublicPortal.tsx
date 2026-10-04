import { lazy, Suspense, useEffect, useState } from 'react'
import { MapPin, Phone, User, Home, ChevronRight, ChevronLeft, Check, Package, Navigation, MessageCircle, Building2, ArrowRight } from 'lucide-react'
import Logo from '../components/Logo'
import { emptyAddress as newStructuredAddress, geocodeAddress, isValidOptionalCep, lookupCep } from '../services/address'
import { createPublicOrder, formatOrderPrice, getCompanyOrganization, getPublicSettings, getRoutePrice, type ApiDeliveryPrice, type ApiOrganization } from '../services/api'

const DeliveryMap = lazy(() =>
  import('../components/DeliveryMap').then(({ DeliveryMap: Component }) => ({ default: Component })),
)

interface PublicPortalProps {
  onGoToLogin: () => void
  token?: string
  companyOrderMode?: boolean
  onGoToDashboard?: () => void
}

interface AddressForm {
  name: string
  phone: string
  cep: string
  street: string
  number: string
  neighborhood: string
  complement: string
  city: string
}

const emptyAddress = (): AddressForm => ({
  name: '', phone: '', cep: '', street: '', number: '',
  neighborhood: '', complement: '', city: ''
})

function formatPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`
  if (d.length <= 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
  return v
}

function formatCep(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 5) return d
  return `${d.slice(0,5)}-${d.slice(5)}`
}

function isValidPhone(value: string) {
  return [10, 11].includes(value.replace(/\D/g, '').length)
}

function InputField({
  label, value, onChange, placeholder, icon: Icon, type = 'text', required, helperText, error
}: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; icon?: any; type?: string; required?: boolean; helperText?: string; error?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] sm:text-xs font-600 text-[#52657f] uppercase tracking-[0.06em]">
        {label}{required && <span className="text-[#e7650b] ml-0.5">*</span>}
      </label>
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#718096]">
            <Icon size={15}/>
          </div>
        )}
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full h-11 rounded-xl border border-[#d8e1eb] bg-white text-[#102a43] text-sm font-500 placeholder:text-[#8a9aab] focus:outline-none focus:border-[#39b5ee] focus:ring-4 focus:ring-[#39b5ee]/10 transition-all ${Icon ? 'pl-9 pr-3' : 'px-4'}`}
        />
      </div>
      {helperText && <span className="text-[10px] text-[#718096]">{helperText}</span>}
      {error && <span role="alert" className="text-[10px] text-red-600">{error}</span>}
    </div>
  )
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  const steps = ['Coleta', 'Destino', 'Resumo']
  return (
    <div className="flex items-center gap-2">
      {steps.map((label, i) => {
        const idx = i + 1
        const done = idx < current
        const active = idx === current
        return (
          <div key={i} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-700 transition-all ${done ? 'bg-[#ff7a18] text-white' : active ? 'bg-[#0f3266] text-white shadow-md shadow-[#0f3266]/20' : 'bg-[#edf2f7] text-[#64748b]'}`}>
                {done ? <Check size={13}/> : idx}
              </div>
              <span className={`text-xs font-600 hidden sm:block transition-colors ${active ? 'text-[#0f3266]' : done ? 'text-[#e7650b]' : 'text-[#718096]'}`}>
                {label}
              </span>
            </div>
            {i < total - 1 && (
              <div className={`w-8 h-px transition-colors ${done ? 'bg-[#ff7a18]' : 'bg-[#e5eaf0]'}`}/>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ResponsiveDeliveryMap({
  pickup,
  delivery,
  className = '',
}: {
  pickup?: { latitude: number; longitude: number }
  delivery?: { latitude: number; longitude: number }
  className?: string
}) {
  const [isOpen, setIsOpen] = useState(true)
  const [isDesktop, setIsDesktop] = useState(() =>
    window.matchMedia('(min-width: 1024px)').matches,
  )

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)')
    const updateViewport = () => setIsDesktop(media.matches)
    media.addEventListener('change', updateViewport)
    return () => media.removeEventListener('change', updateViewport)
  }, [])

  return (
    <>
      <div className={`hidden overflow-hidden rounded-2xl border border-[#e2e8f0] shadow-sm lg:block ${className}`}>
        {isDesktop && (
          <Suspense fallback={<div className="h-full min-h-0 bg-[#eff7fc]" />}>
            <DeliveryMap pickup={pickup} delivery={delivery}/>
          </Suspense>
        )}
      </div>
      <div className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white lg:hidden">
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
          className="flex min-h-11 w-full items-center justify-between gap-3 px-4 text-left text-xs font-semibold text-[#0f3266]"
        >
          <span className="flex items-center gap-2">
            <MapPin size={15} className="text-[#ff7a18]"/>
            {isOpen ? 'Ocultar mapa da rota' : 'Ver mapa da rota'}
          </span>
          <ChevronRight
            size={15}
            className={`transition-transform ${isOpen ? 'rotate-90' : ''}`}
          />
        </button>
        {!isDesktop && isOpen && (
          <div className="h-[320px] border-t border-[#e5eaf0]">
            <Suspense fallback={<div className="h-full bg-[#eff7fc]" />}>
              <DeliveryMap pickup={pickup} delivery={delivery}/>
            </Suspense>
          </div>
        )}
      </div>
    </>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2.5 border-b border-[#f1f5f9] last:border-0">
      <span className="text-xs text-[#64748b] font-500">{label}</span>
      <span className="text-xs text-[#0f172a] font-600 text-right">{value}</span>
    </div>
  )
}

export default function PublicPortal({ onGoToLogin, token, companyOrderMode = false, onGoToDashboard }: PublicPortalProps) {
  const [step, setStep] = useState(1)
  const [pickup, setPickup] = useState<AddressForm>(emptyAddress())
  const [dropoff, setDropoff] = useState<AddressForm>(emptyAddress())
  const [observations, setObservations] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [pricingResult, setPricingResult] = useState<ApiDeliveryPrice | null>(null)
  const [pricingLoading, setPricingLoading] = useState(false)
  const [pricingError, setPricingError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const [orderResult, setOrderResult] = useState<{ publicId: string; trackingToken: string; price: number | string | null; pricingType: 'FIXED' | 'RANGE' | 'PER_KM' | 'QUOTE'; minimumPrice: number | string | null; maximumPrice: number | string | null; whatsapp?: { status: 'sent' | 'pending' | 'failed' | 'not_configured' | 'unknown'; fallbackUrl?: string } } | null>(null)
  const [supportPhone, setSupportPhone] = useState('')
  const [settingsError, setSettingsError] = useState('')
  const [organization, setOrganization] = useState<ApiOrganization | null>(null)
  const [organizationError, setOrganizationError] = useState('')
  const [branchId, setBranchId] = useState('')
  const [costCenterId, setCostCenterId] = useState('')
  const [coordinates, setCoordinates] = useState<{ pickup?: { latitude: number; longitude: number }; delivery?: { latitude: number; longitude: number } }>({})
  const [cepLookup, setCepLookup] = useState<{ pickupLoading: boolean; deliveryLoading: boolean; pickupError: string; deliveryError: string }>({
    pickupLoading: false,
    deliveryLoading: false,
    pickupError: '',
    deliveryError: '',
  })

  const setPickupField = (field: keyof AddressForm) => (v: string) =>
    setPickup(p => ({ ...p, [field]: v }))
  const setDropoffField = (field: keyof AddressForm) => (v: string) =>
    setDropoff(p => ({ ...p, [field]: v }))

  const step1Valid = pickup.name && isValidPhone(pickup.phone) && isValidOptionalCep(pickup.cep) && pickup.street && pickup.number && pickup.neighborhood && pickup.city
  const step2Valid = dropoff.name && isValidPhone(dropoff.phone) && isValidOptionalCep(dropoff.cep) && dropoff.street && dropoff.number && dropoff.neighborhood && dropoff.city
  const pickupAddress = { cep: pickup.cep.replace(/\D/g, ''), rua: pickup.street, numero: pickup.number, bairro: pickup.neighborhood, complemento: pickup.complement, cidade: pickup.city, estado: 'MG', coordinates: coordinates.pickup }
  const deliveryAddress = { cep: dropoff.cep.replace(/\D/g, ''), rua: dropoff.street, numero: dropoff.number, bairro: dropoff.neighborhood, complemento: dropoff.complement, cidade: dropoff.city, estado: 'MG', coordinates: coordinates.delivery }

  useEffect(() => {
    getPublicSettings().then(settings => {
      setSupportPhone(settings.supportPhone)
      setPickup(current => current.city ? current : { ...current, city: settings.operationCity })
      setDropoff(current => current.city ? current : { ...current, city: settings.operationCity })
    }).catch(error => {
      setSettingsError(error instanceof Error ? error.message : 'Não foi possível carregar as configurações de atendimento.')
    })
  }, [])

  useEffect(() => {
    if (!pickup.cep || !/^\d{8}$/.test(pickup.cep.replace(/\D/g, ''))) {
      setCepLookup(current => ({ ...current, pickupLoading: false, pickupError: '' }))
      return
    }
    let active = true
    setCepLookup(current => ({ ...current, pickupLoading: true, pickupError: '' }))
    lookupCep(pickup.cep)
      .then(result => {
        if (!active) return
        setPickup(current => ({
          ...current,
          street: result.rua || current.street,
          neighborhood: result.bairro || current.neighborhood,
          city: result.cidade || current.city,
        }))
      })
      .catch(error => {
        if (active) setCepLookup(current => ({
          ...current,
          pickupError: error instanceof Error ? error.message : 'Não foi possível consultar o CEP.',
        }))
      })
      .finally(() => {
        if (active) setCepLookup(current => ({ ...current, pickupLoading: false }))
      })
    return () => { active = false }
  }, [pickup.cep])

  useEffect(() => {
    if (!dropoff.cep || !/^\d{8}$/.test(dropoff.cep.replace(/\D/g, ''))) {
      setCepLookup(current => ({ ...current, deliveryLoading: false, deliveryError: '' }))
      return
    }
    let active = true
    setCepLookup(current => ({ ...current, deliveryLoading: true, deliveryError: '' }))
    lookupCep(dropoff.cep)
      .then(result => {
        if (!active) return
        setDropoff(current => ({
          ...current,
          street: result.rua || current.street,
          neighborhood: result.bairro || current.neighborhood,
          city: result.cidade || current.city,
        }))
      })
      .catch(error => {
        if (active) setCepLookup(current => ({
          ...current,
          deliveryError: error instanceof Error ? error.message : 'Não foi possível consultar o CEP.',
        }))
      })
      .finally(() => {
        if (active) setCepLookup(current => ({ ...current, deliveryLoading: false }))
      })
    return () => { active = false }
  }, [dropoff.cep])

  useEffect(() => {
    if (!companyOrderMode || !token) return
    getCompanyOrganization(token)
      .then(result => setOrganization(result.organization))
      .catch(error => setOrganizationError(error instanceof Error ? error.message : 'Não foi possível carregar filiais e centros de custo.'))
  }, [companyOrderMode, token])

  useEffect(() => {
    if (!pickup.neighborhood.trim() || !dropoff.neighborhood.trim()) {
      setPricingResult(null)
      setPricingError('')
      setPricingLoading(false)
      return
    }
    let active = true
    setPricingResult(null)
    setPricingLoading(true)
    setPricingError('')
    getRoutePrice(pickup.neighborhood, dropoff.neighborhood, pickup.city || 'Juiz de Fora', {
      pickup: coordinates.pickup,
      delivery: coordinates.delivery,
    })
      .then(result => {
        if (!active) return
        setPricingResult(result)
      })
      .catch(error => { if (active) setPricingError(error instanceof Error ? error.message : 'Não foi possível consultar o preço.') })
      .finally(() => { if (active) setPricingLoading(false) })
    return () => { active = false }
  }, [pickup.neighborhood, dropoff.neighborhood, pickup.city, coordinates.pickup?.latitude, coordinates.pickup?.longitude, coordinates.delivery?.latitude, coordinates.delivery?.longitude])

  const priceLabel = !pricingResult?.success
    ? 'Consultar valor'
    : pricingResult.pricingType === 'FIXED'
      ? `R$ ${pricingResult.price.toFixed(2).replace('.', ',')}`
      : pricingResult.pricingType === 'RANGE'
        ? `Valor estimado: R$ ${pricingResult.minimumPrice.toFixed(2).replace('.', ',')} a R$ ${pricingResult.maximumPrice.toFixed(2).replace('.', ',')}`
        : pricingResult.pricingType === 'PER_KM' && pricingResult.price !== undefined
          ? `R$ ${pricingResult.price.toFixed(2).replace('.', ',')}`
        : 'Consultar valor'

  useEffect(() => {
    let active = true
    const timer = setTimeout(async () => {
      const [pickupPoint, deliveryPoint] = await Promise.all([
        pickup.street && pickup.neighborhood ? geocodeAddress({ ...newStructuredAddress(), rua: pickup.street, numero: pickup.number, bairro: pickup.neighborhood }) : undefined,
        dropoff.street && dropoff.neighborhood ? geocodeAddress({ ...newStructuredAddress(), rua: dropoff.street, numero: dropoff.number, bairro: dropoff.neighborhood }) : undefined,
      ])
      if (active) setCoordinates({ pickup: pickupPoint, delivery: deliveryPoint })
    }, 700)
    return () => { active = false; clearTimeout(timer) }
  }, [pickup.street, pickup.number, pickup.neighborhood, dropoff.street, dropoff.number, dropoff.neighborhood])

  const handleSubmit = async () => {
    setSaving(true)
    setSaveError('')
    const whatsappTab = window.open('about:blank', '_blank')
    try {
      const created = await createPublicOrder({
        pickupAddress,
        deliveryAddress,
        recipientName: dropoff.name,
        recipientPhone: dropoff.phone,
        requesterName: pickup.name,
        requesterPhone: pickup.phone,
        notes: observations,
        ...(branchId ? { branchId } : {}),
        ...(costCenterId ? { costCenterId } : {}),
      }, token)
      setOrderResult(created)
      if (created.whatsapp?.fallbackUrl && whatsappTab) whatsappTab.location.href = created.whatsapp.fallbackUrl
      else if (whatsappTab) whatsappTab.close()
      setSubmitted(true)
    } catch (error) {
      if (whatsappTab) whatsappTab.close()
      setSaveError(error instanceof Error ? error.message : 'Não foi possível registrar o pedido.')
    } finally {
      setSaving(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#0f3266] to-[#17447f] px-4 py-6">
        <div className="bg-white rounded-3xl p-6 sm:p-10 max-w-sm w-full text-center shadow-2xl animate-fade-in-up">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#dcfce7] flex items-center justify-center mx-auto mb-5">
            <Check size={32} className="text-[#16a34a] sm:h-9 sm:w-9" strokeWidth={2.5}/>
          </div>
          <h2 className="text-2xl font-800 text-[#0c225a] mb-2">Pedido Enviado!</h2>
          <p className="text-[#52657f] text-sm font-500 leading-relaxed mb-6">
            Seu pedido foi salvo para controle de gestão. {orderResult?.whatsapp?.status === 'sent'
              ? 'A mensagem foi enviada automaticamente ao WhatsApp da Procópio Express.'
              : orderResult?.whatsapp?.fallbackUrl
                ? orderResult.whatsapp.status === 'pending'
                  ? 'O WhatsApp foi aberto com a mensagem preparada. Confira os dados e toque em Enviar para concluir o atendimento.'
                  : 'Não foi possível confirmar o envio automático. Continue o atendimento pelo WhatsApp usando a mensagem preparada.'
                : 'O WhatsApp da operação não está configurado. Anote o número do pedido e entre em contato com a Procópio Express.'}
          </p>
          <div className="bg-[#f7f9fc] border border-[#e5eaf0] rounded-xl p-4 mb-6 text-left">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[#64748b]">Registro</span>
              <span className="font-700 text-[#0f3266]">{orderResult?.publicId}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#64748b]">Valor registrado</span>
              <span className="font-700 text-[#e7650b] text-base">{orderResult ? formatOrderPrice(orderResult) : '—'}</span>
            </div>
          </div>
          {orderResult?.whatsapp?.fallbackUrl && <a href={orderResult.whatsapp.fallbackUrl} target="_blank" rel="noreferrer" className="mb-4 w-full min-h-12 rounded-xl bg-[#16a34a] text-white text-sm font-700 flex items-center justify-center gap-2"><MessageCircle size={16}/> Abrir WhatsApp com a mensagem</a>}
          {!orderResult?.whatsapp?.fallbackUrl && supportPhone && orderResult?.whatsapp?.status !== 'sent' && <a href={`tel:${supportPhone.replace(/[^\d+]/g, '')}`} className="mb-4 block text-sm font-semibold text-[#0c225a]">Fale com a Procópio Express: {supportPhone}</a>}
          {onGoToDashboard && token && <button onClick={onGoToDashboard} className="mb-3 w-full min-h-12 rounded-xl border border-[#e5eaf0] text-[#0f3266] text-sm font-700">Voltar ao painel</button>}
          <button
            onClick={() => { setSubmitted(false); setStep(1); setPickup({ ...emptyAddress(), city: pickup.city }); setDropoff({ ...emptyAddress(), city: dropoff.city }); setObservations(''); setOrderResult(null) }}
            className="w-full min-h-12 rounded-xl bg-[#0f3266] text-white text-sm font-700 hover:bg-[#17447f] transition-colors"
          >
            Nova Solicitação
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc] flex flex-col">
      {/* Top nav */}
      <header className="bg-white border-b border-[#e5eaf0] px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <Logo variant="horizontal" className="h-7 sm:h-9 max-w-[112px] min-[380px]:max-w-[132px] sm:max-w-none object-contain"/>
        <div className="flex items-center gap-1.5 sm:gap-3">
          {supportPhone && <a href={`tel:${supportPhone.replace(/[^\d+]/g, '')}`} className="hidden sm:flex items-center gap-1.5 text-sm text-[#64748b] font-500 hover:text-[#0c225a] transition-colors">
            <Phone size={14}/> {supportPhone}
          </a>}
          {token && onGoToDashboard ? (
            <button
              onClick={onGoToDashboard}
              className="flex min-h-10 items-center gap-1.5 sm:gap-2 bg-[#0f3266] text-white text-[11px] sm:text-sm font-600 px-2.5 sm:px-4 py-2 rounded-xl whitespace-nowrap hover:bg-[#17447f] transition-colors"
            >
              <ArrowRight size={14}/>
              <span>Voltar ao painel</span>
            </button>
          ) : (
            <button
              onClick={onGoToLogin}
              className="flex min-h-10 items-center gap-1.5 sm:gap-2 bg-[#0f3266] text-white text-[11px] sm:text-sm font-600 px-2.5 sm:px-4 py-2 rounded-xl whitespace-nowrap hover:bg-[#17447f] transition-colors"
            >
              <Building2 size={14}/>
              <span>Área de Empresas</span>
            </button>
          )}
        </div>
      </header>
      {settingsError && <p role="alert" className="border-b border-amber-200 bg-amber-50 px-3 sm:px-4 py-2 text-center text-xs sm:text-sm leading-snug text-amber-900">{settingsError}</p>}
      {organizationError && <p role="alert" className="border-b border-red-200 bg-red-50 px-3 sm:px-4 py-2 text-center text-xs sm:text-sm leading-snug text-red-700">{organizationError}</p>}

      {/* Progress bar */}
      <div className="bg-white border-b border-[#e5eaf0] px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <StepIndicator current={step} total={3}/>
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-xs font-600 text-[#0c225a]">
              {step === 1 ? 'Onde buscar?' : step === 2 ? 'Onde entregar?' : 'Confirmar pedido'}
            </span>
            <span className="text-[10px] text-[#94a3b8]">Etapa {step} de 3</span>
          </div>
        </div>
        {/* Progress bar track */}
        <div className="max-w-5xl mx-auto mt-3 h-1 bg-[#e5eaf0] rounded-full overflow-hidden">
          <div
          className="h-full bg-gradient-to-r from-[#ff7a18] to-[#ff9648] rounded-full transition-all duration-500"
            style={{ width: `${((step - 1) / 2) * 100}%` }}
          />
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 flex items-start justify-center px-3 sm:px-4 py-4 sm:py-8">
        <div className="w-full max-w-5xl">
          {/* Step 1 — Coleta */}
          {step === 1 && (
            <div className="grid lg:grid-cols-2 gap-6 animate-fade-in-up">
              <div className="bg-white rounded-2xl shadow-sm border border-[#e5eaf0] p-4 sm:p-6 flex flex-col gap-4 sm:gap-5">
                <div className="flex items-center gap-3 pb-2 border-b border-[#f1f5f9]">
                  <div className="w-9 h-9 rounded-xl bg-[#fff5eb] flex items-center justify-center">
                    <MapPin size={18} className="text-[#f47b20]"/>
                  </div>
                  <div>
                    <h2 className="text-base font-700 text-[#0c225a]">Ponto de Coleta</h2>
                    <p className="text-xs text-[#94a3b8]">Onde buscar o pacote?</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="col-span-2">
                    <InputField label="Nome do Solicitante" value={pickup.name} onChange={setPickupField('name')} placeholder="João Silva" icon={User} required/>
                  </div>
                  <div className="col-span-2">
                    <InputField label="Telefone" value={pickup.phone} onChange={v => setPickupField('phone')(formatPhone(v))} placeholder="(32) 99999-0000" icon={Phone} required/>
                  </div>
                  <InputField label="CEP (opcional)" value={pickup.cep} onChange={v => setPickupField('cep')(formatCep(v))} placeholder="36000-000" helperText={cepLookup.pickupLoading ? 'Consultando CEP…' : undefined} error={cepLookup.pickupError || (pickup.cep && !isValidOptionalCep(pickup.cep) ? 'Informe os 8 dígitos ou deixe em branco.' : undefined)}/>
                  <InputField label="Número" value={pickup.number} onChange={setPickupField('number')} placeholder="123" icon={Home} required/>
                  <div className="col-span-2">
                    <InputField label="Rua / Avenida" value={pickup.street} onChange={setPickupField('street')} placeholder="Rua Halfeld" required/>
                  </div>
                  <InputField label="Bairro" value={pickup.neighborhood} onChange={setPickupField('neighborhood')} placeholder="Centro" required/>
                  <InputField label="Cidade" value={pickup.city} onChange={setPickupField('city')} placeholder="Juiz de Fora" required/>
                  <div className="col-span-2">
                    <InputField label="Complemento" value={pickup.complement} onChange={setPickupField('complement')} placeholder="Apto 201, Bloco B"/>
                  </div>
                </div>

                <button
                  disabled={!step1Valid}
                  onClick={() => setStep(2)}
                  className="mt-auto w-full min-h-12 rounded-xl text-sm font-700 flex items-center justify-center gap-2 transition-all enabled:bg-[#ff7a18] enabled:hover:bg-[#e7650b] enabled:text-white enabled:shadow-md enabled:shadow-[#ff7a18]/20 disabled:cursor-not-allowed disabled:border disabled:border-[#e5eaf0] disabled:bg-[#eef2f6] disabled:text-[#64748b]"
                >
                  Próximo: Destino <ChevronRight size={16}/>
                </button>
              </div>

              <ResponsiveDeliveryMap pickup={coordinates.pickup} delivery={coordinates.delivery} className="h-[400px] lg:h-auto lg:min-h-[500px]"/>
            </div>
          )}

          {/* Step 2 — Destino */}
          {step === 2 && (
            <div className="grid lg:grid-cols-2 gap-6 animate-fade-in-up">
              <div className="bg-white rounded-2xl shadow-sm border border-[#e5eaf0] p-4 sm:p-6 flex flex-col gap-4 sm:gap-5">
                <div className="flex items-center gap-3 pb-2 border-b border-[#f1f5f9]">
                  <div className="w-9 h-9 rounded-xl bg-[#f0f5ff] flex items-center justify-center">
                    <Navigation size={18} className="text-[#0c225a]"/>
                  </div>
                  <div>
                    <h2 className="text-base font-700 text-[#0c225a]">Destino da Entrega</h2>
                    <p className="text-xs text-[#94a3b8]">Onde entregar o pacote?</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="col-span-2">
                    <InputField label="Nome do Destinatário" value={dropoff.name} onChange={setDropoffField('name')} placeholder="Maria Souza" icon={User} required/>
                  </div>
                  <div className="col-span-2">
                    <InputField label="Telefone" value={dropoff.phone} onChange={v => setDropoffField('phone')(formatPhone(v))} placeholder="(32) 98888-0000" icon={Phone} required/>
                  </div>
                  <InputField label="CEP (opcional)" value={dropoff.cep} onChange={v => setDropoffField('cep')(formatCep(v))} placeholder="36010-000" helperText={cepLookup.deliveryLoading ? 'Consultando CEP…' : undefined} error={cepLookup.deliveryError || (dropoff.cep && !isValidOptionalCep(dropoff.cep) ? 'Informe os 8 dígitos ou deixe em branco.' : undefined)}/>
                  <InputField label="Número" value={dropoff.number} onChange={setDropoffField('number')} placeholder="456" icon={Home} required/>
                  <div className="col-span-2">
                    <InputField label="Rua / Avenida" value={dropoff.street} onChange={setDropoffField('street')} placeholder="Av. Rio Branco" required/>
                  </div>
                  <InputField label="Bairro" value={dropoff.neighborhood} onChange={setDropoffField('neighborhood')} placeholder="Benfica" required/>
                  <InputField label="Cidade" value={dropoff.city} onChange={setDropoffField('city')} placeholder="Juiz de Fora" required/>
                  <div className="col-span-2">
                    <InputField label="Complemento" value={dropoff.complement} onChange={setDropoffField('complement')} placeholder="Sala 10"/>
                  </div>
                </div>

                <div className="flex gap-3 mt-auto">
                  <button
                    onClick={() => setStep(1)}
                    className="min-h-12 px-5 rounded-xl text-sm font-600 border border-[#e5eaf0] text-[#52657f] hover:bg-[#f7f9fc] transition-colors flex items-center gap-1.5"
                  >
                    <ChevronLeft size={15}/> Voltar
                  </button>
                  <button
                    disabled={!step2Valid}
                    onClick={() => setStep(3)}
                    className="flex-1 min-h-12 rounded-xl text-sm font-700 flex items-center justify-center gap-2 transition-all enabled:bg-[#0f3266] enabled:hover:bg-[#17447f] enabled:text-white disabled:cursor-not-allowed disabled:border disabled:border-[#e5eaf0] disabled:bg-[#eef2f6] disabled:text-[#64748b]"
                  >
                    Ver Resumo <ChevronRight size={16}/>
                  </button>
                </div>
              </div>

              <ResponsiveDeliveryMap pickup={coordinates.pickup} delivery={coordinates.delivery} className="h-[400px] lg:h-auto lg:min-h-[500px]"/>
            </div>
          )}

          {/* Step 3 — Resumo */}
          {step === 3 && (
            <div className="grid lg:grid-cols-5 gap-6 animate-fade-in-up">
              {/* Left: summary */}
              <div className="lg:col-span-3 flex flex-col gap-4">
                {/* Price card */}
                <div className="bg-gradient-to-br from-[#0c225a] to-[#163690] rounded-2xl p-6 text-white">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-500 text-white/70">Valor da rota</span>
                    <span className="text-xs font-500 bg-white/15 px-2.5 py-1 rounded-full">{pricingLoading ? 'Consultando...' : pricingError ? 'Preço indisponível' : pricingResult?.success ? pricingResult.priceTable ?? 'Valor sob consulta' : 'Consultar valor'}</span>
                  </div>
                  <div className={`font-800 text-[#f47b20] ${pricingResult?.success && pricingResult.pricingType === 'RANGE' ? 'text-2xl' : 'text-4xl'}`}>{priceLabel}</div>
                  <p className="text-xs text-white/70 mt-1">{pricingError || 'Quando não houver tarifa cadastrada, o valor será consultado.'}</p>
                </div>

                {/* Pickup summary */}
                <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-[#f47b20] text-white text-xs font-700 flex items-center justify-center">A</div>
                    <span className="text-sm font-700 text-[#0c225a]">Coleta</span>
                  </div>
                  <SummaryRow label="Solicitante" value={pickup.name}/>
                  <SummaryRow label="Telefone" value={pickup.phone}/>
                  <SummaryRow label="Endereço" value={`${pickup.street}, ${pickup.number}`}/>
                  <SummaryRow label="Bairro" value={pickup.neighborhood}/>
                  <SummaryRow label="Cidade / CEP" value={`${pickup.city}${pickup.cep ? ` — ${pickup.cep}` : ''}`}/>
                  {pickup.complement && <SummaryRow label="Complemento" value={pickup.complement}/>}
                </div>

                {/* Dropoff summary */}
                <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-[#0c225a] text-white text-xs font-700 flex items-center justify-center">B</div>
                    <span className="text-sm font-700 text-[#0c225a]">Entrega</span>
                  </div>
                  <SummaryRow label="Destinatário" value={dropoff.name}/>
                  <SummaryRow label="Telefone" value={dropoff.phone}/>
                  <SummaryRow label="Endereço" value={`${dropoff.street}, ${dropoff.number}`}/>
                  <SummaryRow label="Bairro" value={dropoff.neighborhood}/>
                  <SummaryRow label="Cidade / CEP" value={`${dropoff.city}${dropoff.cep ? ` — ${dropoff.cep}` : ''}`}/>
                  {dropoff.complement && <SummaryRow label="Complemento" value={dropoff.complement}/>}
                </div>

                {/* Observations */}
                {companyOrderMode && (
                  <div className="grid gap-3 rounded-2xl border border-[#e2e8f0] bg-white p-5 sm:grid-cols-2">
                    <label className="text-xs font-semibold text-[#64748b]">
                      Filial (opcional)
                      <select value={branchId} onChange={event => setBranchId(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-[#e2e8f0] bg-white px-3 text-sm text-[#0f172a]">
                        <option value="">Sede / não especificada</option>
                        {organization?.branches.filter(branch => branch.isActive).map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-[#64748b]">
                      Centro de custo (opcional)
                      <select value={costCenterId} onChange={event => setCostCenterId(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-[#e2e8f0] bg-white px-3 text-sm text-[#0f172a]">
                        <option value="">Não especificado</option>
                        {organization?.costCenters.filter(center => center.isActive).map(center => <option key={center.id} value={center.id}>{center.code ? `${center.code} · ` : ""}{center.name}</option>)}
                      </select>
                    </label>
                  </div>
                )}

                <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5 shadow-sm">
                  <label className="block text-xs font-600 text-[#64748b] uppercase tracking-wide mb-2">
                    Observações (opcional)
                  </label>
                  <textarea
                    value={observations}
                    onChange={e => setObservations(e.target.value)}
                    rows={3}
                    placeholder="Informações adicionais para a equipe da Procópio Express..."
                    className="w-full rounded-xl border border-[#e2e8f0] text-sm text-[#0f172a] p-3 resize-none focus:outline-none focus:border-[#f47b20] focus:ring-2 focus:ring-[#f47b20]/15 transition-all placeholder:text-[#cbd5e1]"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(2)}
                    className="h-12 px-5 rounded-xl text-sm font-600 border border-[#e2e8f0] text-[#64748b] hover:bg-[#f4f6fa] transition-colors flex items-center gap-1.5"
                  >
                    <ChevronLeft size={15}/> Voltar
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={saving || pricingLoading || !pricingResult?.success || !pickup.name || !pickup.phone || !dropoff.name || !dropoff.phone}
                    className="flex-1 h-12 rounded-xl text-sm font-700 flex items-center justify-center gap-2.5 bg-[#25D366] hover:bg-[#1ebe5b] text-white transition-all shadow-lg shadow-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <MessageCircle size={17}/>
                    {saving ? 'Registrando pedido...' : 'Finalizar e enviar pedido'}
                  </button>
                </div>
                {saveError && <p className="text-sm text-red-600" role="alert">{saveError}</p>}
              </div>

              {/* Right: map */}
              <ResponsiveDeliveryMap pickup={coordinates.pickup} delivery={coordinates.delivery} className="lg:col-span-2 h-[400px] lg:h-full min-h-[500px]"/>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#e2e8f0] bg-white px-6 py-4 text-center">
        <p className="text-xs text-[#94a3b8]">
          © 2025 Procópio Express · Entregas rápidas em Juiz de Fora, MG ·{' '}
          {token && onGoToDashboard ? (
            <button onClick={onGoToDashboard} className="text-[#0c225a] font-600 hover:underline inline-flex items-center gap-1">
              Voltar ao painel <ArrowRight size={11}/>
            </button>
          ) : (
            <button onClick={onGoToLogin} className="text-[#0c225a] font-600 hover:underline inline-flex items-center gap-1">
              Acesso Empresarial <ArrowRight size={11}/>
            </button>
          )}
        </p>
      </footer>
    </div>
  )
}
