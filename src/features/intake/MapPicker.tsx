// =====================================================================
// PREI | MapPicker — Leaflet/OpenStreetMap ile pin-bırak konum seçici.
// Geliştirici haritaya tıklar → koordinat (lat/lng) alınır. Ücretsiz OSM
// tile'ları (API anahtarı yok). Marker ikon varlıkları Vite ile paketlenir
// (kendi origin'imizden servis edilir → CSP/404 sorunu yok).
// =====================================================================
import React from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

const ClickHandler: React.FC<{ onPick: (lat: number, lng: number) => void }> = ({ onPick }) => {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
};

interface MapPickerProps {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
}

export const MapPicker: React.FC<MapPickerProps> = ({ lat, lng, onPick }) => {
  const hasPin = lat != null && lng != null;
  const center: [number, number] = hasPin ? [lat!, lng!] : [25.2048, 55.2708]; // Dubai varsayılan

  return (
    <MapContainer
      center={center}
      zoom={hasPin ? 14 : 4}
      style={{ height: 300, width: '100%', borderRadius: 8, zIndex: 0 }}
      scrollWheelZoom
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap'
      />
      <ClickHandler onPick={onPick} />
      {hasPin && <Marker position={[lat!, lng!]} />}
    </MapContainer>
  );
};
