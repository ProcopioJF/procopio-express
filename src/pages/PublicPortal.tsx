import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Building2, Check, ChevronRight, Home, MapPin, MessageCircle, Navigation, Package, Pencil, Phone, Search, User, type LucideIcon } from 'lucide-react'
import Logo from '../components/Logo'
import { emptyAddress as newStructuredAddress, geocodeAddress, isValidOptionalCep, lookupCep } from '../services/address'
import { createPublicOrder, formatOrderPrice, getCompanyOrganization, getPublicSettings, getRoutePrice, searchCompanyPickupAddresses, type ApiDeliveryPrice, type ApiOrganization, type ApiPickupAddressSuggestion } from '../services/api'

const DeliveryMap = lazy(() =>
  import('../components/DeliveryMap').then(({ DeliveryMap: Component }) => ({ default: Component })),
)

interface PublicPortalProps {
  onGoToLogin: () => void
  token?: string
  companyOrderMode?: boolean
  requesterName?: string
  requesterPhone?: string | null
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
  state: string
}

const emptyAddress = (): AddressForm => ({
  name: '', phone: '', cep: '', street: '', number: '',
  neighborhood: '', complement: '', city: '', state: 'MG'
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
  label, value, onChange, placeholder, icon: Icon, type = 'text', required, helperText, error, inputMode
}: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; icon?: LucideIcon; type?: string; required?: boolean; helperText?: string; error?: string; inputMode?: 'text' | 'numeric' | 'tel'
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
          inputMode={inputMode}
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
}: {
  pickup?: { latitude: number; longitude: number }
  delivery?: { latitude: number; longitude: number }
}) {
  const [isOpen, setIsOpen] = useState(false)
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
      <div className={`hidden overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-sm lg:block ${isOpen ? 'h-[280px]' : 'h-12'}`}>
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => setIsOpen(open => !open)}
          className="flex min-h-11 w-full items-center justify-between gap-3 px-4 text-left text-xs font-semibold text-[#0f3266]"
        >
          <span className="flex items-center gap-2">
            <MapPin size={15} className="text-[#ff7a18}"/>
            {isOpen ? 'Ocultar mapa da rota' : 'Ver mapa da rota'}
          </span>
          <ChevronRight size={15} className={`transition-transform ${isOpen ? 'rotate-90' : ''}`}/>
        </button>
        {isDesktop && isOpen && (
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
          <div className="h-[220px] border-t border-[#e5eaf0] sm:h-[280px]">
            <Suspense fallback={<div className="h-full bg-[#eff7fc]" />}>
              <DeliveryMap pickup={pickup} delivery={delivery}/>
            </Suspense>
          </div>
        )}
      </div>
    </>
  )
}

function AddressFields({
  value,
  onChange,
  cepLoading,
  cepError,
}: {
  value: AddressForm
  onChange: (field: keyof AddressForm, value: string) => void
  cepLoading: boolean
  cepError: string
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2 sm:col-span-1">
        <InputField
          label="CEP (opcional)"
          value={value.cep}
          onChange={next => onChange('cep', formatCep(next))}
          placeholder="36000-000"
          inputMode="numeric"
          helperText={cepLoading ? 'Consultando CEP…' : undefined}
          error={cepError || (value.cep && !isValidOptionalCep(value.cep) ? 'Informe os 8 dígitos ou deixe em branco.' : undefined)}
        />
      </div>
      <InputField label="Número" value={value.number} onChange={next => onChange('number', next)} placeholder="123" icon={Home} required/>
      <div className="col-span-2">
        <InputField label="Rua / Avenida" value={value.street} onChange={next => onChange('street', next)} placeholder="Rua Halfeld" required/>
      </div>
      <InputField label="Bairro" value={value.neighborhood} onChange={next => onChange('neighborhood', next)} placeholder="Centro" required/>
      <InputField label="Cidade" value={value.city} onChange={next => onChange('city', next)} placeholder="Juiz de Fora" required/>
      <div className="col-span-2">
        <InputField label="Complemento (opcional)" value={value.complement} onChange={next => onChange('complement', next)} placeholder="Apto 201, bloco B"/>
      </div>
    </div>
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

export default function PublicPortal({
  onGoToLogin,
  token,
  companyOrderMode = false,
  requesterName,
  requesterPhone,
  onGoToDashboard,
}: PublicPortalProps) {
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
  const [pickupAddressSource, setPickupAddressSource] = useState<{ type: 'branch' | 'customer' | 'company'; id?: string } | null>(null)
  const [deliveryAddressSource, setDeliveryAddressSource] = useState<{ type: 'branch' | 'customer' | 'company'; id?: string } | null>(null)
  const [addressSearch, setAddressSearch] = useState('')
  const [addressSuggestions, setAddressSuggestions] = useState<ApiPickupAddressSuggestion[]>([])
  const [addressSearchLoading, setAddressSearchLoading] = useState(false)
  const [addressSearchError, setAddressSearchError] = useState('')
  const [selectedPickupSuggestion, setSelectedPickupSuggestion] = useState<ApiPickupAddressSuggestion | null>(null)
  const [selectedDeliverySuggestion, setSelectedDeliverySuggestion] = useState<ApiPickupAddressSuggestion | null>(null)
  const [manualAddressStep, setManualAddressStep] = useState<number | null>(null)
  const [editingRequester, setEditingRequester] = useState(!requesterName || !requesterPhone)
  const skipPickupCepLookup = useRef(false)
  const skipDeliveryCepLookup = useRef(false)
  const [costCenterId, setCostCenterId] = useState('')
  const [coordinates, setCoordinates] = useState<{ pickup?: { latitude: number; longitude: number }; delivery?: { latitude: number; longitude: number } }>({})
  const [cepLookup, setCepLookup] = useState<{ pickupLoading: boolean; deliveryLoading: boolean; pickupError: string; deliveryError: string }>({
    pickupLoading: false,
    deliveryLoading: false,
    pickupError: '',
    deliveryError: '',
  })
  const defaultRequesterName = requesterName && organization?.company.name &&
    requesterName.trim().localeCompare(organization.company.name.trim(), undefined, { sensitivity: 'base' }) !== 0
    ? requesterName
    : ''

  const setPickupField = (field: keyof AddressForm) => (v: string) => {
    const addressField = field !== 'name' && field !== 'phone'
    if (addressField) {
      if (pickupAddressSource && field !== 'cep') skipPickupCepLookup.current = true
      setPickupAddressSource(null)
      setSelectedPickupSuggestion(null)
      setCoordinates(current => ({ ...current, pickup: undefined }))
    }
    setPickup(p => ({
      ...p,
      [field]: v,
    }))
  }
  const setDropoffField = (field: keyof AddressForm) => (v: string) => {
    if (field !== 'name' && field !== 'phone') {
      if (deliveryAddressSource && field !== 'cep') skipDeliveryCepLookup.current = true
      setDeliveryAddressSource(null)
      setSelectedDeliverySuggestion(null)
      setCoordinates(current => ({ ...current, delivery: undefined }))
    }
    setDropoff(p => ({ ...p, [field]: v }))
  }

  const chooseAddressSuggestion = (suggestion: ApiPickupAddressSuggestion) => {
    const source = {
      type: suggestion.source,
      ...(suggestion.source !== 'company' ? { id: suggestion.id } : {}),
    } as const
    const address = {
      cep: suggestion.address.cep ? formatCep(suggestion.address.cep) : '',
      street: suggestion.address.rua,
      number: suggestion.address.numero,
      neighborhood: suggestion.address.bairro,
      complement: suggestion.address.complemento ?? '',
      city: suggestion.address.cidade || 'Juiz de Fora',
      state: suggestion.address.estado || 'MG',
    }

    if (step === 1) {
      setPickupAddressSource(source)
      setSelectedPickupSuggestion(suggestion)
      setPickup(current => ({ ...current, ...address }))
      setCoordinates(current => ({ ...current, pickup: suggestion.address.coordinates }))
    } else {
      setDeliveryAddressSource(source)
      setSelectedDeliverySuggestion(suggestion)
      setDropoff(current => ({ ...current, ...address }))
      setCoordinates(current => ({ ...current, delivery: suggestion.address.coordinates }))
    }
    setManualAddressStep(null)
    setAddressSearch('')
    setAddressSuggestions([])
    setAddressSearchError('')
  }

  const editAddress = (targetStep: 1 | 2) => {
    setManualAddressStep(targetStep)
  }

  const step1Valid = Boolean(pickup.name.trim() && isValidPhone(pickup.phone) && isValidOptionalCep(pickup.cep) && pickup.street.trim() && pickup.number.trim() && pickup.neighborhood.trim() && pickup.city.trim())
  const step2Valid = Boolean(dropoff.name.trim() && isValidPhone(dropoff.phone) && isValidOptionalCep(dropoff.cep) && dropoff.street.trim() && dropoff.number.trim() && dropoff.neighborhood.trim() && dropoff.city.trim())
  const pickupAddress = { cep: pickup.cep.replace(/\D/g, ''), rua: pickup.street, numero: pickup.number, bairro: pickup.neighborhood, complemento: pickup.complement, cidade: pickup.city, estado: pickup.state, coordinates: coordinates.pickup }
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
    if (pickupAddressSource) {
      setCepLookup(current => ({ ...current, pickupLoading: false, pickupError: '' }))
      return
    }
    if (skipPickupCepLookup.current) {
      skipPickupCepLookup.current = false
      setCepLookup(current => ({ ...current, pickupLoading: false, pickupError: '' }))
      return
    }
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
  }, [pickup.cep, pickupAddressSource])

  useEffect(() => {
    if (deliveryAddressSource) {
      setCepLookup(current => ({ ...current, deliveryLoading: false, deliveryError: '' }))
      return
    }
    if (skipDeliveryCepLookup.current) {
      skipDeliveryCepLookup.current = false
      setCepLookup(current => ({ ...current, deliveryLoading: false, deliveryError: '' }))
      return
    }
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
  }, [dropoff.cep, deliveryAddressSource])

  useEffect(() => {
    if (!companyOrderMode || !token) return
    let active = true
    getCompanyOrganization(token)
      .then(result => {
        if (!active) return
        setOrganization(result.organization)
        const accountNameMatchesCompany = requesterName?.trim().localeCompare(
          result.organization.company.name.trim(),
          undefined,
          { sensitivity: 'base' },
        ) === 0
        if (accountNameMatchesCompany) setEditingRequester(true)
        setPickup(current => ({
          ...current,
          name: current.name || (accountNameMatchesCompany ? '' : requesterName || ''),
          phone: current.phone || (requesterPhone ? formatPhone(requesterPhone) : ''),
        }))
      })
      .catch(error => {
        if (active) setOrganizationError(error instanceof Error ? error.message : 'Não foi possível carregar filiais e centros de custo.')
      })
    return () => { active = false }
  }, [companyOrderMode, requesterName, requesterPhone, token])

  useEffect(() => {
    const query = addressSearch.trim()
    if (!companyOrderMode || !token || step > 2 || query.length < 2) {
      setAddressSuggestions([])
      setAddressSearchLoading(false)
      setAddressSearchError('')
      return
    }

    setAddressSuggestions([])
    setAddressSearchLoading(false)
    let active = true
    const timer = setTimeout(() => {
      setAddressSearchLoading(true)
      setAddressSearchError('')
      searchCompanyPickupAddresses(token, query)
        .then(result => {
          if (active) setAddressSuggestions(result.suggestions)
        })
        .catch(error => {
          if (active) {
            setAddressSearchError(error instanceof Error ? error.message : 'Não foi possível pesquisar os endereços.')
            setAddressSuggestions([])
          }
        })
        .finally(() => {
          if (active) setAddressSearchLoading(false)
        })
    }, 300)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [addressSearch, companyOrderMode, step, token])

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
        coordinates.pickup
          ? coordinates.pickup
          : pickup.street && pickup.neighborhood ? geocodeAddress({ ...newStructuredAddress(), rua: pickup.street, numero: pickup.number, bairro: pickup.neighborhood }) : undefined,
        coordinates.delivery
          ? coordinates.delivery
          : dropoff.street && dropoff.neighborhood ? geocodeAddress({ ...newStructuredAddress(), rua: dropoff.street, numero: dropoff.number, bairro: dropoff.neighborhood }) : undefined,
      ])
      if (active) setCoordinates({ pickup: pickupPoint, delivery: deliveryPoint })
    }, 700)
    return () => { active = false; clearTimeout(timer) }
  }, [pickup.street, pickup.number, pickup.neighborhood, dropoff.street, dropoff.number, dropoff.neighborhood, pickupAddressSource, deliveryAddressSource])

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
        ...(pickupAddressSource?.type === 'branch' && pickupAddressSource.id
          ? { pickupLocationId: pickupAddressSource.id }
          : {}),
        ...(pickupAddressSource?.type === 'customer' && pickupAddressSource.id
          ? { pickupCustomerId: pickupAddressSource.id }
          : {}),
        ...(pickupAddressSource?.type === 'company'
          ? { pickupCompanyAddress: true }
          : {}),
        ...(deliveryAddressSource?.type === 'branch' && deliveryAddressSource.id
          ? { deliveryLocationId: deliveryAddressSource.id }
          : {}),
        ...(deliveryAddressSource?.type === 'customer' && deliveryAddressSource.id
          ? { deliveryCustomerId: deliveryAddressSource.id }
          : {}),
        ...(deliveryAddressSource?.type === 'company'
          ? { deliveryCompanyAddress: true }
          : {}),
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
            onClick={() => {
              setSubmitted(false)
              setStep(1)
              setPickup({
                ...emptyAddress(),
                name: defaultRequesterName,
                phone: requesterPhone ? formatPhone(requesterPhone) : '',
                city: pickup.city,
              })
              setDropoff({ ...emptyAddress(), city: dropoff.city })
              setObservations('')
              setOrderResult(null)
              setPickupAddressSource(null)
              setDeliveryAddressSource(null)
              setSelectedPickupSuggestion(null)
              setSelectedDeliverySuggestion(null)
              setAddressSearch('')
              setAddressSearchError('')
              setAddressSearchLoading(false)
              setAddressSuggestions([])
              setManualAddressStep(null)
              setEditingRequester(!requesterName || !requesterPhone)
              setCoordinates({})
            }}
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
            <section className="mx-auto grid max-w-3xl gap-4 animate-fade-in-up">
              <div className="bg-white rounded-2xl shadow-sm border border-[#e5eaf0] p-4 sm:p-6 flex flex-col gap-4 sm:gap-5">
                <div className="flex items-center gap-3 pb-2 border-b border-[#f1f5f9]">
                  <div className="w-9 h-9 rounded-xl bg-[#fff5eb] flex items-center justify-center">
                    <MapPin size={18} className="text-[#f47b20]"/>
                  </div>
                  <div>
                    <h1 className="text-2xl font-800 text-[#0c225a]">De onde vamos buscar?</h1>
                    <p className="mt-1 text-sm text-[#718096]">
                      {companyOrderMode ? 'Pesquise um cliente cadastrado ou informe um novo endereço.' : 'Informe um novo endereço de retirada.'}
                    </p>
                  </div>
                </div>

                {companyOrderMode && (
                  <div className="relative">
                    <label htmlFor="pickup-address-search" className="mb-1.5 block text-xs font-semibold text-[#64748b]">
                      Endereço de retirada
                    </label>
                    <input
                      id="pickup-address-search"
                      value={addressSearch}
                      onChange={event => setAddressSearch(event.target.value)}
                      placeholder="Digite o nome do cliente ou estabelecimento..."
                      autoComplete="off"
                      maxLength={80}
                      aria-autocomplete="list"
                      aria-expanded={addressSuggestions.length > 0}
                      aria-controls="pickup-address-suggestions"
                      className="mt-1 h-11 w-full rounded-xl border border-[#d8e1eb] bg-white pl-10 pr-4 text-sm text-[#102a43] placeholder:text-[#8a9aab] focus:border-[#39b5ee] focus:outline-none focus:ring-4 focus:ring-[#39b5ee]/10"
                    />
                    <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-[2.4rem] text-[#64748b]"/>
                    {addressSearchLoading && <p className="mt-1 text-xs text-[#718096]">Buscando endereços…</p>}
                    {addressSearchError && <p role="alert" className="mt-1 text-xs text-red-600">{addressSearchError}</p>}
                    {!addressSearchLoading && !addressSearchError && addressSearch.trim().length >= 2 && addressSuggestions.length === 0 && (
                      <p className="mt-1 text-[10px] text-[#718096]">Nenhum endereço encontrado. Você pode preencher manualmente.</p>
                    )}
                    {addressSuggestions.length > 0 && step === 1 && (
                      <ul id="pickup-address-suggestions" className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-[#d8e1eb] bg-white py-1 shadow-lg">
                        {addressSuggestions.map(suggestion => (
                          <li key={`${suggestion.source}:${suggestion.id}`}>
                            <button
                              type="button"
                              onClick={() => chooseAddressSuggestion(suggestion)}
                              className="w-full px-3 py-2.5 text-left hover:bg-[#f4f8fc] focus:bg-[#f4f8fc] focus:outline-none"
                            >
                              <span className="block text-xs font-semibold text-[#0f3266]">
                                {suggestion.name}
                              </span>
                              <span className="mt-0.5 block text-[11px] font-medium text-[#52657f]">
                                {[suggestion.unitName, suggestion.address.cidade].filter(Boolean).join(' · ')}
                              </span>
                              <span className="mt-0.5 block text-[10px] text-[#64748b]">
                                {suggestion.address.rua}, {suggestion.address.numero} · {suggestion.address.bairro}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {selectedPickupSuggestion && manualAddressStep !== 1 ? (
                  <div className="rounded-2xl border border-[#dce8f4] bg-[#f7fafd] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 gap-3">
                        <MapPin size={18} className="mt-0.5 shrink-0 text-[#f47b20]"/>
                        <div>
                          <p className="text-sm font-bold text-[#0f3266]">{selectedPickupSuggestion.name}</p>
                          {selectedPickupSuggestion.unitName && <p className="mt-0.5 text-xs font-medium text-[#52657f]">{selectedPickupSuggestion.unitName}{selectedPickupSuggestion.address.cidade ? ` · ${selectedPickupSuggestion.address.cidade}` : ''}</p>}
                          <p className="mt-1 text-xs leading-relaxed text-[#64748b]">{pickup.street}, {pickup.number}{pickup.complement ? `, ${pickup.complement}` : ''} · {pickup.neighborhood}, {pickup.city}</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => editAddress(1)} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#0f3266] hover:underline">
                        <Pencil size={13}/> Conferir ou editar endereço
                      </button>
                    </div>
                  </div>
                ) : manualAddressStep === 1 ? (
                  <div className="rounded-2xl border border-[#e5eaf0] bg-[#fbfcfe] p-4">
                    <AddressFields value={pickup} onChange={(field, value) => setPickupField(field)(value)} cepLoading={cepLookup.pickupLoading} cepError={cepLookup.pickupError}/>
                  </div>
                ) : (
                  <button type="button" onClick={() => setManualAddressStep(1)} className="text-left text-xs font-semibold text-[#0f3266] underline decoration-[#bfd1e5] underline-offset-4">
                    {companyOrderMode ? 'Não encontrou seu endereço? Informar manualmente.' : 'Informar endereço de retirada manualmente.'}
                  </button>
                )}

                <div className="rounded-2xl border border-[#e2eaf4] bg-[#f3f7fd] p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#dce9fb] text-[#0f3266]"><User size={17}/></div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#0c225a]">Dados do solicitante</p>
                        {editingRequester ? (
                          <p className="mt-0.5 text-[11px] text-[#64748b]">Nome e telefone para contato.</p>
                        ) : (
                          <p className="mt-0.5 truncate text-[11px] text-[#52657f]">{pickup.name} · {pickup.phone}</p>
                        )}
                      </div>
                    </div>
                    <button type="button" onClick={() => setEditingRequester(editing => !editing)} aria-label={editingRequester ? 'Concluir edição dos dados do solicitante' : 'Editar dados do solicitante'} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#0f3266] hover:underline">
                      <Pencil size={13}/>{editingRequester ? 'Concluir' : 'Editar'}
                    </button>
                  </div>
                  {editingRequester && (
                    <div className="mt-3 grid gap-3 border-t border-[#dce5f0] pt-3 sm:grid-cols-2">
                      <InputField label="Nome do solicitante" value={pickup.name} onChange={setPickupField('name')} placeholder="Seu nome" icon={User} required/>
                      <InputField label="Telefone" value={pickup.phone} onChange={value => setPickupField('phone')(formatPhone(value))} placeholder="(32) 99999-0000" icon={Phone} inputMode="tel" required error={pickup.phone && !isValidPhone(pickup.phone) ? 'Informe um telefone com DDD.' : undefined}/>
                    </div>
                  )}
                </div>

                <button
                  disabled={!step1Valid}
                  onClick={() => setStep(2)}
                  className="mt-auto w-full min-h-12 rounded-xl text-sm font-700 flex items-center justify-center gap-2 transition-all enabled:bg-[#ff7a18] enabled:hover:bg-[#e7650b] enabled:text-white enabled:shadow-md enabled:shadow-[#ff7a18]/20 disabled:cursor-not-allowed disabled:border disabled:border-[#e5eaf0] disabled:bg-[#eef2f6] disabled:text-[#64748b]"
                >
                  Continuar para o destino <ArrowRight size={16}/>
                </button>
              </div>

              <ResponsiveDeliveryMap pickup={coordinates.pickup} delivery={coordinates.delivery}/>
            </section>
          )}

          {/* Step 2 — Destino */}
          {step === 2 && (
            <section className="mx-auto grid max-w-3xl gap-4 animate-fade-in-up">
              <div className="bg-white rounded-2xl shadow-sm border border-[#e5eaf0] p-4 sm:p-6 flex flex-col gap-4 sm:gap-5">
                <div className="flex items-center gap-3 pb-2 border-b border-[#f1f5f9]">
                  <div className="w-9 h-9 rounded-xl bg-[#f0f5ff] flex items-center justify-center">
                    <Navigation size={18} className="text-[#0c225a]"/>
                  </div>
                  <div>
                    <h1 className="text-2xl font-800 text-[#0c225a]">Para onde vamos entregar?</h1>
                    <p className="mt-1 text-sm text-[#718096]">
                      {companyOrderMode ? 'Pesquise um endereço cadastrado ou informe um novo endereço.' : 'Informe o endereço de destino.'}
                    </p>
                  </div>
                </div>

                {companyOrderMode && (
                  <div className="relative">
                    <label htmlFor="delivery-address-search" className="mb-1.5 block text-xs font-semibold text-[#64748b]">Buscar cliente, empresa ou endereço</label>
                    <input
                      id="delivery-address-search"
                      value={addressSearch}
                      onChange={event => setAddressSearch(event.target.value)}
                      placeholder="Digite o nome do destinatário ou endereço..."
                      autoComplete="off"
                      maxLength={80}
                      aria-autocomplete="list"
                      aria-expanded={addressSuggestions.length > 0}
                      aria-controls="delivery-address-suggestions"
                      className="h-12 w-full rounded-xl border border-[#d8e1eb] bg-white pl-10 pr-4 text-sm text-[#102a43] placeholder:text-[#8a9aab] focus:border-[#39b5ee] focus:outline-none focus:ring-4 focus:ring-[#39b5ee]/10"
                    />
                    <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-[2.35rem] text-[#64748b]"/>
                    {addressSearchLoading && <p className="mt-2 text-xs text-[#718096]">Buscando endereços…</p>}
                    {addressSearchError && <p role="alert" className="mt-2 text-xs text-red-600">{addressSearchError}</p>}
                    {!addressSearchLoading && !addressSearchError && addressSearch.trim().length >= 2 && addressSuggestions.length === 0 && step === 2 && (
                      <p className="mt-2 text-xs text-[#718096]">Nenhum endereço encontrado. Você pode informar manualmente.</p>
                    )}
                    {addressSuggestions.length > 0 && step === 2 && (
                      <ul id="delivery-address-suggestions" className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-[#d8e1eb] bg-white py-1 shadow-xl">
                        {addressSuggestions.map(suggestion => (
                          <li key={`${suggestion.source}:${suggestion.id}`}>
                            <button type="button" onClick={() => chooseAddressSuggestion(suggestion)} className="w-full px-4 py-3 text-left transition-colors hover:bg-[#f4f8fc] focus:bg-[#f4f8fc] focus:outline-none">
                              <span className="block text-sm font-bold text-[#0f3266]">{suggestion.name}</span>
                              <span className="mt-0.5 block text-xs font-medium text-[#52657f]">{[suggestion.unitName, suggestion.address.cidade].filter(Boolean).join(' · ')}</span>
                              <span className="mt-1 block text-[11px] text-[#64748b]">{suggestion.address.rua}, {suggestion.address.numero} · {suggestion.address.bairro}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {selectedDeliverySuggestion && manualAddressStep !== 2 ? (
                  <div className="rounded-2xl border border-[#dce8f4] bg-[#f7fafd] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 gap-3">
                        <MapPin size={18} className="mt-0.5 shrink-0 text-[#f47b20]"/>
                        <div>
                          <p className="text-sm font-bold text-[#0f3266]">{selectedDeliverySuggestion.name}</p>
                          {selectedDeliverySuggestion.unitName && <p className="mt-0.5 text-xs font-medium text-[#52657f]">{selectedDeliverySuggestion.unitName}{selectedDeliverySuggestion.address.cidade ? ` · ${selectedDeliverySuggestion.address.cidade}` : ''}</p>}
                          <p className="mt-1 text-xs leading-relaxed text-[#64748b]">{dropoff.street}, {dropoff.number}{dropoff.complement ? `, ${dropoff.complement}` : ''} · {dropoff.neighborhood}, {dropoff.city}</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => editAddress(2)} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#0f3266] hover:underline">
                        <Pencil size={13}/> Conferir ou editar endereço
                      </button>
                    </div>
                  </div>
                ) : manualAddressStep === 2 ? (
                  <div className="rounded-2xl border border-[#e5eaf0] bg-[#fbfcfe] p-4">
                    <AddressFields value={dropoff} onChange={(field, value) => setDropoffField(field)(value)} cepLoading={cepLookup.deliveryLoading} cepError={cepLookup.deliveryError}/>
                  </div>
                ) : (
                  <button type="button" onClick={() => setManualAddressStep(2)} className="text-left text-xs font-semibold text-[#0f3266] underline decoration-[#bfd1e5] underline-offset-4">
                    {companyOrderMode ? 'Não encontrou o destinatário? Informar endereço manualmente.' : 'Informar endereço de destino manualmente.'}
                  </button>
                )}

                <div className="grid gap-3 border-t border-[#f1f5f9] pt-5 sm:grid-cols-2">
                  <InputField label="Nome do destinatário" value={dropoff.name} onChange={setDropoffField('name')} placeholder="Nome de quem recebe" icon={User} required/>
                  <InputField label="Telefone do destinatário" value={dropoff.phone} onChange={value => setDropoffField('phone')(formatPhone(value))} placeholder="(32) 98888-0000" icon={Phone} inputMode="tel" required error={dropoff.phone && !isValidPhone(dropoff.phone) ? 'Informe um telefone com DDD.' : undefined}/>
                </div>

                <div className="flex gap-3 mt-auto">
                  <button
                    onClick={() => { setStep(1); setAddressSearch(''); setAddressSuggestions([]) }}
                    className="min-h-12 px-5 rounded-xl text-sm font-600 border border-[#e5eaf0] text-[#52657f] hover:bg-[#f7f9fc] transition-colors flex items-center gap-1.5"
                  >
                    <ArrowLeft size={15}/> Voltar
                  </button>
                  <button
                    disabled={!step2Valid}
                    onClick={() => { setStep(3); setAddressSearch(''); setAddressSuggestions([]) }}
                    className="flex-1 min-h-12 rounded-xl text-sm font-700 flex items-center justify-center gap-2 transition-all enabled:bg-[#0f3266] enabled:hover:bg-[#17447f] enabled:text-white disabled:cursor-not-allowed disabled:border disabled:border-[#e5eaf0] disabled:bg-[#eef2f6] disabled:text-[#64748b]"
                  >
                    Continuar para o resumo <ArrowRight size={16}/>
                  </button>
                </div>
              </div>

              <ResponsiveDeliveryMap pickup={coordinates.pickup} delivery={coordinates.delivery}/>
            </section>
          )}

          {/* Step 3 — Resumo */}
          {step === 3 && (
            <section className="mx-auto grid max-w-3xl gap-4 animate-fade-in-up">
              <div className="flex flex-col gap-4">
                {/* Price card */}
                <div className="bg-gradient-to-br from-[#0c225a] to-[#163690] rounded-2xl p-6 text-white">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-500 uppercase tracking-wide text-white/70">Valor total da entrega</span>
                    <span className="text-xs font-500 bg-white/15 px-2.5 py-1 rounded-full">{pricingLoading ? 'Consultando...' : pricingError ? 'Preço indisponível' : pricingResult?.success ? pricingResult.priceTable ?? 'Valor sob consulta' : 'Consultar valor'}</span>
                  </div>
                  <div className={`font-800 text-[#f47b20] ${pricingResult?.success && pricingResult.pricingType === 'RANGE' ? 'text-2xl' : 'text-4xl'}`}>{priceLabel}</div>
                  <p className="text-xs text-white/70 mt-1">{pricingError || 'Quando não houver tarifa cadastrada, o valor será consultado.'}</p>
                </div>

                {/* Pickup summary */}
                <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#f47b20] text-white text-xs font-700 flex items-center justify-center">A</div>
                    <span className="text-sm font-700 text-[#0c225a]">Retirada</span>
                    </div>
                    <button type="button" onClick={() => setStep(1)} className="inline-flex items-center gap-1 text-xs font-semibold text-[#0f3266] hover:underline"><Pencil size={13}/> Editar retirada</button>
                  </div>
                  <SummaryRow label="Solicitante" value={pickup.name}/>
                  <SummaryRow label="Telefone" value={pickup.phone}/>
                  <SummaryRow label="Endereço" value={`${pickup.street}, ${pickup.number}`}/>
                  <SummaryRow label="Bairro" value={pickup.neighborhood}/>
                  <SummaryRow label="Cidade / CEP" value={`${pickup.city} / ${pickup.state}${pickup.cep ? ` — ${pickup.cep}` : ''}`}/>
                  {pickup.complement && <SummaryRow label="Complemento" value={pickup.complement}/>}
                </div>

                {/* Dropoff summary */}
                <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#0c225a] text-white text-xs font-700 flex items-center justify-center">B</div>
                    <span className="text-sm font-700 text-[#0c225a]">Entrega</span>
                    </div>
                    <button type="button" onClick={() => setStep(2)} className="inline-flex items-center gap-1 text-xs font-semibold text-[#0f3266] hover:underline"><Pencil size={13}/> Editar destino</button>
                  </div>
                  <SummaryRow label="Destinatário" value={dropoff.name}/>
                  <SummaryRow label="Telefone" value={dropoff.phone}/>
                  <SummaryRow label="Endereço" value={`${dropoff.street}, ${dropoff.number}`}/>
                  <SummaryRow label="Bairro" value={dropoff.neighborhood}/>
                  <SummaryRow label="Cidade / CEP" value={`${dropoff.city}${dropoff.cep ? ` — ${dropoff.cep}` : ''}`}/>
                  {dropoff.complement && <SummaryRow label="Complemento" value={dropoff.complement}/>}
                </div>

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
                    onClick={() => { setStep(2); setAddressSearch(''); setAddressSuggestions([]) }}
                    className="h-12 px-5 rounded-xl text-sm font-600 border border-[#e2e8f0] text-[#64748b] hover:bg-[#f4f6fa] transition-colors flex items-center gap-1.5"
                  >
                    <ArrowLeft size={15}/> Voltar
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={saving || pricingLoading || !pricingResult?.success || !step1Valid || !step2Valid}
                    className="flex-1 min-h-12 rounded-xl text-sm font-700 flex items-center justify-center gap-2.5 bg-[#ff7a18] hover:bg-[#e7650b] text-white transition-all shadow-lg shadow-[#ff7a18]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Check size={17}/>
                    {saving ? 'Registrando pedido...' : 'CONFIRMAR SOLICITAÇÃO'}
                  </button>
                </div>
                {saveError && <p className="text-sm text-red-600" role="alert">{saveError}</p>}
              </div>

              <ResponsiveDeliveryMap pickup={coordinates.pickup} delivery={coordinates.delivery}/>
            </section>
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
