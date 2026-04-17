import { useState } from 'react';
import { Activity, Github, Terminal, ArrowRight, Package, MessageSquare } from 'lucide-react';
import { experimental_useObject as useObject, useChat } from '@ai-sdk/react';
import { z } from 'zod';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const schema = z.object({
  overview: z.string().describe('A high-level architectural overview (2-3 sentences max).'),
  keyModules: z.array(z.object({
    name: z.string(),
    responsibility: z.string()
  })).describe('3-5 critical modules and their exact technical responsibility.'),
  onboardingSteps: z.array(z.string()).describe('A strict, 3-4 step chronological path for a new engineer to read the code.')
});

export default function App() {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const { object, submit, isLoading: isAnalyzing } = useObject({
    api: 'http://localhost:3000/api/analyze-stream',
    schema
  });

  const { messages, input, handleInputChange, handleSubmit, isLoading: isChatting } = useChat({
    api: 'http://localhost:3000/api/chat',
  });

  const analyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    submit({ target: url });
  };

  // Convert incoming keyModules object stream into partial ReactFlow nodes
  const nodes = object?.keyModules?.map((mod, i) => ({
    id: mod.name || i.toString(),
    position: { x: (i % 2) * 300, y: Math.floor(i / 2) * 150 },
    data: { label: mod.name || 'Loading...' },
    style: { padding: '10px', borderRadius: '8px', border: '1px solid #ddd', background: 'white' }
  })) || [];

  // Simple sequential flow representation
  const edges = nodes.map((n, i) => {
    if (i === 0) return null;
    return { id: `e${nodes[i-1].id}-${n.id}`, source: nodes[i-1].id, target: n.id, animated: true };
  }).filter(Boolean) as any[];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-8 font-sans pb-24">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <div className="flex justify-center"><Terminal className="w-12 h-12 text-blue-600" /></div>
          <h1 className="text-4xl font-extrabold tracking-tight">Codebase Onboarding Bot</h1>
          <p className="text-lg text-gray-500">Drop a GitHub URL to stream a custom onboarding spec.</p>
        </div>

        <form onSubmit={analyze} className="relative flex items-center shadow-sm rounded-xl overflow-hidden border border-gray-200 bg-white">
          <Github className="absolute left-4 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/facebook/react"
            className="w-full pl-12 pr-32 py-4 focus:outline-none text-lg bg-transparent"
          />
          <button 
            type="submit" 
            disabled={isAnalyzing || !url}
            className="absolute right-2 px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {isAnalyzing ? <Activity className="animate-pulse w-5 h-5" /> : 'Analyze'}
          </button>
        </form>

        {error && <div className="p-4 bg-red-50 text-red-700 rounded-xl">{error}</div>}

        {object && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-bold flex items-center gap-2 mb-4"><Activity className="text-blue-500"/> Architecture Overview</h2>
              <p className="text-gray-700 leading-relaxed text-lg whitespace-pre-wrap">
                {object.overview || <span className="animate-pulse text-gray-400">Analyzing architecture...</span>}
              </p>
            </section>

            {/* REACT FLOW MAP */}
            {nodes.length > 0 && (
              <section className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 h-96 relative">
                 <h2 className="text-xl font-bold flex items-center gap-2 mb-2 px-4 pt-2">
                   <Package className="text-purple-500"/> Dependency Map
                 </h2>
                 <ReactFlow nodes={nodes} edges={edges} fitView className="w-full h-full">
                    <Background />
                    <Controls />
                 </ReactFlow>
              </section>
            )}

            <div className="grid md:grid-cols-2 gap-8">
              <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold flex items-center gap-2 mb-6"><Package className="text-purple-500"/> Key Modules</h2>
                <div className="space-y-6">
                  {object.keyModules?.map((mod: any, i: number) => (
                    <div key={i} className={!mod.responsibility ? 'animate-pulse' : ''}>
                      <h3 className="font-semibold text-gray-900">{mod.name || 'Loading module...'}</h3>
                      <p className="text-gray-600 mt-1">{mod.responsibility || '...'}</p>
                    </div>
                  ))}
                  {isAnalyzing && (!object.keyModules || object.keyModules.length === 0) && <div className="animate-pulse text-gray-400">Discovering modules...</div>}
                </div>
              </section>

              <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold flex items-center gap-2 mb-6"><ArrowRight className="text-green-500"/> Where to Start</h2>
                <div className="space-y-4">
                  {object.onboardingSteps?.map((step: string, i: number) => (
                    <div key={i} className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 text-green-700 font-bold flex items-center justify-center">
                        {i + 1}
                      </div>
                      <p className="text-gray-700 pt-1">{step}</p>
                    </div>
                  ))}
                  {isAnalyzing && (!object.onboardingSteps || object.onboardingSteps.length === 0) && <div className="animate-pulse text-gray-400">Charting path...</div>}
                </div>
              </section>
            </div>

            {/* AI CHATBOT (RAG) */}
            <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 mt-8 mb-16">
              <h2 className="text-xl font-bold flex items-center gap-2 mb-6"><MessageSquare className="text-blue-500"/> Ask the Codebase</h2>
              <div className="space-y-4 max-h-96 overflow-y-auto mb-4 border rounded-xl p-4 bg-gray-50 min-h-32">
                {messages.length === 0 && <p className="text-gray-400 text-center mt-8">Ask any technical question about this repository...</p>}
                {messages.map(m => (
                  <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-xl px-4 py-2 ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border text-gray-800'}`}>
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    </div>
                  </div>
                ))}
                {isChatting && <div className="animate-pulse text-gray-500">Processing vector context...</div>}
              </div>
              <form onSubmit={handleSubmit} className="relative flex items-center">
                <input 
                  type="text" 
                  value={input} 
                  onChange={handleInputChange} 
                  placeholder="e.g. How is the database connection established?" 
                  className="w-full pl-4 pr-24 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <button type="submit" disabled={isChatting || !input} className="absolute right-2 px-4 py-1.5 bg-gray-900 text-white rounded-lg disabled:opacity-50">
                  Send
                </button>
              </form>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
