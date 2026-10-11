import React from 'react';
import { Shield, Terminal, Landmark } from 'lucide-react';

export default function FooterSafety() {
  return (
    <footer className="mt-8 border-t border-wmd-border bg-white text-xs text-neutral-600">
      {/* Rider safety bar */}
      <div className="bg-neutral-900 text-neutral-200 py-3 px-4 text-center font-mono text-[11px] font-semibold border-b border-neutral-800">
        <span className="text-amber-400 mr-2">⚠️ COMMUTER SAFETY RULE:</span>
        Never use your mobile phone while driving or riding. Verify your route hazards before departure.
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Column 1: Honest Limits */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-neutral-900 font-mono">
            <Shield className="w-4 h-4 text-aws-blue" />
            <span>HONEST SYSTEM LIMITS</span>
          </div>
          <p className="text-[11px] leading-relaxed text-neutral-500">
            WaterLine cannot see through opaque muddy runoff. Water depths and road hazards are community-confirmed
            and telemetry-assisted. Always treat standing water on unfamiliar streets as an acute risk.
          </p>
        </div>

        {/* Column 2: AWS Stack Details */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-neutral-900 font-mono">
            <Terminal className="w-4 h-4 text-neutral-800" />
            <span>AWS MULTI-SERVICE ARCHITECTURE</span>
          </div>
          <p className="text-[11px] leading-relaxed text-neutral-500 font-mono">
            Amazon API Gateway · AWS Lambda (Node.js 22) · DynamoDB (Single-Table TTL &amp; GSI) · Amazon Bedrock Vision · Amazon SNS &amp; SES · Amazon S3 Evidence Bucket · Amazon EventBridge Schedules · CloudWatch Alarms.
          </p>
        </div>

        {/* Column 3: Civic Action & PWD Escalations */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-neutral-900 font-mono">
            <Landmark className="w-4 h-4 text-indigo-600" />
            <span>CIVIC ESCALATION &amp; PWD ACTION</span>
          </div>
          <p className="text-[11px] leading-relaxed text-neutral-500">
            Corridors with repeated pothole complaints automatically trigger formal road defect notifications
            dispatched to Municipal Corporation &amp; PWD road maintenance engineering divisions with GPS evidence.
          </p>
        </div>
      </div>

      {/* Copyright */}
      <div className="border-t border-neutral-100 py-3 text-center text-[10px] text-neutral-400 font-mono">
        © 2026 WaterLine · Hyperlocal Urban Road Safety &amp; Flood Telemetry Platform
      </div>
    </footer>
  );
}
