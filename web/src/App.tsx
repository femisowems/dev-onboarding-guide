import { useState } from 'react';
import { Activity, Github, Terminal, ArrowRight, Package } from 'lucide-react';

export default function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);

  const analyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch('http://localhost:3000/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: url })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to analyze');
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <div className="flex justify-center"><Terminal className="w-12 h-12 text-blue-600" /></div>
          <h1 className="text-4xl font-extrabold tracking-tight">Codebase Onboarding Bot</h1>
          <p className="text-lg text-gray-500">Drop a GitHub URL to generate a custom onboarding spec.</p>
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
            disabled={loading || !url}
            className="absolute right-2 px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {loading ? <Activity className="animate-spin w-5 h-5" /> : 'Analyze'}
          </button>
        </form>

        {error && <div className="p-4 bg-red-50 text-red-700 rounded-xl">{error}</div>}

        {result && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-bold flex items-center gap-2 mb-4"><Activity className="text-blue-500"/> Architecture Overview</h2>
              <p className="text-gray-700 leading-relaxed text-lg">{result.overview}</p>
            </section>

            <div className="grid md:grid-cols-2 gap-8">
              <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold flex items-center gap-2 mb-6"><Package className="text-purple-500"/> Key Modules</h2>
                <div className="space-y-6">
                  {result.keyModules?.map((mod: any, i: number) => (
                    <div key={i}>
                      <h3 className="font-semibold text-gray-900">{mod.name}</h3>
                      <p className="text-gray-600 mt-1">{mod.responsibility}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold flex items-center gap-2 mb-6"><ArrowRight className="text-green-500"/> Where to Start</h2>
                <div className="space-y-4">
                  {result.onboardingSteps?.map((step: string, i: number) => (
                    <div key={i} className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 text-green-700 font-bold flex items-center justify-center">
                        {i + 1}
                      </div>
                      <p className="text-gray-700 pt-1">{step}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
