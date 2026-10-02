interface MapViewProps {
  showPickup?: boolean
  showDropoff?: boolean
  label?: string
}

export default function MapView({ showPickup, showDropoff }: MapViewProps) {
  return (
    <div className="relative w-full h-full overflow-hidden rounded-2xl" style={{ background: '#e8eff5', minHeight: 320 }}>
      {/* Map SVG background */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice">
        <rect width="600" height="400" fill="#e8eff5"/>
        {/* Green parks */}
        <ellipse cx="480" cy="300" rx="80" ry="55" fill="#c8ddb8" opacity="0.9"/>
        <rect x="20" y="30" width="100" height="60" rx="4" fill="#c8ddb8" opacity="0.8"/>
        {/* Water */}
        <path d="M0 250 Q150 230 300 260 Q450 290 600 270 L600 400 L0 400Z" fill="#b8d4e8" opacity="0.5"/>
        {/* Blocks */}
        <rect x="50" y="110" width="80" height="50" rx="3" fill="#d0d8e4" opacity="0.9"/>
        <rect x="50" y="170" width="80" height="40" rx="3" fill="#d0d8e4" opacity="0.9"/>
        <rect x="160" y="110" width="60" height="45" rx="3" fill="#d0d8e4" opacity="0.9"/>
        <rect x="160" y="170" width="60" height="45" rx="3" fill="#d0d8e4" opacity="0.9"/>
        <rect x="240" y="80" width="90" height="55" rx="3" fill="#d0d8e4" opacity="0.9"/>
        <rect x="240" y="150" width="90" height="50" rx="3" fill="#d0d8e4" opacity="0.9"/>
        <rect x="350" y="100" width="70" height="45" rx="3" fill="#d0d8e4" opacity="0.9"/>
        <rect x="350" y="155" width="70" height="45" rx="3" fill="#d0d8e4" opacity="0.9"/>
        <rect x="80" y="280" width="100" height="45" rx="3" fill="#d0d8e4" opacity="0.9"/>
        <rect x="200" y="280" width="85" height="45" rx="3" fill="#d0d8e4" opacity="0.9"/>
        <rect x="300" y="280" width="70" height="45" rx="3" fill="#d0d8e4" opacity="0.9"/>
        {/* Main roads */}
        <rect x="0" y="95" width="600" height="14" fill="white" opacity="0.95"/>
        <rect x="0" y="230" width="600" height="16" fill="white" opacity="0.95"/>
        <rect x="0" y="265" width="600" height="10" fill="white" opacity="0.9"/>
        {/* Vertical roads */}
        <rect x="135" y="0" width="14" height="400" fill="white" opacity="0.95"/>
        <rect x="225" y="0" width="10" height="400" fill="white" opacity="0.9"/>
        <rect x="430" y="0" width="14" height="400" fill="white" opacity="0.95"/>
        {/* Diagonal road */}
        <line x1="0" y1="380" x2="500" y2="40" stroke="white" strokeWidth="12" opacity="0.85"/>
        {/* Road labels */}
        <text x="30" y="90" fontSize="8" fill="#8899aa" fontFamily="Outfit,sans-serif">Av. Rio Branco</text>
        <text x="140" y="180" fontSize="8" fill="#8899aa" fontFamily="Outfit,sans-serif" transform="rotate(90 140 180)">Rua Halfeld</text>
      </svg>

      {/* Pickup marker */}
      {showPickup && (
        <div className="absolute" style={{ top: '28%', left: '22%', transform: 'translate(-50%, -100%)' }}>
          <div className="relative flex flex-col items-center">
            <div
              className="w-9 h-9 rounded-full border-2 border-white shadow-xl flex items-center justify-center text-white text-xs font-bold z-10 relative"
              style={{ background: '#f47b20' }}
            >
              A
            </div>
            <div className="w-0.5 h-3 bg-[#f47b20]/60"/>
            <div className="w-1 h-1 rounded-full bg-[#f47b20]/40"/>
            {/* Pulse ring */}
            <div className="absolute top-0 left-0 w-9 h-9 rounded-full border-2 border-[#f47b20] animate-ping opacity-30"/>
          </div>
          <div className="mt-1 bg-white text-[#0c225a] text-[10px] font-semibold px-2 py-0.5 rounded shadow whitespace-nowrap">
            Coleta
          </div>
        </div>
      )}

      {/* Dropoff marker */}
      {showDropoff && (
        <div className="absolute" style={{ top: '58%', left: '72%', transform: 'translate(-50%, -100%)' }}>
          <div className="relative flex flex-col items-center">
            <div
              className="w-9 h-9 rounded-full border-2 border-white shadow-xl flex items-center justify-center text-white text-xs font-bold z-10 relative"
              style={{ background: '#0c225a' }}
            >
              B
            </div>
            <div className="w-0.5 h-3 bg-[#0c225a]/60"/>
            <div className="w-1 h-1 rounded-full bg-[#0c225a]/40"/>
            <div className="absolute top-0 left-0 w-9 h-9 rounded-full border-2 border-[#0c225a] animate-ping opacity-30"/>
          </div>
          <div className="mt-1 bg-white text-[#0c225a] text-[10px] font-semibold px-2 py-0.5 rounded shadow whitespace-nowrap">
            Entrega
          </div>
        </div>
      )}

      {/* Route line */}
      {showPickup && showDropoff && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <path
            d="M 133 112 Q 300 80 432 232"
            stroke="#f47b20"
            strokeWidth="3"
            strokeDasharray="6 4"
            fill="none"
            opacity="0.7"
          />
        </svg>
      )}

      {/* Map controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-1 z-20">
        <button className="w-7 h-7 bg-white rounded shadow-md flex items-center justify-center text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors">+</button>
        <button className="w-7 h-7 bg-white rounded shadow-md flex items-center justify-center text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors">−</button>
      </div>

      {/* Attribution */}
      <div className="absolute bottom-2 left-2 text-[9px] text-gray-400 bg-white/80 px-1.5 py-0.5 rounded">
        Procópio Express Maps • Juiz de Fora, MG
      </div>
    </div>
  )
}
