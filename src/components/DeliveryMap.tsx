import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Coordinates } from '../services/address';

type Props = { pickup?: Coordinates; delivery?: Coordinates };

const defaultCenter: L.LatLngExpression = [-21.7642, -43.3503];

export function DeliveryMap({ pickup, delivery }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, { zoomControl: true, attributionControl: true }).setView(defaultCenter, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
    const points: Array<{ coordinates: Coordinates; label: string; color: string }> = [];
    if (pickup) points.push({ coordinates: pickup, label: 'Coleta', color: '#1769e0' });
    if (delivery) points.push({ coordinates: delivery, label: 'Entrega', color: '#f47c3c' });
    points.forEach(point => {
      const marker = L.circleMarker([point.coordinates.latitude, point.coordinates.longitude], {
        radius: 9,
        color: '#fff',
        weight: 3,
        fillColor: point.color,
        fillOpacity: 1,
      }).addTo(map).bindTooltip(point.label, { direction: 'top', offset: [0, -8] });
      markersRef.current.push(marker);
    });
    if (points.length === 2) {
      map.fitBounds(L.latLngBounds(points.map(point => [point.coordinates.latitude, point.coordinates.longitude])), { padding: [35, 35] });
    } else if (points.length === 1) {
      map.setView([points[0].coordinates.latitude, points[0].coordinates.longitude], 15);
    } else {
      map.setView(defaultCenter, 13);
    }
  }, [pickup?.latitude, pickup?.longitude, delivery?.latitude, delivery?.longitude]);

  return <div className="map-wrap"><div ref={ref} className="delivery-map" /><p className="map-provider">Mapa gratuito via OpenStreetMap</p>{(!pickup || !delivery) && <p className="map-warning">Complete os endereços para exibir os dois pontos.</p>}<div className="map-actions"><MapStatus color="blue" found={!!pickup} label="Coleta" /><MapStatus color="orange" found={!!delivery} label="Entrega" /></div></div>;
}

function MapStatus({ color, found, label }: { color: 'blue' | 'orange'; found: boolean; label: string }) {
  return <div className="map-status"><i className={color} /> <span className={found ? 'located' : 'map-warning'}>{found ? `${label} localizada` : `${label} aguardando endereço`}</span></div>;
}
