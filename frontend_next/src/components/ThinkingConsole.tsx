import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";

export default function ThinkingConsole({ logs }: { logs: string[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="bg-gray-900 text-green-400 font-mono text-sm p-4 h-64 overflow-y-auto rounded-xl shadow-inner border border-gray-700">
      <div className="flex items-center space-x-2 mb-2">
        <div className="w-3 h-3 rounded-full bg-red-500"></div>
        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
        <div className="w-3 h-3 rounded-full bg-green-500"></div>
        <span className="text-gray-500 ml-2">Agent Terminal</span>
      </div>
      {logs.map((log, index) => (
        <motion.div 
          key={index} 
          initial={{ opacity: 0, x: -10 }} 
          animate={{ opacity: 1, x: 0 }} 
          className="mb-1"
        >
          {">"} {log}
        </motion.div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
