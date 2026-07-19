// =====================================================================
// PREI | MapPicker — Leaflet/Carto ile pin-bırak konum seçici + arama.
// - Carto Voyager tile: etiketler Latin/uluslararası (OSM varsayılanı yerel
//   alfabe gösteriyordu — BAE'de Arapça çıkıyordu, Onur istemedi).
// - Arama: Nominatim (OSM geocoder, ücretsiz, anahtar gerekmez). Sonuç
//   seçilince harita oraya uçar; kişi tıklayıp pin bırakır.
// - focus prop'u değişince harita otomatik oraya uçar (şehir/ilçe/mahalle
//   alanlarından tetiklenir).
// =====================================================================
import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useTranslation } from 'react-i18next';
import { MagnifyingGlass } from '@phosphor-icons/react';
import 'leaflet/dist/leaflet.css';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import styles from './MapPicker.module.css';

L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

export interface MapFocus { lat: number; lng: number; zoom?: number }

interface GeoResult { display_name: string; lat: string; lon: string }

/** Nominatim ile serbest metin konum araması (ücretsiz OSM geocoder). */
export async function geocode(query: string, lang: string): Promise<GeoResult[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&accept-language=${lang}&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return [];
  return (await res.json()) as GeoResult[];
}

const ClickHandler: React.FC<{ onPick: (lat: number, lng: number) => void }> = ({ onPick }) => {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
};

/** focus değişince haritayı oraya uçurur. */
const FlyTo: React.FC<{ focus: MapFocus | null }> = ({ focus }) => {
  const map = useMap();
  useEffect(() => {
    if (focus) map.flyTo([focus.lat, focus.lng], focus.zoom ?? 14, { duration: 0.8 });
  }, [focus, map]);
  return null;
};

interface MapPickerProps {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
  /** Dış alanlardan (şehir/ilçe/mahalle) gelen odak isteği. */
  focus?: MapFocus | null;
}

export const MapPicker: React.FC<MapPickerProps> = ({ lat, lng, onPick, focus = null }) => {
  const { t, i18n } = useTranslation();
  const hasPin = lat != null && lng != null;
  const center: [number, number] = hasPin ? [lat!, lng!] : [25.2048, 55.2708]; // Dubai varsayılan

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchFocus, setSearchFocus] = useState<MapFocus | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = async (q: string) => {
    if (q.trim().length < 3) { setResults([]); return; }
    setSearching(true);
    try {
      setResults(await geocode(q.trim(), i18n.language?.startsWith('en') ? 'en' : 'tr'));
    } finally {
      setSearching(false);
    }
  };

  const onQueryChange = (v: string) => {
    setQuery(v);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => void runSearch(v), 600);
  };

  const selectResult = (r: GeoResult) => {
    const f = { lat: Number(r.lat), lng: Number(r.lon), zoom: 15 };
    setSearchFocus(f);
    setResults([]);
    setQuery(r.display_name.split(',').slice(0, 2).join(','));
  };

  const effectiveFocus = searchFocus ?? focus;

  return (
    <div className={styles.wrap}>
      <div className={styles.searchBox}>
        <MagnifyingGlass size={15} className={styles.searchIcon} />
        <input
          className={styles.searchInput}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t('intake.form.mapSearchPh')}
        />
        {searching && <span className={styles.searchBusy}>…</span>}
        {results.length > 0 && (
          <ul className={styles.results}>
            {results.map((r, i) => (
              <li key={i}>
                <button type="button" className={styles.resultBtn} onClick={() => selectResult(r)}>
                  {r.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <MapContainer
        center={center}
        zoom={hasPin ? 14 : 4}
        style={{ height: 300, width: '100%', borderRadius: 8, zIndex: 0 }}
        scrollWheelZoom
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap &copy; CARTO'
        />
        <ClickHandler onPick={onPick} />
        <FlyTo focus={effectiveFocus} />
        {hasPin && <Marker position={[lat!, lng!]} />}
      </MapContainer>
    </div>
  );
};
