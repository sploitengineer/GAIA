import React from "react";
import { Cpu, Clock, ShieldCheck } from "lucide-react";

interface TelemetryData {
  latency: number;
  confidence: number;
}

export default function IntelligenceBadges({ activeNode, telemetry }: { activeNode: string | null, telemetry: Record<string, TelemetryData> }) {
  if (!activeNode || !telemetry[activeNode]) return null;
  
  const data = telemetry[activeNode];

  return (
    <div className="flex space-x-4 bg-gray-800 p-3 rounded-lg border border-gray-700 w-full mb-4">
      <div className="flex items-center space-x-2 text-blue-400">
        <Cpu size={18} />
        <span className="text-sm font-semibold">llama-3.3-70b-versatile</span>
      </div>
      <div className="flex items-center space-x-2 text-yellow-400">
        <Clock size={18} />
        <span className="text-sm font-semibold">{data.latency}s Latency</span>
      </div>
      <div className="flex items-center space-x-2 text-emerald-400">
        <ShieldCheck size={18} />
        <span className="text-sm font-semibold">{Math.round(data.confidence * 100)}% Confidence</span>
      </div>
    </div>
  );
}
