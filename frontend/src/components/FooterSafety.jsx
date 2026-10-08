import React from 'react';
import { AlertCircle, Shield, Award, Terminal } from 'lucide-react';

export default function FooterSafety() {
  return (
    <footer className="mt-8 border-t border-wmd-border bg-white text-xs text-neutral-600">
      {/* Red safety bar */}
      <div className="bg-neutral-900 text-neutral-200 py-3 px-4 text-center font-mono text-[11px] font-semibold border-b border-neutral-800">
        <span className="text-amber-400 mr-2">⚠️ RIDER SAFETY RULE:</span>
        Don't use your phone while riding. Plan your route before starting your trip.
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Column 1: Honest Limits */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-neutral-900 font-mono">
            <Shield className="w-4 h-4 text-aws-blue" />
            <span>HONEST SYSTEM LIMITS</span>
          </div>
          <p className="text-[11px] leading-relaxed text-neutral-500">
            WaterLine cannot see under opaque muddy water. Depth indicators are crowd-confirmed estimates. 
            Hazard pins rely on community verification. Always treat unverified deep standing water as high risk.
          </p>
        </div>

        {/* Column 2: AWS Stack Details */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-neutral-900 font-mono">
            <Terminal className="w-4 h-4 text-neutral-800" />
            <span>AWS CLOUD NATIVE ARCHITECTURE</span>
          </div>
          <p className="text-[11px] leading-relaxed text-neutral-500 font-mono">
            AWS SAM CLI · Amazon Bedrock Vision · DynamoDB (Single-Table TTL) · Amazon SNS Email Topic · Ephemeral In-Memory Image Analysis.
          </p>
        </div>

        {/* Column 3: Event & Team Synvora */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-neutral-900 font-mono">
            <Award className="w-4 h-4 text-amber-600" />
            <span>TEAM SYNODRA (PPD9GX)</span>
          </div>
          <p className="text-[11px] leading-relaxed text-neutral-500">
            Anshu Priya (Lead) & Pratham Khatwani. 
            Submitted to WeMakeDevs Bharat Builds Tour: Event 02 (Heat & Water Track).
          </p>
        </div>
      </div>

      {/* Copyright */}
      <div className="border-t border-neutral-100 py-3 text-center text-[10px] text-neutral-400 font-mono">
        © 2026 WaterLine · Bharat Builds Environmental Hacks · Delhi Technological University (DTU)
      </div>
    </footer>
  );
}
