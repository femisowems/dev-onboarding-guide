import { useState, useEffect } from 'react';
import { Activity, Github, Terminal, ArrowRight, Package, MessageSquare, Search } from 'lucide-react';
import { experimental_useObject as useObject, useChat } from '@ai-sdk/react';
import { z } from 'zod';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

type OnboardingStep = {
  title: string;
  filePath: string;
  why: string;
  focus: string;
};

type SearchResult = {
  path: string;
  startLine: number;
  endLine: number;
  snippet: string;
  score: number;
};

type AudienceRole = 'frontend' | 'backend' | 'platform' | 'product-qa';

const roleLabel: Record<AudienceRole, string> = {
  frontend: 'Frontend',
  backend: 'Backend',
  platform: 'Platform',
  'product-qa': 'Product / QA'
};

const schema = z.object({
  repoName: z.string().describe('The name of the repository based on the URL or root folder.'),
  tagline: z.string().describe('A catchy 4-word technical tagline of what this codebase builds.'),
  overview: z.string().describe('A high-level architectural overview (2-3 sentences max).'),
  keyModules: z.array(z.object({
    name: z.string(),
    responsibility: z.string()
  })).describe('3-5 critical modules and their exact technical responsibility.'),
  onboardingSteps: z.array(z.object({
    title: z.string(),
    filePath: z.string(),
    why: z.string(),
    focus: z.string()
  })).describe('A strict, 3-4 step chronological path for a new engineer to read the code. Each step must name one concrete file path from the context.')
});

export default function App() {
  const configuredApiBase = (import.meta as any).env?.VITE_API_BASE_URL as string | undefined;
  const [url, setUrl] = useState('');
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<AudienceRole>('backend');
  const [apiBase, setApiBase] = useState(configuredApiBase || 'http://localhost:3000');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const { object, submit, isLoading: isAnalyzing } = useObject({
    api: `${apiBase}/api/analyze-stream`,
    schema
  });

  const { messages, input, handleInputChange, handleSubmit, isLoading: isChatting } = useChat({
    api: `${apiBase}/api/chat`,
    body: { role }
  });

  const analyze = async () => {
    setOpen(false);
    setSearchResults([]);
    submit({ target: url, role });
  };

  const runSearch = async () => {
    if (!url || !searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(`${apiBase}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: url, query: searchQuery, role })
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      setSearchResults(data.results || []);
    } finally {
      setIsSearching(false);
    }
  };

  // Toggle the Command Palette with Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  useEffect(() => {
    if (configuredApiBase) {
      setApiBase(configuredApiBase);
      return;
    }

    let cancelled = false;
    const candidatePorts = [3000, 3001, 3002, 3003, 3004, 3005];

    const discoverApi = async () => {
      for (const candidatePort of candidatePorts) {
        const candidateBase = `http://localhost:${candidatePort}`;
        try {
          const response = await fetch(`${candidateBase}/api/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: '__healthcheck__' })
          });

          if (!cancelled && response.status < 500) {
            setApiBase(candidateBase);
            return;
          }
        } catch {
          // Keep probing candidate ports until one responds.
        }
      }
    };

    discoverApi();

    return () => {
      cancelled = true;
    };
  }, [configuredApiBase]);

  const nodes = object?.keyModules?.map((mod, i) => ({
    id: mod?.name || i.toString(),
    position: { x: 50 + (i % 2) * 250, y: 50 + Math.floor(i / 2) * 150 },
    data: { label: <div className="text-sm font-semibold">{mod?.name || 'Loading...'}</div> },
    style: { padding: '12px', borderRadius: '12px', border: '1px solid #e5e7eb', background: '#fff', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }
  })) || [];

  const edges = nodes.map((n, i) => {
    if (i === 0) return null;
    return { id: `e${nodes[i-1].id}-${n.id}`, source: nodes[i-1].id, target: n.id, animated: true, style: { stroke: '#9ca3af', strokeWidth: 2 } };
  }).filter(Boolean) as any[];

  return (
    <div className="h-screen w-screen bg-[#FDFDFD] overflow-hidden flex font-sans text-gray-900 absolute top-0 left-0 m-0">
      
      {/* ⌘K Command Palette Overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-gray-900/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col mx-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center px-4 border-b border-gray-100">
              <Github className="w-5 h-5 text-gray-400 mr-3" />
              <input
                autoFocus
                placeholder="Paste GitHub URL..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && url) analyze(); }}
                className="w-full py-5 text-lg outline-none bg-transparent"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as AudienceRole)}
                className="mr-2 px-2 py-2 text-sm rounded-md border border-gray-200 bg-white text-gray-700"
              >
                <option value="frontend">Frontend</option>
                <option value="backend">Backend</option>
                <option value="platform">Platform</option>
                <option value="product-qa">Product / QA</option>
              </select>
              <button 
                onClick={analyze}
                disabled={!url || isAnalyzing}
                className="px-4 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium ml-2 disabled:opacity-50"
              >
                Analyze
              </button>
            </div>
            <div className="px-4 py-3 bg-gray-50 text-xs text-gray-500 font-medium">
              Press <kbd className="bg-white border rounded px-1 shadow-sm font-sans mx-1">Enter</kbd> to submit
              <span className="ml-3 text-slate-400">API: {apiBase}</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Split-Pane Architecture */}
      <PanelGroup direction="horizontal" className="h-full w-full">
        
        {/* Left Pane: React Flow Canvas */}
        <Panel defaultSize={60} minSize={30} className="h-full relative bg-[#F8FAFC]">
          {!object ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-center px-8">
              <div className="w-20 h-20 bg-white shadow-xl rounded-2xl flex items-center justify-center mb-6 border border-gray-100">
                <Terminal className="w-10 h-10 text-blue-600" />
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-3">Onboarding Bot</h1>
              <p className="text-slate-500 text-lg mb-8 max-w-md mx-auto">Press <kbd className="bg-white border rounded shadow-sm px-2 py-1 text-slate-700 font-bold mx-1">⌘K</kbd> to analyze a repository.</p>
            </div>
          ) : (
            <ReactFlow nodes={nodes} edges={edges} fitView className="w-full h-full" minZoom={0.2}>
              <Background gap={24} size={2} color="#e2e8f0" />
              <Controls className="bg-white border-0 shadow-lg rounded-xl overflow-hidden" />
            </ReactFlow>
          )}
        </Panel>

        <PanelResizeHandle className="w-2 relative bg-gray-100 hover:bg-blue-500/20 active:bg-blue-500/40 transition-colors flex items-center justify-center cursor-col-resize z-10" />

        {/* Right Pane: LLM Context & Chat */}
        <Panel defaultSize={40} minSize={30} className="h-full bg-white flex flex-col shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.05)] z-20">
          
          {object ? (
            <>
              {/* Scrollable Architecture Specs */}
              <div className="flex-1 overflow-y-auto px-8 pt-8 pb-32 space-y-10">
                
                <div className="mb-2">
                  <h1 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">
                    {object.repoName || <span className="animate-pulse text-gray-300 bg-gray-100 rounded-md text-transparent">Analyzing repository...</span>}
                  </h1>
                  <p className="text-xs uppercase tracking-wide text-blue-600 font-semibold mb-2">Perspective: {roleLabel[role]}</p>
                  <p className="text-slate-500 font-medium pb-6 border-b border-gray-100">
                    {object.tagline || <span className="animate-pulse text-gray-300 bg-gray-100 rounded-md text-transparent">Scanning dependencies...</span>}
                  </p>
                </div>

                <section>
                  <h2 className="text-xl font-bold flex items-center gap-2 mb-4 text-slate-900"><Activity className="text-blue-500"/> System Overview</h2>
                  <p className="text-slate-700 leading-relaxed text-lg bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    {object.overview || <span className="animate-pulse text-gray-400">Stream incoming...</span>}
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-bold flex items-center gap-2 mb-6 text-slate-900"><ArrowRight className="text-green-500"/> Where to Start</h2>
                  <div className="space-y-4">
                    {object.onboardingSteps?.map((step, i) => (
                      <div key={i} className="flex gap-4 p-4 hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-100">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 text-green-700 font-bold flex items-center justify-center shadow-sm">
                          {i + 1}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="text-slate-900 font-semibold leading-relaxed">{step?.title || '...'}</p>
                            <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                              {roleLabel[role]}
                            </span>
                          </div>
                          <p className="text-green-700 text-sm font-medium">{step?.filePath || '...'}</p>
                          <p className="text-slate-700 text-sm leading-relaxed">{step?.focus || '...'}</p>
                          <p className="text-slate-400 text-sm leading-relaxed">{step?.why || '...'}</p>
                        </div>
                      </div>
                    ))}
                    {isAnalyzing && (!object.onboardingSteps || object.onboardingSteps.length === 0) && <div className="animate-pulse text-gray-400 px-4">Chartering paths...</div>}
                  </div>
                </section>

                <section>
                  <h2 className="text-xl font-bold flex items-center gap-2 mb-6 text-slate-900"><Package className="text-purple-500"/> Module Registry</h2>
                  <div className="space-y-4">
                    {object.keyModules?.map((mod: any, i: number) => (
                      <div key={i} className="p-5 border border-slate-100 rounded-2xl bg-white shadow-sm">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 rounded-full bg-purple-500"></div> {mod.name || 'Resolving...'}
                        </h3>
                        <p className="text-slate-500 text-sm leading-relaxed">{mod.responsibility || '...'}</p>
                      </div>
                    ))}
                  </div>
                </section>

              </div>

              {/* Fixed RAG Chatbot at Bottom */}
              <div className="h-2/5 min-h-[300px] border-t border-gray-100 bg-slate-50 flex flex-col flex-shrink-0">
                <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center gap-2 shadow-sm z-10">
                  <MessageSquare className="w-5 h-5 text-blue-600"/>
                  <span className="font-semibold text-slate-900">Codebase Chat</span>
                </div>

                <div className="border-b border-gray-200 bg-white px-6 py-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Search className="w-4 h-4 text-blue-600" />
                    Search the codebase
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Find where auth, routing, or database wiring lives"
                      className="w-full pl-4 pr-4 py-2.5 bg-slate-100 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm shadow-inner transition-shadow"
                    />
                    <button
                      type="button"
                      onClick={runSearch}
                      disabled={isSearching || !searchQuery.trim() || !object}
                      className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      {isSearching ? 'Searching' : 'Search'}
                    </button>
                  </div>
                  {searchResults.length > 0 && (
                    <div className="max-h-44 overflow-y-auto space-y-2">
                      {searchResults.map((result) => (
                        <div key={`${result.path}:${result.startLine}-${result.endLine}`} className="p-3 rounded-xl border border-slate-100 bg-slate-50">
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <div className="text-sm font-semibold text-slate-900">{result.path}</div>
                            <div className="text-xs text-slate-500">L{result.startLine}-L{result.endLine}</div>
                          </div>
                          <pre className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700 font-sans">{result.snippet}</pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {messages.length === 0 && <p className="text-gray-400 text-center mt-10 text-sm">Ask a scoped technical question, then use the search box above to jump straight to matching files and symbols.</p>}
                  {messages.map(m => (
                    <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl px-5 py-3 shadow-sm ${m.role === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white border border-gray-100 text-slate-800 rounded-bl-sm'}`}>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</p>
                      </div>
                    </div>
                  ))}
                  {isChatting && <div className="animate-pulse text-gray-400 text-sm flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-400"></div> Retrieving vectors...</div>}
                </div>

                <form onSubmit={handleSubmit} className="p-4 bg-white border-t border-gray-200 z-10">
                  <div className="relative flex items-center">
                    <input 
                      autoFocus
                      type="text" 
                      value={input} 
                      onChange={handleInputChange} 
                      placeholder="How is the database connection established?" 
                      className="w-full pl-5 pr-20 py-3 bg-slate-100 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm shadow-inner transition-shadow"
                    />
                    <button type="submit" disabled={isChatting || !input} className="absolute right-2 px-4 py-1.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-sm">
                      Send
                    </button>
                  </div>
                </form>
              </div>
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-center px-8 bg-slate-50 opacity-50">
              <Activity className="w-12 h-12 text-slate-300 mb-4" />
              <p className="text-slate-400 font-medium">Awaiting Spec Generation...</p>
            </div>
          )}

        </Panel>
      </PanelGroup>
    </div>
  );
}
