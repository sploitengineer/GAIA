"use client";
import React from "react";
import { ReactFlow, Controls, Background, Node, Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const initialNodes: Node[] = [
  { id: "1", position: { x: 250, y: 0 }, data: { label: "Sufficiency Checker" }, style: { backgroundColor: "#1f2937", color: "white", padding: 10 } },
  { id: "2", position: { x: 50, y: 100 }, data: { label: "Clarification Agent" }, style: { backgroundColor: "#1f2937", color: "white", padding: 10 } },
  { id: "3", position: { x: 250, y: 100 }, data: { label: "Context Synthesizer" }, style: { backgroundColor: "#1f2937", color: "white", padding: 10 } },
  { id: "4", position: { x: 250, y: 200 }, data: { label: "PM Agent (PRD)" }, style: { backgroundColor: "#1f2937", color: "white", padding: 10 } },
  { id: "5", position: { x: 250, y: 300 }, data: { label: "Scrum Agent (Epics)" }, style: { backgroundColor: "#1f2937", color: "white", padding: 10 } },
  { id: "6", position: { x: 250, y: 400 }, data: { label: "Task Agent" }, style: { backgroundColor: "#1f2937", color: "white", padding: 10 } },
  { id: "7", position: { x: 250, y: 500 }, data: { label: "QA Reviewer" }, style: { backgroundColor: "#1f2937", color: "white", padding: 10 } },
];

const initialEdges: Edge[] = [
  { id: "e1-2", source: "1", target: "2", animated: true },
  { id: "e1-3", source: "1", target: "3", animated: true },
  { id: "e2-3", source: "2", target: "3", animated: true },
  { id: "e3-4", source: "3", target: "4", animated: true },
  { id: "e4-5", source: "4", target: "5", animated: true },
  { id: "e5-6", source: "5", target: "6", animated: true },
  { id: "e6-7", source: "6", target: "7", animated: true },
  { id: "e7-6", source: "7", target: "6", animated: true, label: "QA FAILED", style: { stroke: "#ef4444", strokeWidth: 2 } },
];

const NODE_MAP: Record<string, string> = {
  "sufficiency_node": "1",
  "clarification_node": "2",
  "context_synthesizer_node": "3",
  "requirement_node": "3", // bundled for visual simplicity
  "pm_node": "4",
  "scrum_node": "5",
  "task_node": "6",
  "reviewer_node": "7"
};

export default function AgentFlow({ activeNode }: { activeNode: string | null }) {
  const nodes = initialNodes.map((n) => {
    const isActive = NODE_MAP[activeNode || ""] === n.id;
    return {
      ...n,
      style: {
        ...n.style,
        backgroundColor: isActive ? "#3b82f6" : "#1f2937",
        boxShadow: isActive ? "0 0 20px #3b82f6" : "none",
        transition: "all 0.3s ease"
      }
    };
  });

  return (
    <div style={{ height: "400px", width: "100%", background: "#111827", borderRadius: "10px", overflow: "hidden" }}>
      <ReactFlow nodes={nodes} edges={initialEdges} fitView colorMode="dark">
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
