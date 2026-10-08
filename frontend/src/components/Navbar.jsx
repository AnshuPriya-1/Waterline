import React from 'react';
import { Droplets, ShieldAlert, Award, ExternalLink, User } from 'lucide-react';

export default function Navbar({ onOpenReportFlood, onOpenReportHazard, onResetData }) {
  return (
    <header className="border-b border-wmd-border bg-white sticky top-0 z-40">
      {/* Top micro-bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between text-xs text-neutral-600 border-b border-neutral-100">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-neutral-900 tracking-wider">EVENT 02</span>
          <span className="text-neutral-300">/</span>
          <span className="text-aws-blue font-medium hover:underline cursor-pointer flex items-center gap-1">
            Bharat Builds Tour
          </span>
          <span className="text-neutral-300">/</span>
          <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold">
            TRACK 02: HEAT & WATER
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-neutral-500 hidden sm:inline">TEAM: SYNODRA / PPD9GX</span>
          <div className="flex items-center gap-1.5 bg-status-green-light text-status-green px-2.5 py-0.5 rounded-full font-medium text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-status-green animate-pulse"></span>
            Registered
          </div>
          <div className="flex items-center gap-1.5 text-neutral-700 bg-neutral-100 hover:bg-neutral-200 px-2.5 py-0.5 rounded-full cursor-pointer text-[11px] font-medium transition-colors">
            <User className="w-3 h-3 text-neutral-500" />
            <span>Anshu Priya</span>
          </div>
        </div>
      </div>

      {/* Main Brand Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="font-black text-lg text-neutral-900 tracking-tight">WeMakeDevs</span>
            <span className="text-neutral-400 font-light text-sm">×</span>
            <span className="font-bold text-sm tracking-tight text-neutral-900 px-1.5 py-0.5 bg-neutral-100 rounded border border-neutral-200 font-mono">
              aws
            </span>
          </div>
          <span className="text-neutral-300">|</span>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-aws-blue text-white flex items-center justify-center shadow-sm">
              <Droplets className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-bold text-base text-neutral-900 leading-none">WaterLine</h1>
              <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">Submerged Hazard Memory</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onResetData}
            title="Reset to fresh demo sample pins"
            className="text-xs px-2.5 py-1.5 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-md font-mono transition-colors"
          >
            Reset Demo Data
          </button>
          <button
            onClick={onOpenReportHazard}
            className="text-xs px-3 py-1.5 rounded-md font-medium border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
            <span>Report Dry-Day Hazard</span>
          </button>
          <button
            onClick={onOpenReportFlood}
            className="text-xs px-3.5 py-1.5 rounded-md font-medium bg-aws-blue hover:bg-aws-blue-dark text-white transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Droplets className="w-3.5 h-3.5" />
            <span>Upload Flood Photo</span>
          </button>
        </div>
      </div>
    </header>
  );
}
