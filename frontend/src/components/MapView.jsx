import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { CheckCircle2 } from 'lucide-react';
import { APP_CONFIG } from '../config';

// Custom Marker HTML Generators
function createFloodIcon(pin) {
  const isCompound = pin.compoundHazardNearby;
  const isConfirmed = pin.status === 'confirmed' || pin.confirmedBy >= 2;

  const bgClass = isCompound
    ? 'bg-red-600 text-white critical-pulse-marker'
    : isConfirmed
    ? 'bg-blue-700 text-white'
    : 'bg-sky-500 text-white';

  const isSample = !!pin.isSampleData;
  const html = `
    <div class="relative flex flex-col items-center">
      <div class="w-8 h-8 rounded-full ${bgClass} flex items-center justify-center shadow-lg border-2 ${isSample ? 'border-dashed border-violet-300 opacity-80' : 'border-white'} transition-transform hover:scale-110">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 fill-current" viewBox="0 0 24 24">
          <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
        </svg>
      </div>
      <div class="mt-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${isSample ? 'bg-violet-700' : 'bg-neutral-900/90'} text-white shadow whitespace-nowrap">
        ${isSample ? 'SAMPLE · ' : ''}${pin.level ? pin.level.toUpperCase() : 'FLOOD'} · ${pin.ageMinutes !== undefined ? pin.ageMinutes + 'm' : 'NEW'}
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-flood-pin',
    iconSize: [40, 52],
    iconAnchor: [20, 26]
  });
}

function createHazardIcon(pin) {
  const isOld = pin.isOldUnverified;
  const bgClass = isOld
    ? 'bg-neutral-400 text-neutral-800 border-neutral-300'
    : 'bg-amber-500 text-neutral-950 border-white';

  const label = pin.hazardType === 'missing_manhole'
    ? 'MANHOLE'
    : pin.hazardType === 'deep_pothole'
    ? 'POTHOLE'
    : 'DRAIN';

  const isSample = !!pin.isSampleData;
  const html = `
    <div class="relative flex flex-col items-center">
      <div class="w-8 h-8 rounded-md ${bgClass} flex items-center justify-center shadow-md border-2 ${isSample ? 'border-dashed !border-violet-500 opacity-80' : ''} transition-transform hover:scale-110">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <div class="mt-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${isSample ? 'bg-violet-700 text-white' : isOld ? 'bg-neutral-600 text-neutral-200' : 'bg-neutral-900/90 text-amber-300'} shadow whitespace-nowrap">
        ${isSample ? 'SAMPLE · ' : ''}${label} ${isOld ? '(OLD)' : ''}
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-hazard-pin',
    iconSize: [40, 50],
    iconAnchor: [20, 25]
  });
}

function createPointIcon(type) {
  const color = type === 'start' ? 'bg-emerald-600' : 'bg-rose-600';
  const label = type === 'start' ? 'A' : 'B';
  const html = `
    <div class="w-6 h-6 rounded-full ${color} text-white font-bold font-mono text-xs flex items-center justify-center shadow-md border-2 border-white">
      ${label}
    </div>
  `;
  return L.divIcon({
    html,
    className: 'route-point-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
}

// Map Click Listener component
function MapEvents({ onMapClick }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng);
    }
  });
  return null;
}

export default function MapView({
  pins,
  routeCoordinates,
  startPoint,
  endPoint,
  onMapClick,
  onSelectHazardPin,
  mapCenter = APP_CONFIG.DEFAULT_MAP_CENTER
}) {
  return (
    <div className="relative w-full h-[520px] lg:h-[620px] rounded-xl overflow-hidden border border-wmd-border shadow-sm">
      <MapContainer
        center={mapCenter}
        zoom={APP_CONFIG.DEFAULT_ZOOM}
        scrollWheelZoom={true}
        className="w-full h-full z-10"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapEvents onMapClick={onMapClick} />

        {/* Start and End Markers */}
        {startPoint && (
          <Marker position={[startPoint.lat, startPoint.lng]} icon={createPointIcon('start')}>
            <Popup>
              <div className="text-xs font-mono font-bold">Start Point (A)</div>
            </Popup>
          </Marker>
        )}

        {endPoint && (
          <Marker position={[endPoint.lat, endPoint.lng]} icon={createPointIcon('end')}>
            <Popup>
              <div className="text-xs font-mono font-bold">End Point (B)</div>
            </Popup>
          </Marker>
        )}

        {/* Route Polyline */}
        {routeCoordinates && routeCoordinates.length > 1 && (
          <Polyline
            positions={routeCoordinates.map((p) => [p.lat, p.lng])}
            pathOptions={{
              color: '#0071ce',
              weight: 5,
              opacity: 0.85,
              dashArray: '1, 10',
              lineCap: 'round'
            }}
          />
        )}

        {/* Active Pins */}
        {pins.map((pin) => {
          const isFlood = pin.type === 'flood';
          const icon = isFlood ? createFloodIcon(pin) : createHazardIcon(pin);

          return (
            <Marker
              key={pin.id || pin.SK}
              position={[pin.lat, pin.lng]}
              icon={icon}
              eventHandlers={{
                click: () => {
                  if (!isFlood && onSelectHazardPin) {
                    onSelectHazardPin(pin);
                  }
                }
              }}
            >
              <Popup>
                <div className="p-1 space-y-1.5 text-xs">
                  {pin.isSampleData && (
                    <div className="bg-violet-100 text-violet-800 border border-violet-300 rounded px-1.5 py-1 text-[10px] font-mono font-bold">
                      SAMPLE DATA: not a real report
                    </div>
                  )}
                  {isFlood ? (
                    <>
                      <div className="flex items-center justify-between gap-2 border-b pb-1 font-mono font-bold">
                        <span className="text-sky-700">FLOOD REPORT</span>
                        <span className="text-neutral-500 font-normal">
                          {pin.ageMinutes !== undefined ? `${pin.ageMinutes} min ago` : 'Active'}
                        </span>
                      </div>
                      <div className="font-semibold text-neutral-800">
                        Observed Depth: <span className="uppercase text-sky-600">{pin.level}</span>
                      </div>
                      {pin.status === 'confirmed' || pin.confirmedBy >= 2 ? (
                        <div className="flex items-center gap-1 text-[11px] text-status-green font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Confirmed by 2+ independent reports</span>
                        </div>
                      ) : (
                        <div className="text-[11px] text-neutral-500">
                          Single report. Confirming with nearby data.
                        </div>
                      )}
                      {pin.compoundHazardNearby && (
                        <div className="bg-red-50 text-red-700 p-1.5 rounded text-[11px] font-semibold border border-red-200">
                          ⚠️ Known drain/hazard within {APP_CONFIG.COMPOUND_DANGER_RADIUS_METERS}m. Water may be hiding it.
                        </div>
                      )}
                      <p className="text-[10px] text-neutral-400 italic pt-1">
                        Hidden from the map {APP_CONFIG.FLOOD_PIN_LIFETIME_MINUTES} min after the report.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2 border-b pb-1 font-mono font-bold">
                        <span className="text-amber-700 uppercase">
                          {pin.hazardType?.replace('_', ' ')}
                        </span>
                        {pin.isOldUnverified && (
                          <span className="bg-neutral-200 text-neutral-700 px-1 rounded text-[10px]">
                            Old (&gt;60d)
                          </span>
                        )}
                      </div>
                      <p className="text-neutral-700 text-xs">{pin.description || 'Reported dry-day street hazard.'}</p>
                      <div className="text-[10px] text-neutral-500 flex items-center justify-between pt-1">
                        <span>Fixed votes: {pin.fixedVotes || 0}/2</span>
                        <button
                          onClick={() => onSelectHazardPin && onSelectHazardPin(pin)}
                          className="text-aws-blue hover:underline font-semibold"
                        >
                          Verify Status →
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Map Legend Overlay */}
      <div className="absolute bottom-3 left-3 z-20 bg-white/95 backdrop-blur-sm p-2.5 rounded-lg border border-wmd-border shadow-md text-xs font-mono space-y-1.5 max-w-[240px]">
        <div className="font-bold text-neutral-800 text-[11px] border-b pb-1 flex items-center justify-between">
          <span>MAP LAYERS</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-sky-500"></span>
          <span className="text-neutral-700">Flood (hidden after 45 min)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-amber-500"></span>
          <span className="text-neutral-700">Open Drain / Hazard</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-neutral-400"></span>
          <span className="text-neutral-500">Old Hazard (&gt;60 days)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded border-2 border-dashed border-violet-600 bg-violet-100"></span>
          <span className="text-violet-700">Sample data (not real)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-600 animate-pulse"></span>
          <span className="text-red-700 font-semibold">Submerged Hazard (50m)</span>
        </div>
      </div>
    </div>
  );
}
