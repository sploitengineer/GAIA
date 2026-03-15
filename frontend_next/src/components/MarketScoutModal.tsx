"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Competitor {
  name: string;
  description: string;
  features: string[];
}

interface MarketResearchData {
  competitors: Competitor[];
  differentiating_features: string[];
  market_summary: string;
}

interface MarketScoutModalProps {
  data: MarketResearchData;
  onProceed: (selectedFeatures: string[]) => void;
  onSkip: () => void;
}

export default function MarketScoutModal({ data, onProceed, onSkip }: MarketScoutModalProps) {
  const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(
    new Set(data.differentiating_features || [])
  );

  const toggleFeature = (feature: string) => {
    setSelectedFeatures((prev) => {
      const next = new Set(prev);
      if (next.has(feature)) {
        next.delete(feature);
      } else {
        next.add(feature);
      }
      return next;
    });
  };

  const selectAll = () => setSelectedFeatures(new Set(data.differentiating_features || []));
  const clearAll = () => setSelectedFeatures(new Set());

  const COMPETITOR_COLORS = ["#3b82f6", "#a855f7", "#f43f5e", "#22c55e", "#f97316"];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#050B14]/95 backdrop-blur-xl p-4 lg:p-8"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="relative w-full max-w-6xl max-h-[92vh] bg-[#0b1320] border border-[#00f2ff]/30 rounded-2xl shadow-[0_0_60px_rgba(0,242,255,0.15)] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-800 bg-black/40 shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-[#00f2ff] tracking-widest flex items-center">
              <span className="mr-3 text-3xl">🕵️</span>
              MARKET SCOUT REPORT
            </h2>
            <p className="text-gray-400 text-xs font-mono mt-1 tracking-widest uppercase">
              {data.competitors?.length || 0} competitors analyzed • Select features to include
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={onSkip}
              className="px-4 py-2 text-xs font-mono font-bold text-gray-400 border border-gray-700 rounded-lg hover:border-gray-500 transition-all uppercase tracking-widest"
            >
              SKIP
            </button>
            <button
              onClick={() => onProceed(Array.from(selectedFeatures))}
              disabled={selectedFeatures.size === 0}
              className="px-6 py-2 text-xs font-mono font-bold text-black bg-[#00f2ff] rounded-lg hover:bg-[#00f2ff]/80 disabled:opacity-40 disabled:cursor-not-allowed transition-all uppercase tracking-widest shadow-[0_0_20px_rgba(0,242,255,0.3)]"
            >
              PROCEED ({selectedFeatures.size} features)
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-gray-700">

          {/* Market Summary */}
          {data.market_summary && (
            <div className="bg-[#00f2ff]/5 border border-[#00f2ff]/20 rounded-xl p-4">
              <div className="text-[#00f2ff] text-xs font-mono font-bold mb-2 uppercase tracking-widest">📊 Market Overview</div>
              <p className="text-gray-300 text-sm leading-relaxed">{data.market_summary}</p>
            </div>
          )}

          {/* Competitor Cards */}
          {data.competitors && data.competitors.length > 0 && (
            <div>
              <div className="text-gray-400 text-xs font-mono font-bold mb-3 uppercase tracking-widest">
                ⚔️ Existing Competitors
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.competitors.map((comp, i) => {
                  const color = COMPETITOR_COLORS[i % COMPETITOR_COLORS.length];
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.07 }}
                      className="bg-gray-900/60 border rounded-xl p-4 hover:bg-gray-900/80 transition-all"
                      style={{ borderColor: `${color}40` }}
                    >
                      <div className="flex items-center mb-2">
                        <div className="w-2 h-2 rounded-full mr-2 shrink-0" style={{ backgroundColor: color }} />
                        <span className="font-bold text-white text-sm truncate">{comp.name}</span>
                      </div>
                      <p className="text-gray-400 text-xs mb-3 leading-relaxed line-clamp-2">{comp.description}</p>
                      <div className="space-y-1">
                        {(comp.features || []).slice(0, 3).map((f, j) => (
                          <div key={j} className="flex items-start text-xs text-gray-300">
                            <span className="mr-1.5 shrink-0" style={{ color }}>▸</span>
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Differentiating Features — Checkboxes */}
          {data.differentiating_features && data.differentiating_features.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-gray-400 text-xs font-mono font-bold uppercase tracking-widest">
                  🚀 Suggested Differentiating Features
                </div>
                <div className="flex space-x-2">
                  <button onClick={selectAll} className="text-xs text-[#00f2ff] font-mono hover:underline">Select All</button>
                  <span className="text-gray-600">|</span>
                  <button onClick={clearAll} className="text-xs text-gray-500 font-mono hover:underline">Clear</button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.differentiating_features.map((feature, i) => {
                  const isChecked = selectedFeatures.has(feature);
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => toggleFeature(feature)}
                      className={`flex items-start space-x-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        isChecked
                          ? "bg-[#00f2ff]/10 border-[#00f2ff]/50 shadow-[0_0_10px_rgba(0,242,255,0.1)]"
                          : "bg-gray-900/40 border-gray-700 hover:border-gray-500"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 border-2 transition-all ${
                          isChecked ? "bg-[#00f2ff] border-[#00f2ff]" : "border-gray-600"
                        }`}
                      >
                        {isChecked && <span className="text-black text-xs font-bold">✓</span>}
                      </div>
                      <span className={`text-sm leading-relaxed ${isChecked ? "text-white" : "text-gray-400"}`}>
                        {feature}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
