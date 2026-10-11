import React from 'react';
import { AlertTriangle, Clock, Landmark, ShieldCheck } from 'lucide-react';

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
              CIVIC ROAD &amp; FLOOD TELEMETRY
            </span>
            <span className="text-blue-100 text-xs hidden sm:inline">
              Built for two-wheeler commuters, delivery riders &amp; municipal responders
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white leading-tight">
            See what is on your route during rain — and what the water is hiding.
          </h2>
          <p className="text-blue-100 text-xs sm:text-sm leading-relaxed">
            Short-lived flood pins disappear after 45 minutes. Dry-day hazard pins track open drains, missing manhole covers, and severe potholes.
            High-density pothole corridors are automatically escalated to Municipal PWD engineering cells for emergency road repair.
          </p>
        </div>

        {/* Feature badges */}
        <div className="flex flex-col sm:flex-row md:flex-col gap-2 w-full md:w-auto shrink-0 font-mono text-[11px]">
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-1.5 rounded-lg">
            <Clock className="w-3.5 h-3.5 text-blue-200" />
            <span>45-Min Strict Flood Decay</span>
          </div>
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-1.5 rounded-lg">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />
            <span>50m Submerged Threat Alert</span>
          </div>
          <div className="flex items-center gap-2 bg-emerald-500 text-white font-semibold px-3 py-1.5 rounded-lg shadow-xs">
            <Landmark className="w-3.5 h-3.5 text-white" />
            <span>Automated PWD Escalation</span>
          </div>
        </div>
      </div>
    </div>
  );
}
