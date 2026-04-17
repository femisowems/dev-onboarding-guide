import express from 'express';
import cors from 'cors';
import { resolveCodebase, cleanupCodebase } from './ingest/fetcher';
import { parseCodebase } from './parser/analyzer';
import { buildDependencyGraph } from './parser/graph';
import { generateCodebaseSummary } from './ai/summary';

export function startServer(port = 3000) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.post('/api/analyze', async (req, res) => {
    const { target } = req.body;
    if (!target) return res.status(400).json({ error: 'Target URL required' });

    let resolvedPath = target;
    try {
      resolvedPath = resolveCodebase(target);
      const { entryPoints, modules } = parseCodebase(resolvedPath);
      const graph = buildDependencyGraph(modules);
      const aiSummary = await generateCodebaseSummary(entryPoints, graph);
      res.json(aiSummary);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    } finally {
      if (resolvedPath !== target) cleanupCodebase(resolvedPath);
    }
  });

  app.listen(port, () => console.log(`🚀 API Server running on http://localhost:${port}`));
}
