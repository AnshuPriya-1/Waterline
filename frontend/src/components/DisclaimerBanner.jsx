import React from 'react';
import { AlertTriangle, Clock, Layers, ShieldCheck } from 'lucide-react';

export default function DisclaimerBanner() {
  return (
    <div className="bg-gradient-to-r from-aws-blue to-[#0284c7] text-white p-4 sm:p-6 shadow-md border-b border-aws-blue-dark">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-white text-aws-blue font-bold px-2 py-0.5 rounded text-xs font-mono tracking-wide">
              WaterLine
            </span>
            <span className="bg-amber-400 text-neutral-950 font-bold px-2 py-0.5 rounded text-[11px] font-mono">
              TRACK 02: HEAT AND WATER
            </span>
            <span className="text-blue-100 text-xs hidden sm:inline">
              Built for two-wheeler commuters & delivery riders
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white leading-tight">
            See what is on your route during rain — and what the water is hiding.
          </h2>
          <p className="text-blue-100 text-xs sm:text-sm leading-relaxed">
            Short-lived flood pins disappear after 45 minutes. Dry-day hazard pins remember open drains and missing manhole covers.
            When floodwater submerges a known hazard, WaterLine issues an instant compound warning.
          </p>
        </div>

        {/* Feature badges */}
        <div className="flex flex-col sm:flex-row md:flex-col gap-2 w-full md:w-auto shrink-0 font-mono text-[11px]">
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-1.5 rounded-lg">
            <Clock className="w-3.5 h-3.5 text-blue-200" />
            <span>45-Min Strict Flood Decay</span>
          </div>
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-1.5 rounded-lg">
            <Layers className="w-3.5 h-3.5 text-blue-200" />
            <span>Hazard Memory Layer</span>
          </div>
          <div className="flex items-center gap-2 bg-amber-400 text-neutral-900 font-semibold px-3 py-1.5 rounded-lg">
            <AlertTriangle className="w-3.5 h-3.5 text-neutral-900" />
            <span>50m Compound Threat Alert</span>
          </div>
        </div>
      </div>
    </div>
  );
}
