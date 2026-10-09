import React, { useState, useEffect, useRef } from 'react';
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
import { Droplets, Layers, MapPin, RefreshCw, ShieldAlert, WifiOff, AlertTriangle, CheckCircle2, X } from 'lucide-react';

export default function App() {
  const [pins, setPins] = useState([]);
  const [isLoadingPins, setIsLoadingPins] = useState(true);
  const [connection, setConnection] = useState(api.getConnectionState());
  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const [isFloodModalOpen, setIsFloodModalOpen] = useState(false);
  const [isHazardModalOpen, setIsHazardModalOpen] = useState(false);
  const [selectedHazard, setSelectedHazard] = useState(null);
  const [clickCoord, setClickCoord] = useState({
    lat: APP_CONFIG.DEFAULT_MAP_CENTER[0],
    lng: APP_CONFIG.DEFAULT_MAP_CENTER[1]
  });

  const showToast = (type, text) => {
    setToast({ type, text });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 7000);
  };

  const loadPins = async () => {
    setIsLoadingPins(true);
    try {
      const data = await api.getPins(APP_CONFIG.DEFAULT_CITY);
      setPins(data);
    } catch (err) {
      console.error('Failed to load pins:', err);
    } finally {
      setConnection(api.getConnectionState());
      setIsLoadingPins(false);
    }
  };

  useEffect(() => {
    loadPins();
    // Refresh every minute so old flood pins drop off the map
    const interval = setInterval(loadPins, 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const drawRoute = async (a, b) => {
    const route = await fetchRoadRoute(a, b);
    if (route.success) {
      setRouteCoordinates(route.waypoints);
    } else {
      setRouteCoordinates([]);
      showToast('error', 'Road route is unavailable right now. Try "Scan Road Corridor" again in a moment.');
    }
  };

  const handleMapClick = (latlng) => {
    setClickCoord(latlng);
    if (!startPoint) {
      setStartPoint(latlng);
    } else if (!endPoint) {
      setEndPoint(latlng);
      drawRoute(startPoint, latlng);
    }
  };

  const handleLoadPresetRoute = () => {
    const { start, end } = APP_CONFIG.PRESET_ROUTE;
    setStartPoint(start);
    setEndPoint(end);
    drawRoute(start, end);
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

  const showOfflineBanner = !isLoadingPins && connection === 'not_configured';
  const showUnreachableBanner = !isLoadingPins && connection === 'unreachable';

  return (
    <div className="min-h-screen flex flex-col bg-wmd-bg text-neutral-900 font-sans">
      {showOfflineBanner && (
        <div className="bg-amber-400 text-neutral-950 font-mono text-xs px-4 py-2 font-bold text-center border-b border-amber-500 flex items-center justify-center gap-2">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>
            OFFLINE DEMO MODE: no backend is connected. Data stays only in this browser. There is no AI hint and
            other people cannot see your reports.
          </span>
        </div>
      )}
      {showUnreachableBanner && (
        <div className="bg-red-600 text-white font-mono text-xs px-4 py-2 font-bold text-center border-b border-red-700 flex items-center justify-center gap-2">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>
            CANNOT REACH THE SERVER: the map may be out of date, and new reports will NOT be saved until it is back.
          </span>
        </div>
      )}

      {toast && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[60] max-w-md w-[calc(100%-2rem)] px-4 py-3 rounded-xl shadow-xl border text-xs font-semibold flex items-start gap-2 ${
            toast.type === 'error'
              ? 'bg-red-50 border-red-300 text-red-900'
              : toast.type === 'warn'
              ? 'bg-amber-50 border-amber-300 text-amber-950'
              : 'bg-emerald-50 border-emerald-300 text-emerald-900'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span className="flex-1">{toast.text}</span>
          <button onClick={() => setToast(null)} className="opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <Navbar
        onOpenReportFlood={() => setIsFloodModalOpen(true)}
        onOpenReportHazard={() => setIsHazardModalOpen(true)}
        onResetData={handleResetData}
        showReset={connection === 'not_configured'}
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
              <span className="text-neutral-500 uppercase text-[10px]">Known Hazards</span>
              <div className="text-base font-bold text-amber-700">{hazardCount} spots</div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-wmd-border shadow-sm flex items-center justify-between">
            <div>
              <span className="text-neutral-500 uppercase text-[10px]">Data</span>
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
              <span className="text-neutral-500 uppercase text-[10px]">Flood pins last</span>
              <div className="text-base font-bold text-emerald-700">{APP_CONFIG.FLOOD_PIN_LIFETIME_MINUTES} min</div>
            </div>
            <button
              onClick={loadPins}
              title="Refresh pins"
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
                <span>MAP ({APP_CONFIG.DEFAULT_CITY.toUpperCase()})</span>
              </div>
              <span className="text-neutral-400 font-mono text-[11px]">
                Tap the map to set Point A, then Point B
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
        pins={pins}
        onReportCreated={(created) => {
          loadPins();
          if (created?.compoundHazardNearby) {
            showToast(
              'warn',
              'Flood pin saved. A known hazard is within ' +
                APP_CONFIG.COMPOUND_DANGER_RADIUS_METERS +
                ' m: water here may be hiding it. Higher risk.'
            );
          } else {
            showToast('success', `Flood pin saved. It stays on the map for ${APP_CONFIG.FLOOD_PIN_LIFETIME_MINUTES} minutes.`);
          }
        }}
      />

      <ReportHazardModal
        isOpen={isHazardModalOpen}
        onClose={() => setIsHazardModalOpen(false)}
        defaultCoords={clickCoord}
        onHazardCreated={(created) => {
          loadPins();
          if (created?.duplicate) {
            showToast('success', 'This hazard was already on the map. We counted your report as a "still there" confirmation.');
          } else {
            showToast('success', 'Hazard saved. It will stay on the map until 2 devices mark it fixed.');
          }
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
