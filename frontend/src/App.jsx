import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import DisclaimerBanner from './components/DisclaimerBanner';
import MapView from './components/MapView';
import RouteChecker from './components/RouteChecker';
import ReportFloodModal from './components/ReportFloodModal';
import ReportHazardModal from './components/ReportHazardModal';
import HazardDetailModal from './components/HazardDetailModal';
import FooterSafety from './components/FooterSafety';
import { api } from './utils/api';
import { APP_CONFIG } from './config';
import { fetchRoadRoute } from './utils/fetchRoute';
import { Droplets, Layers, MapPin, RefreshCw, ShieldAlert, WifiOff } from 'lucide-react';

export default function App() {
  const [pins, setPins] = useState([]);
  const [isLoadingPins, setIsLoadingPins] = useState(true);
  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [isLiveApi, setIsLiveApi] = useState(api.isConfiguredWithLiveApi());

  const [isFloodModalOpen, setIsFloodModalOpen] = useState(false);
  const [isHazardModalOpen, setIsHazardModalOpen] = useState(false);
  const [selectedHazard, setSelectedHazard] = useState(null);
  const [clickCoord, setClickCoord] = useState({ lat: APP_CONFIG.DEFAULT_MAP_CENTER[0], lng: APP_CONFIG.DEFAULT_MAP_CENTER[1] });

  const loadPins = async () => {
    setIsLoadingPins(true);
    try {
      const data = await api.getPins(APP_CONFIG.DEFAULT_CITY);
      setPins(data);
      setIsLiveApi(api.isLiveConnected());
    } catch (err) {
      console.error("Failed to load pins:", err);
      setIsLiveApi(false);
    } finally {
      setIsLoadingPins(false);
    }
  };

  useEffect(() => {
    loadPins();
    const interval = setInterval(loadPins, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleMapClick = async (latlng) => {
    setClickCoord(latlng);
    if (!startPoint) {
      setStartPoint(latlng);
    } else if (!endPoint) {
      setEndPoint(latlng);
      try {
        const route = await fetchRoadRoute(startPoint, latlng);
        if (route.success) {
          setRouteCoordinates(route.waypoints);
        }
      } catch (err) {
        console.warn("Road routing error:", err.message);
      }
    }
  };

  const handleLoadPresetRoute = async () => {
    const start = { lat: 28.7470, lng: 77.1235 };
    const end = { lat: 28.7545, lng: 77.1130 };
    setStartPoint(start);
    setEndPoint(end);
    try {
      const route = await fetchRoadRoute(start, end);
      if (route.success) {
        setRouteCoordinates(route.waypoints);
      }
    } catch (err) {
      console.warn("Preset road route failed:", err.message);
    }
  };

  const handleClearRoute = () => {
    setStartPoint(null);
    setEndPoint(null);
    setRouteCoordinates([]);
  };

  const handleResetData = () => {
    const fresh = api.resetSampleData();
    setPins(fresh);
    handleClearRoute();
  };

  const floodCount = pins.filter((p) => p.type === 'flood').length;
  const hazardCount = pins.filter((p) => p.type === 'hazard').length;
  const sampleCount = pins.filter((p) => p.isSampleData).length;
  const realCount = pins.length - sampleCount;

  return (
    <div className="min-h-screen flex flex-col bg-wmd-bg text-neutral-900 font-sans">
      {!isLiveApi && (
        <div className="bg-amber-400 text-neutral-950 font-mono text-xs px-4 py-2 font-bold text-center border-b border-amber-500 flex items-center justify-center gap-2">
          <WifiOff className="w-4 h-4 text-neutral-950" />
          <span>OFFLINE DEMO MODE: Backend API disconnected. Running on local verified sample data. AI analysis will report offline.</span>
        </div>
      )}

      <Navbar
        onOpenReportFlood={() => setIsFloodModalOpen(true)}
        onOpenReportHazard={() => setIsHazardModalOpen(true)}
        onResetData={handleResetData}
      />

      <DisclaimerBanner />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="bg-white p-3 rounded-xl border border-wmd-border shadow-sm flex items-center justify-between">
            <div>
              <span className="text-neutral-500 uppercase text-[10px]">Active Floods</span>
              <div className="text-base font-bold text-sky-700">{floodCount} spots</div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <Droplets className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-wmd-border shadow-sm flex items-center justify-between">
            <div>
              <span className="text-neutral-500 uppercase text-[10px]">Known Drains</span>
              <div className="text-base font-bold text-amber-700">{hazardCount} hazards</div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-wmd-border shadow-sm flex items-center justify-between">
            <div>
              <span className="text-neutral-500 uppercase text-[10px]">Data Integrity</span>
              <div className="text-xs font-bold text-neutral-800">
                {realCount} Real · {sampleCount} Sample
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-neutral-100 text-neutral-700 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-wmd-border shadow-sm flex items-center justify-between">
            <div>
              <span className="text-neutral-500 uppercase text-[10px]">Decay Policy</span>
              <div className="text-base font-bold text-emerald-700">Strict 45m</div>
            </div>
            <button
              onClick={loadPins}
              title="Refresh active pins"
              className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex items-center justify-center transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingPins ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 font-bold font-mono text-neutral-700 uppercase">
                <MapPin className="w-4 h-4 text-aws-blue" />
                <span>TELEMETRY MAP ({APP_CONFIG.DEFAULT_CITY.toUpperCase()})</span>
              </div>
              <span className="text-neutral-400 font-mono text-[11px]">
                Tap anywhere to set Point A & B
              </span>
            </div>

            <MapView
              pins={pins}
              routeCoordinates={routeCoordinates}
              startPoint={startPoint}
              endPoint={endPoint}
              onMapClick={handleMapClick}
              onSelectHazardPin={(h) => setSelectedHazard(h)}
              mapCenter={APP_CONFIG.DEFAULT_MAP_CENTER}
            />
          </div>

          <div className="lg:col-span-5 space-y-4">
            <RouteChecker
              pins={pins}
              startPoint={startPoint}
              endPoint={endPoint}
              onSetStart={setStartPoint}
              onSetEnd={setEndPoint}
              onClearRoute={handleClearRoute}
              onLoadPresetRoute={handleLoadPresetRoute}
              routeCoordinates={routeCoordinates}
              setRouteCoordinates={setRouteCoordinates}
            />
          </div>
        </div>
      </main>

      <ReportFloodModal
        isOpen={isFloodModalOpen}
        onClose={() => setIsFloodModalOpen(false)}
        defaultCoords={clickCoord}
        onReportCreated={() => {
          loadPins();
          alert("Flood pin published! Visible on map for the next 45 minutes.");
        }}
      />

      <ReportHazardModal
        isOpen={isHazardModalOpen}
        onClose={() => setIsHazardModalOpen(false)}
        defaultCoords={clickCoord}
        onHazardCreated={() => {
          loadPins();
          alert("Dry-day hazard saved to persistent layer.");
        }}
      />

      <HazardDetailModal
        hazard={selectedHazard}
        onClose={() => setSelectedHazard(null)}
        onVoteCast={loadPins}
      />

      <FooterSafety />
    </div>
  );
}