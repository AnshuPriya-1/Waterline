import React from 'react';
import { Droplets, ShieldAlert } from 'lucide-react';

export default function Navbar({ onOpenReportFlood, onOpenReportHazard, onResetData, showReset = false }) {
  return (
    <header className="border-b border-wmd-border bg-white sticky top-0 z-40">
      {/* Top micro-bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between text-xs text-neutral-600 border-b border-neutral-100">
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">Built for the WeMakeDevs x AWS Bharat Builds Tour, Environmental Hacks</span>
          <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold">
            TRACK 02: HEAT &amp; WATER
          </span>
        </div>
        <span className="font-mono text-neutral-500 hidden sm:inline">Team Synvora</span>
      </div>

      {/* Main Brand Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-aws-blue text-white flex items-center justify-center shadow-sm">
              <Droplets className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-bold text-base text-neutral-900 leading-none">WaterLine</h1>
              <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">What the water hides</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {showReset && (
            <button
              onClick={onResetData}
              title="Offline demo only: reset this browser's sample pins"
              className="text-xs px-2.5 py-1.5 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-md font-mono transition-colors"
            >
              Reset Demo Data
            </button>
          )}
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
