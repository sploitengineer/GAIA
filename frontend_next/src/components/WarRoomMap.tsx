"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export const AGENT_PODS = [
  { id: "sufficiency_node", label: "Gatekeeper (Sufficiency)", x: 600, y: 300, color: "#3b82f6", avatar: "https://api.dicebear.com/9.x/personas/svg?seed=Gatekeeper&backgroundColor=1e293b" },
  { id: "clarification_node", label: "Clarifier (Clarification)", x: 1000, y: 300, color: "#eab308", avatar: "https://api.dicebear.com/9.x/micah/svg?seed=Clarifier&backgroundColor=1e293b" },
  { id: "context_synthesizer_node", label: "Oracle (Synthesizer)", x: 1400, y: 300, color: "#a855f7", avatar: "https://api.dicebear.com/9.x/bottts/svg?seed=Oracle&backgroundColor=1e293b" },
  { id: "market_scout_node", label: "Scout (Market Research)", x: 1550, y: 450, color: "#06b6d4", avatar: "https://api.dicebear.com/9.x/personas/svg?seed=MarketScout&backgroundColor=1e293b" },
  { id: "requirement_node", label: "Scribe (Requirement)", x: 1550, y: 600, color: "#0ea5e9", avatar: "https://api.dicebear.com/9.x/personas/svg?seed=Scribe&backgroundColor=1e293b" },
  { id: "pm_node", label: "Strategist (PM)", x: 1400, y: 900, color: "#f43f5e", avatar: "https://api.dicebear.com/9.x/micah/svg?seed=Strategist&backgroundColor=1e293b" },
  { id: "scrum_node", label: "Architect (Scrum)", x: 1000, y: 950, color: "#22c55e", avatar: "https://api.dicebear.com/9.x/bottts/svg?seed=Architect&backgroundColor=1e293b" },
  { id: "task_node", label: "Builder (Task)", x: 600, y: 900, color: "#f97316", avatar: "https://api.dicebear.com/9.x/personas/svg?seed=Builder&backgroundColor=1e293b" },
  { id: "reviewer_node", label: "Auditor (QA Reviewer)", x: 450, y: 600, color: "#ef4444", avatar: "https://api.dicebear.com/9.x/micah/svg?seed=Auditor&backgroundColor=1e293b" },
  { id: "archivist", label: "Archivist (File I/O)", x: 1200, y: 750, color: "#14b8a6", avatar: "https://api.dicebear.com/9.x/bottts/svg?seed=Archivist&backgroundColor=1e293b" }
];

const PATH_CONNECTIONS = [
  { from: "sufficiency_node", to: "clarification_node" },
  { from: "clarification_node", to: "context_synthesizer_node" },
  { from: "context_synthesizer_node", to: "market_scout_node" },
  { from: "market_scout_node", to: "requirement_node" },
  { from: "requirement_node", to: "pm_node" },
  { from: "pm_node", to: "scrum_node" },
  { from: "scrum_node", to: "task_node" },
  { from: "task_node", to: "reviewer_node" }
];

export default function WarRoomMap({ activeNode, latestMessage, globalPhase, isDocsGenerating }: any) {
  const [viewport, setViewport] = useState({ w: 1000, h: 800 });

  useEffect(() => {
    setViewport({ w: window.innerWidth, h: window.innerHeight - 200 }); // subtract HUD height
    const handleResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight - 200 });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Lock Camera Target to the Center of the Map, and offset `cx` to 900 so the map shifts slightly Right (to avoid the Terminal) without hitting the Vault
  const cx = 900;
  const cy = 600;

  // Calculate translate to center the camera on 'cx, cy'
  const translateX = (viewport.w / 2) - cx;
  const translateY = (viewport.h / 2) - cy;

  // Dynamic Core Color based on Phase
  const getCoreColor = () => {
    if (globalPhase === "clarification") return "#3b82f6"; // Blue
    if (globalPhase?.includes("generation")) return "#22c55e"; // Green
    if (globalPhase === "task_revision") return "#ef4444"; // Red for QA fail
    if (activeNode === "reviewer_node") return "#eab308"; // Yellow
    return "#a855f7"; // Default purple
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-gray-950">
      
      {/* Dynamic Scaling Stage */}
      <motion.div
        className="absolute origin-center"
        initial={{ x: 0, y: 0, scale: 0.6 }}
        animate={{ 
          x: translateX, 
          y: translateY,
          scale: 0.6 // RTS Zoom out - adjusted to 80% equivalent
        }}
        transition={{ type: "spring", stiffness: 40, damping: 15 }}
        style={{ width: "2000px", height: "1400px" }}
      >
        {/* Isometric Grid Floor */}
        <div 
           className="absolute inset-0 opacity-20 pointer-events-none z-0"
           style={{
             backgroundImage: "linear-gradient(#374151 2px, transparent 2px), linear-gradient(90deg, #374151 2px, transparent 2px)",
             backgroundSize: "80px 80px",
             transform: "rotateX(60deg) rotateZ(-45deg) scale(1.5)",
             transformOrigin: "center"
           }}
        />

        {/* Global Connections SVG */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" overflow="visible">
          <defs>
             <linearGradient id="line-grad" x1="0" y1="0" x2="2000" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#00f2ff" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#bc00ff" stopOpacity="0.9" />
             </linearGradient>
             <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#00f2ff" opacity="0.95" />
             </marker>
          </defs>
          {PATH_CONNECTIONS.map((path, idx) => {
             const fromPod = AGENT_PODS.find(p => p.id === path.from);
             const toPod = AGENT_PODS.find(p => p.id === path.to);
             if (!fromPod || !toPod) return null;
             // Shorten line slightly at each end so arrow doesn't overlap avatar
             const dx = toPod.x - fromPod.x;
             const dy = toPod.y - fromPod.y;
             const len = Math.sqrt(dx * dx + dy * dy);
             const offset = 60;
             const x1 = fromPod.x + (dx / len) * offset;
             const y1 = fromPod.y + (dy / len) * offset;
             const x2 = toPod.x - (dx / len) * offset;
             const y2 = toPod.y - (dy / len) * offset;
             return (
               <line 
                  key={idx}
                  x1={x1} 
                  y1={y1} 
                  x2={x2} 
                  y2={y2} 
                  stroke="url(#line-grad)" 
                  strokeWidth="2.5" 
                  strokeDasharray="10, 6" 
                  strokeOpacity="0.85"
                  markerEnd="url(#arrowhead)"
               />
             );
          })}
        </svg>

        {/* Global Core */}
        <div className="absolute top-[600px] left-[1000px] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center">
             <motion.div 
               animate={{ boxShadow: `0 0 80px 20px ${getCoreColor()}` }}
               className="w-32 h-32 rounded-full bg-gray-900 border-4 relative flex items-center justify-center"
               style={{ borderColor: getCoreColor() }}
             >
                <div className="text-white text-3xl animate-pulse">⚛️</div>
                <motion.div 
                   animate={{ rotate: 360 }} 
                   transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
                   className="absolute inset-[-15px] border border-dashed rounded-full opacity-50"
                   style={{ borderColor: getCoreColor() }}
                />
             </motion.div>
             <div className="mt-6 px-5 py-1.5 text-sm bg-gray-900/80 border rounded-full text-white font-bold backdrop-blur" style={{ borderColor: getCoreColor() }}>
                 LANGGRAPH CORE: {globalPhase?.toUpperCase() || "IDLE"}
             </div>
        </div>

        {/* Render Pods & Avatars */}
        {AGENT_PODS.map((pod) => {
          const isActive = activeNode === pod.id;
          
          return (
            <div 
               key={pod.id}
               className="absolute flex flex-col items-center z-10 transition-transform duration-500 hover:scale-105"
               style={{ left: pod.x, top: pod.y, transform: "translate(-50%, -50%)" }}
            >
                {/* Streaming Thought Bubble — below avatar for top-row nodes, above for bottom-row */}
                <AnimatePresence>
                  {isActive && latestMessage && (() => {
                    const isTopRow = pod.y < 500;
                    return (
                      <motion.div 
                       initial={{ opacity: 0, scale: 0.8 }}
                       animate={{ opacity: 1, scale: 1 }}
                       exit={{ opacity: 0, scale: 0.8 }}
                       className={`absolute ${isTopRow ? 'top-[120px]' : 'bottom-[120px]'} -left-[80px] w-72 max-h-44 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 bg-gray-900 border-2 rounded-2xl p-3 shadow-2xl z-50 text-white`}
                       style={{ borderColor: pod.color, boxShadow: `0 10px 30px ${pod.color}40` }}
                      >
                         <div className="flex space-x-1 mb-2">
                           <span className="w-2 h-2 rounded-full bg-white animate-bounce" />
                           <span className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '0.1s' }} />
                           <span className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '0.2s' }} />
                         </div>
                         <p className="text-xs font-mono whitespace-pre-wrap leading-relaxed">{latestMessage}</p>
                         <div 
                           className={`absolute ${isTopRow ? '-top-3' : '-bottom-3'} left-[100px] -translate-x-1/2 w-5 h-5 bg-gray-900 ${isTopRow ? 'border-t-2 border-l-2 -rotate-45' : 'border-b-2 border-r-2 rotate-45'} z-0`}
                           style={{ borderColor: pod.color }} 
                         />
                      </motion.div>
                    );
                  })()}
                </AnimatePresence>

                {/* Cyberpunk Pod & Avatar */}
                <div className="relative group cursor-pointer">
                    {/* Active Energy Ring */}
                    {isActive && (
                        <motion.div 
                           animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                           transition={{ repeat: Infinity, duration: 2 }}
                           className="absolute -inset-4 rounded-full blur-md"
                           style={{ backgroundColor: pod.color }}
                        />
                    )}
                    
                    <div className="relative w-24 h-24 bg-gray-800 border-4 rounded-full overflow-hidden shadow-2xl" style={{ borderColor: isActive ? pod.color : '#374151' }}>
                        <img src={pod.avatar} alt={pod.label} className="w-full h-full object-cover" />
                        
                        {/* Idle Dim Animation */}
                        {!isActive && (
                           <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <span className="text-2xl opacity-50">💤</span>
                           </div>
                        )}
                    </div>
                </div>

                {/* Desk Hologram Details */}
                <div className="mt-4 text-center">
                    <div className="px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-lg bg-gray-900/90 border-t-2 backdrop-blur-md" style={{ borderColor: pod.color }}>
                        {pod.label.toUpperCase()}
                    </div>
                    {isActive ? (
                        <div className="mt-2 text-xs font-mono px-3 py-1 rounded bg-gray-800 border" style={{ color: pod.color, borderColor: pod.color }}>PROCESSING...</div>
                    ) : (
                        <div className="mt-2 text-xs font-mono text-gray-500 bg-gray-900/50 px-3 py-1 rounded">STANDBY</div>
                    )}
                </div>
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}
