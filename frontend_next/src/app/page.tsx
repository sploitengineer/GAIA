"use client";

import React, { useState, useEffect } from "react";
import WarRoomMap, { AGENT_PODS } from "@/components/WarRoomMap";
import DocumentHub from "@/components/DocumentHub";
import MarketScoutModal from "@/components/MarketScoutModal";

export default function Home() {
  const [threadId, setThreadId] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([]);
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [docs, setDocs] = useState<any>({});
  const [telemetry, setTelemetry] = useState<any>({});
  const [inputIdea, setInputIdea] = useState("");
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [interruptMessage, setInterruptMessage] = useState("");
  const [showDocs, setShowDocs] = useState(false);
  const [marketResearchData, setMarketResearchData] = useState<any>(null);
  
  const hasDocs = Object.values(docs).some(d => !!d);

  useEffect(() => {
    const tid = Math.random().toString(36).substring(7);
    setThreadId(tid);
    
    const socket = new WebSocket(`ws://localhost:8000/ws/${tid}`);
    
    socket.onopen = () => {
      setLogs((prev) => [...prev, "WebSocket connection established."]);
    };
    
    socket.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      if (parsed.type === "status" || parsed.type === "error") {
        setLogs((prev) => [...prev, parsed.message]);
      } else if (parsed.type === "interrupt") {
        setLogs((prev) => [...prev, "⚠️ " + parsed.message]);
        setIsPaused(true);
        setActiveNode("reviewer_node");
        setShowDocs(true);
      } else if (parsed.type === "market_research") {
        // Market Scout paused the graph — show the feature selection modal
        setLogs((prev) => [...prev, "🕵️ Market Scout: Competitor analysis complete. Select features to include."]);
        setActiveNode("market_scout_node");
        setMarketResearchData(parsed.data);
      } else if (parsed.type === "node_update") {
        const payload = parsed.data;
        const nodeName = Object.keys(payload)[0];
        const stateData = payload[nodeName];
        
        setActiveNode(nodeName);
        
        if (stateData.latest_message) {
          setLogs((prev) => [...prev, `[${nodeName}]: ${stateData.latest_message}`]);
          if (stateData.latest_message.includes("Workflow Complete!")) {
             setShowDocs(true);
             setActiveNode("archivist");
          }
        } else {
          setLogs((prev) => [...prev, `[${nodeName}] execution completed.`]);
        }
        
        if (stateData.telemetry) {
          setTelemetry(stateData.telemetry);
        }
        
        setDocs((prevDocs: any) => ({
          ...prevDocs,
          project_brief: stateData.project_brief || prevDocs.project_brief,
          prd: stateData.prd || prevDocs.prd,
          epics: stateData.epics || prevDocs.epics,
          tasks: stateData.tasks || prevDocs.tasks,
        }));
      }
    };

    setWs(socket);

    return () => socket.close();
  }, []);

  const handleSend = () => {
    if (ws && inputIdea.trim()) {
      setLogs((prev) => [...prev, `[USER]: ${inputIdea}`]);
      ws.send(JSON.stringify({ user_input: inputIdea, action: "chat" }));
      setInputIdea("");
    }
  };
  
  const handleResume = () => {
    if (ws) {
      setIsPaused(false);
      setLogs((prev) => [...prev, `[SYSTEM_OVERRIDE]: ${interruptMessage}`]);
      ws.send(JSON.stringify({ user_input: interruptMessage, action: "resume" }));
      setInterruptMessage("");
    }
  };

  const handleFeatureSelect = (selectedFeatures: string[]) => {
    if (ws) {
      setMarketResearchData(null);
      setLogs((prev) => [...prev, `🚀 Proceeding with ${selectedFeatures.length} selected features.`]);
      ws.send(JSON.stringify({ action: "feature_select", selected_features: selectedFeatures }));
    }
  };

  // Keep logs auto-scrolled
  const logsEndRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
     logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="relative w-screen h-screen bg-[#050B14] text-gray-100 font-sans overflow-hidden">
      
      {/* 1. Main Isometric Stage (Behind everything) */}
      <div className="absolute inset-0 z-0 select-none">
         <WarRoomMap 
            activeNode={activeNode} 
            latestMessage={logs[logs.length-1]} 
            globalPhase={telemetry?.current_phase?.replace('_', ' ') || "STANDBY"} 
            isDocsGenerating={docs} 
         />
      </div>

      {/* 2. Top Bar / App Header */}
      <header className="absolute top-0 left-0 w-full p-6 z-10 flex justify-between items-start pointer-events-none">
         <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#00f2ff] to-[#bc00ff] tracking-wider flex items-center shadow-black drop-shadow-lg drop-shadow-cyan-500 pointer-events-auto">
               <span className="text-white mr-3 text-4xl">⬡</span>
               AI WAR ROOM
            </h1>
            <p className="text-cyan-400 font-mono text-xs uppercase tracking-widest mt-1 ml-12 font-bold drop-shadow-md">Command Center v4.2.0</p>
         </div>
         
         {/* Top Right: Artifacts Vault Button */}
         <div className="pointer-events-auto flex items-center space-x-6">
             {/* Global Network Status */}
             <div className="text-right font-mono text-xs tracking-widest">
                 <div className="text-gray-400">NETWORK STATUS</div>
                 <div className="text-[#39ff14] flex items-center justify-end"><span className="w-2 h-2 rounded-full bg-[#39ff14] mr-2 animate-pulse" /> ALL SYSTEMS NOMINAL</div>
             </div>
             <button 
                onClick={() => setShowDocs(true)}
                className={`group relative flex items-center space-x-2 px-8 py-4 font-bold rounded-lg border-2 transition-all shadow-[0_0_20px_rgba(0,0,0,0.5)] ${hasDocs ? 'bg-[#00f2ff]/10 text-[#00f2ff] border-[#00f2ff] hover:bg-[#00f2ff]/30' : 'bg-gray-900/50 text-gray-500 border-gray-700 hover:border-gray-500'}`}
             >
                <span className="text-xl">🗄️</span>
                <span className="tracking-widest">ARTIFACTS VAULT</span>
                {hasDocs && (
                   <span className="absolute -top-2 -right-2 flex h-5 w-5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00f2ff] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-5 w-5 bg-[#00f2ff] shadow-[0_0_10px_#00f2ff]"></span>
                   </span>
                )}
                {/* Embedded Loot Glow Effect behind button */}
                {hasDocs && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#00f2ff]/20 to-transparent -translate-x-[100%] group-hover:animate-[shimmer_1.5s_infinite]" />}
             </button>
         </div>
      </header>

      {/* 3. Left Overlay: Transparent Terminal */}
      <div className="absolute bottom-32 left-8 w-[400px] z-10 pointer-events-auto shadow-2xl">
         <div className="bg-[#0b1320]/80 backdrop-blur-md border border-gray-800 rounded-xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.8)]">
             <div className="bg-black/60 border-b border-gray-800 px-4 py-3 font-mono text-[10px] tracking-widest font-bold text-gray-400 flex justify-between items-center">
                 <span>▶ SYSTEM_LOGS</span>
                 <div className="flex space-x-1"><span className="w-2 h-2 rounded-full bg-red-500"/><span className="w-2 h-2 rounded-full bg-yellow-500"/><span className="w-2 h-2 rounded-full bg-green-500"/></div>
             </div>
             <div className="h-64 overflow-y-auto p-4 font-mono text-xs text-[#39ff14] scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
                {logs.map((log, i) => (
                  <div key={i} className="mb-2 opacity-80 hover:opacity-100 flex items-start">
                     <span className="text-gray-600 mr-2 shrink-0">[{new Date().toLocaleTimeString()}]</span>
                     <span className="break-words">{log}</span>
                  </div>
                ))}
                <div ref={logsEndRef} />
             </div>
             
             {/* Terminal Input */}
             {isPaused ? (
                 <div className="p-3 border-t border-gray-800 bg-orange-900/30">
                    <div className="text-orange-500 text-[10px] uppercase tracking-widest mb-2 font-bold flex items-center">⚠️ OVERRIDE REQUIRED_</div>
                    <input 
                      type="text" 
                      value={interruptMessage} 
                      onChange={e=>setInterruptMessage(e.target.value)} 
                      onKeyDown={e=>e.key==='Enter'&&handleResume()} 
                      className="w-full bg-black/50 text-orange-200 px-3 py-2 text-xs font-mono outline-none border border-orange-500/50 rounded shadow-inner" 
                      placeholder="E.g., 'All looks good, proceed' or 'Change database to Postgres'" 
                    />
                 </div>
             ) : (
                 <div className="p-3 border-t border-gray-800 bg-black/40 flex items-center">
                     <span className="text-[#39ff14] mr-3 font-bold">{'>'}</span>
                     <input 
                       type="text" 
                       value={inputIdea} 
                       onChange={e=>setInputIdea(e.target.value)} 
                       onKeyDown={e=>e.key==='Enter'&&handleSend()} 
                       className="w-full bg-transparent text-[#39ff14] font-mono outline-none text-xs placeholder-gray-600" 
                       placeholder="Input prompt directive..." 
                     />
                 </div>
             )}
         </div>
      </div>

      {/* 4. Bottom Footer: Game HUD */}
      <div className="absolute bottom-0 left-0 w-full h-[100px] bg-[#050B14]/90 backdrop-blur-xl border-t border-gray-800 z-10 flex items-center px-8 pointer-events-auto">
         <div className="flex w-full overflow-x-auto items-center justify-between pb-2" style={{ scrollbarWidth: 'none' }}>
            
            {/* The 8 Agents HUD */}
            <div className="flex space-x-8 items-end h-full pt-4">
               {AGENT_PODS.map(pod => {
                  const isActive = pod.id === activeNode;
                  return (
                     <div key={pod.id} className={`flex flex-col items-center transition-all duration-300 ${isActive ? 'scale-110 -translate-y-2' : 'opacity-50 hover:opacity-100 hover:-translate-y-1'}`}>
                         <div className={`w-12 h-12 lg:w-14 lg:h-14 rounded-full border-2 overflow-hidden bg-gray-900 relative ${isActive ? '' : ''}`} style={{ borderColor: isActive ? pod.color : '#374151', boxShadow: isActive ? `0 0 20px ${pod.color}80` : 'none' }}>
                            <img src={pod.avatar} alt={pod.label} className="w-full h-full object-cover" />
                            {!isActive && <div className="absolute inset-0 bg-black/40" />}
                         </div>
                         <span className="text-[9px] font-bold mt-2 uppercase tracking-widest whitespace-nowrap" style={{ color: isActive ? pod.color : '#9ca3af' }}>{pod.label}</span>
                         {/* Health bar */}
                         <div className="w-10 lg:w-14 h-1 bg-gray-800 rounded-full mt-1.5 overflow-hidden">
                             {isActive ? (
                                <div className="h-full bg-white rounded-full relative" style={{ width: '100%', backgroundColor: pod.color }}>
                                    <div className="absolute inset-0 bg-white/50 animate-pulse" />
                                </div>
                             ) : (
                                <div className="h-full rounded-full bg-gray-700" style={{ width: '100%' }} />
                             )}
                         </div>
                     </div>
                  )
               })}
            </div>
            
            {/* Status Panel Metrics */}
            <div className="ml-8 pr-4 flex items-center justify-center border-l border-gray-800 pl-8 h-full">
               <div className="flex flex-col items-end justify-center mr-6">
                   <div className="text-[10px] text-gray-500 font-mono tracking-widest mb-1">GLOBAL_STATE</div>
                   <div className="text-sm font-bold tracking-widest uppercase" style={{ color: telemetry?.current_phase === 'task_revision' ? '#ef4444' : '#00f2ff' }}>
                       {telemetry?.current_phase ? telemetry.current_phase.replace('_', ' ') : 'OPERATIONAL'}
                   </div>
               </div>
               
               <div className="flex flex-col items-end justify-center hidden lg:flex">
                   <div className="text-[10px] text-gray-500 font-mono tracking-widest mb-1">NODE_LATENCY</div>
                   <div className="text-sm font-bold tracking-widest text-[#bc00ff]">
                       {telemetry?.telemetry?.[activeNode||""]?.latency ? `${telemetry.telemetry[activeNode!].latency}s` : '0.0s'}
                   </div>
               </div>
            </div>
         </div>
      </div>

      {/* Modal Overlay for DocumentHub */}
      {showDocs && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050B14]/90 backdrop-blur-xl p-4 lg:p-10 animate-fade-in print:p-0 print:bg-white print:block">
              <div className="relative w-full h-full max-w-7xl max-h-[90vh] bg-[#0b1320] rounded-2xl shadow-[0_0_50px_rgba(0,242,255,0.1)] flex flex-col overflow-hidden border border-gray-800 print:h-auto print:border-none print:shadow-none print:max-h-none print:max-w-none">
                  <div className="flex justify-between items-center p-6 border-b border-gray-800 bg-black/40 print:hidden">
                      <div>
                          <h2 className={`text-2xl font-bold flex items-center tracking-widest ${isPaused ? 'text-orange-500 animate-pulse' : 'text-white'}`}>
                              {isPaused ? (
                                <><span className="mr-3 text-4xl">⚠️</span> HUMAN REVIEW REQUIRED</>
                              ) : (
                                <><span className="mr-3 text-[#00f2ff] text-3xl">⬢</span> ARTIFACTS VAULT</>
                              )}
                          </h2>
                          {isPaused && (
                              <p className="text-orange-400/80 text-xs font-mono mt-2 tracking-widest uppercase">
                                  Review the documents below. Close this vault and provide your feedback in the terminal.
                              </p>
                          )}
                      </div>
                      <button 
                        onClick={() => setShowDocs(false)} 
                        className="text-gray-400 hover:text-white bg-gray-900 border border-gray-700 hover:border-[#ef4444] hover:bg-[#ef4444]/20 px-6 py-2 rounded-lg font-mono text-xs font-bold uppercase tracking-widest transition-all shadow-md active:scale-95"
                      >
                          CLOSE VAULT
                      </button>
                  </div>
                  <div className="flex-1 overflow-hidden relative print:overflow-visible p-6">
                      <DocumentHub docs={docs} />
                  </div>
              </div>
          </div>
      )}

      {/* Market Scout Feature Selection Modal */}
      {marketResearchData && (
        <MarketScoutModal
          data={marketResearchData}
          onProceed={(features) => handleFeatureSelect(features)}
          onSkip={() => handleFeatureSelect([])}
        />
      )}
    </div>
  );
}
