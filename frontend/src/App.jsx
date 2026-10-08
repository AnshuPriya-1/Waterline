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
import { AlertTriangle, Droplets, Info, Layers, MapPin, RefreshCw, ShieldAlert, Sparkles } from 'lucide-react';

export default function App() {
  const [pins, setPins] = useState([]);
  const [isLoadingPins, setIsLoadingPins] = useState(true);
  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);

  // Modals
  const [isFloodModalOpen, setIsFloodModalOpen] = useState(false);
  const [isHazardModalOpen, setIsHazardModalOpen] = useState(false);
  const [selectedHazard, setSelectedHazard] = useState(null);
  const [clickCoord, setClickCoord] = useState({ lat: 28.7505, lng: 77.1188 });

  // Load active pins
  const loadPins = async () => {
    setIsLoadingPins(true);
    try {
      const data = await api.getPins('delhi');
      setPins(data);
    } catch (err) {
      console.error("Failed to load pins:", err);
    } finally {
      setIsLoadingPins(false);
    }
  };

  useEffect(() => {
    loadPins();
    // Auto refresh active pins every 60 seconds to reflect decayed flood pins
    const interval = setInterval(loadPins, 60000);
    return () => clearInterval(interval);
  }, []);

  // Map Click Behavior
  const handleMapClick = (latlng) => {
    setClickCoord(latlng);
    if (!startPoint) {
      setStartPoint(latlng);
    } else if (!endPoint) {
      setEndPoint(latlng);
      // Auto-interpolate route
      generateRouteBetween(startPoint, latlng);
    }
  };

  const generateRouteBetween = (ptA, ptB) => {
    const steps = 14;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      pts.push({
        lat: ptA.lat + t * (ptB.lat - ptA.lat),
        lng: ptA.lng + t * (ptB.lng - ptA.lng)
      });
    }
    setRouteCoordinates(pts);
  };

  // Load Preset DTU Demo Route that passes through compound danger spot
  const handleLoadPresetRoute = () => {
    const start = { lat: 28.7470, lng: 77.1235 };
    const end = { lat: 28.7545, lng: 77.1130 };
    setStartPoint(start);
    setEndPoint(end);
    generateRouteBetween(start, end);
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

  // Metrics summary
  const floodCount = pins.filter((p) => p.type === 'flood').length;
  const hazardCount = pins.filter((p) => p.type === 'hazard').length;

  return (
    <div className="min-h-screen flex flex-col bg-wmd-bg text-neutral-900 font-sans">
      {/* 1. WeMakeDevs x AWS Header */}
      <Navbar
        onOpenReportFlood={() => setIsFloodModalOpen(true)}
        onOpenReportHazard={() => setIsHazardModalOpen(true)}
        onResetData={handleResetData}
      />

      {/* 2. Amazon Electric Blue Hero Banner */}
      <DisclaimerBanner />

      {/* 3. Main Application Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Telemetry Stats Bar */}
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
              <div className="text-base font-bold text-amber-700">{hazardCount} drains</div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-wmd-border shadow-sm flex items-center justify-between">
            <div>
              <span className="text-neutral-500 uppercase text-[10px]">Corridor Radius</span>
              <div className="text-base font-bold text-neutral-800">45 meters</div>
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

        {/* Map & Controls Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Map Column (7 cols) */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 font-bold font-mono text-neutral-700 uppercase">
                <MapPin className="w-4 h-4 text-aws-blue" />
                <span>TELEMETRY MAP (DTU / DELHI NCR)</span>
              </div>
              <span className="text-neutral-400 font-mono text-[11px]">
                Tip: Tap anywhere to place Point A / B
              </span>
            </div>

            <MapView
              pins={pins}
              routeCoordinates={routeCoordinates}
              startPoint={startPoint}
              endPoint={endPoint}
              onMapClick={handleMapClick}
              onSelectHazardPin={(h) => setSelectedHazard(h)}
            />
          </div>

          {/* Route & Action Column (5 cols) */}
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

            {/* Quick Demo Guide for Judges & Mentors */}
            <div className="bg-white rounded-xl border border-wmd-border p-4 shadow-sm space-y-2.5 text-xs">
              <div className="flex items-center gap-2 font-bold text-neutral-900 font-mono">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>30-SECOND JUDGE DEMO WALKTHROUGH:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-neutral-600 leading-relaxed font-sans text-[11px]">
                <li>
                  Click <strong className="text-neutral-900">"Load DTU Demo Route"</strong> above.
                </li>
                <li>
                  Click <strong className="text-neutral-900">"Scan Corridor for Hidden Hazards"</strong>.
                </li>
                <li>
                  Watch the <strong className="text-red-700 font-mono">CRITICAL WARNING</strong> fire because a knee-deep flood pin sits directly over an uncovered drain.
                </li>
                <li>
                  Click <strong className="text-aws-blue">"Upload Flood Photo"</strong> to test client-side canvas resizing and Bedrock AI suggestion.
                </li>
              </ol>
            </div>
          </div>
        </div>
      </main>

      {/* 4. Modals */}
      <ReportFloodModal
        isOpen={isFloodModalOpen}
        onClose={() => setIsFloodModalOpen(false)}
        defaultCoords={clickCoord}
        onReportCreated={() => {
          loadPins();
          alert("Flood pin published! Visible on map for next 45 minutes.");
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

      {/* 5. Footer with safety rules */}
      <FooterSafety />
    </div>
  );
}
