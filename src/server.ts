import express from 'express';
import cors from 'cors';
import { resolveCodebase, cleanupCodebase } from './ingest/fetcher';
import { parseCodebase } from './parser/analyzer';
import { buildDependencyGraph } from './parser/graph';
import { generateCodebaseSummary, streamCodebaseSummary } from './ai/summary';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { buildKnowledgeBase, retrieveContext } from './ai/rag';
import { getRemoteHash, getCachedAST, saveASTCache } from './ingest/cache';

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

  // Store global paths for RAG
  let latestResolvedPath = '';
  let latestFiles: string[] = [];

  app.post('/api/analyze-stream', async (req, res) => {
    const { target } = req.body;
    if (!target) return res.status(400).json({ error: 'Target URL required' });

    let resolvedPath = target;
    try {
      let hash = target.startsWith('http') ? getRemoteHash(target) : target;
      let astData = hash ? getCachedAST(hash) : null;

      resolvedPath = resolveCodebase(target);
      latestResolvedPath = resolvedPath;

      if (!astData) {
        console.log('🐌 No AST cache found or parsing locally. Processing...');
        const { entryPoints, modules } = parseCodebase(resolvedPath);
        latestFiles = modules.flatMap(m => m.files);
        const graph = buildDependencyGraph(modules);
        
        astData = { entryPoints, graph, latestFiles };
        if (hash) saveASTCache(hash, astData);
      } else {
        console.log('⚡ AST Cache hit! Skipping ts-morph parsing.');
        latestFiles = astData.latestFiles;
      }
      
      const result = await streamCodebaseSummary(astData.entryPoints, astData.graph);
      result.pipeTextStreamToResponse(res);
      
      // Cleanup happens asynchronously after stream finishes - a minor gap for this MVP
    } catch (error: any) {
      if (resolvedPath !== target) cleanupCodebase(resolvedPath);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/chat', async (req, res) => {
    const { messages } = req.body;
    
    // Ensure KB is built (happens instantly if already cached)
    if (latestResolvedPath && latestFiles.length > 0) {
      await buildKnowledgeBase(latestResolvedPath, latestFiles);
    }

    const lastMessage = messages[messages.length - 1].content;
    const context = await retrieveContext(lastMessage);

    const result = await streamText({
      model: openai('gpt-4o'),
      system: `You are an expert codebase assistant. Act as if you maintain this repository. Use ONLY the following contextual code chunks to answer questions:\n\n${context}`,
      messages
    });

    result.pipeDataStreamToResponse(res);
  });

  app.listen(port, () => console.log(`🚀 API Server running on http://localhost:${port}`));
}
