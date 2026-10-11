import React from 'react';
import { Droplets, ShieldAlert, Landmark } from 'lucide-react';

export default function Navbar({
  onOpenReportFlood,
  onOpenReportHazard,
  onOpenCivicEscalations,
  onResetData,
  showReset = false,
  activeEscalationsCount = 0
}) {
  return (
    <header className="border-b border-wmd-border bg-white sticky top-0 z-40 shadow-sm">
      {/* Top Civic Status & Live Network Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-1.5 flex items-center justify-between text-xs text-neutral-600 border-b border-neutral-100 bg-neutral-50/70">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="font-mono text-[11px] font-semibold text-neutral-800">
            CIVIC ROAD HAZARD &amp; DRAINAGE TELEMETRY
          </span>
          <span className="text-neutral-300 hidden md:inline">|</span>
          <span className="text-neutral-500 text-[11px] hidden md:inline">
            Hyperlocal Commuter Safety &amp; PWD Redressal Network
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-sky-100 text-sky-800 px-2 py-0.5 rounded font-mono text-[10px] font-semibold tracking-wider">
            GOVT PWD DISPATCH READY
          </span>
        </div>
      </div>

      {/* Main Brand Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-aws-blue text-white flex items-center justify-center shadow-sm">
              <Droplets className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-bold text-base text-neutral-900 leading-none">WaterLine</h1>
              <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider mt-0.5">
                Urban Hazard Telemetry &amp; Pothole Redressal
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {showReset && (
            <button
              onClick={onResetData}
              title="Offline demo only: reset this browser's sample pins"
              className="text-xs px-2.5 py-1.5 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-md font-mono transition-colors"
            >
              Reset Demo
            </button>
          )}

          {/* Civic Redressal / Govt Escalations Portal Button */}
          <button
            onClick={onOpenCivicEscalations}
            className="text-xs px-3 py-1.5 rounded-md font-medium border border-indigo-200 bg-indigo-50 text-indigo-900 hover:bg-indigo-100 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Landmark className="w-3.5 h-3.5 text-indigo-700" />
            <span>Civic Redressal &amp; PWD Tickets</span>
            {activeEscalationsCount > 0 && (
              <span className="bg-indigo-600 text-white text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold">
                {activeEscalationsCount}
              </span>
            )}
          </button>

          <button
            onClick={onOpenReportHazard}
            className="text-xs px-3 py-1.5 rounded-md font-medium border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
            <span>Report Hazard</span>
          </button>

          <button
            onClick={onOpenReportFlood}
            className="text-xs px-3.5 py-1.5 rounded-md font-medium bg-aws-blue hover:bg-aws-blue-dark text-white transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Droplets className="w-3.5 h-3.5" />
            <span>Report Flood</span>
          </button>
        </div>
      </div>
    </header>
  );
}
