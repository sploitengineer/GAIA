import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Docs {
  project_brief?: string;
  prd?: string;
  epics?: string;
  tasks?: string;
}

export default function DocumentHub({ docs }: { docs: Docs }) {
  const [activeTab, setActiveTab] = useState<keyof Docs>("project_brief");

  const tabs: { key: keyof Docs; label: string }[] = [
    { key: "project_brief", label: "Project Brief" },
    { key: "prd", label: "PRD" },
    { key: "epics", label: "Epics & Stories" },
    { key: "tasks", label: "Tasks" },
  ];

  const handleDownloadMarkdown = () => {
    const content = docs[activeTab];
    if (!content) return;
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeTab}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintPdf = () => {
     window.print();
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-2xl print:bg-white print:text-black print:border-none print:shadow-none">
      <div className="flex justify-between items-center bg-gray-800 border-b border-gray-700 overflow-x-auto print:hidden">
        <div className="flex">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === t.key
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:bg-gray-700 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
        </div>
        {/* Export Buttons */}
        <div className="flex space-x-2 px-4">
          <button 
             onClick={handleDownloadMarkdown}
             disabled={!docs[activeTab]}
             className="px-3 py-1.5 text-xs font-semibold bg-gray-700 hover:bg-gray-600 text-white rounded transition disabled:opacity-50"
          >
            ↓ Markdown
          </button>
          <button 
             onClick={handlePrintPdf}
             disabled={!docs[activeTab]}
             className="px-3 py-1.5 text-xs font-semibold bg-blue-700 hover:bg-blue-600 text-white rounded transition disabled:opacity-50"
          >
            🖨️ PDF
          </button>
        </div>
      </div>
      
      <div className="p-6 overflow-y-auto h-[70vh] prose prose-invert max-w-none print:prose-p:text-black print:prose-headings:text-black print:h-auto print:overflow-visible">
        {docs[activeTab] ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{docs[activeTab]}</ReactMarkdown>
        ) : (
          <div className="text-gray-500 italic text-center mt-20">
            Document pending generation... Wait for the agent.
          </div>
        )}
      </div>
    </div>
  );
}
