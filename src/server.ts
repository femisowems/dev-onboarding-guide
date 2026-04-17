import express from 'express';
import cors from 'cors';
import { resolveCodebase, cleanupCodebase } from './ingest/fetcher';
import { parseCodebase } from './parser/analyzer';
import { buildDependencyGraph } from './parser/graph';
import { AUDIENCE_ROLES, AudienceRole, generateCodebaseSummary, getRoleGuidance, streamCodebaseSummary } from './ai/summary';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { buildKnowledgeBase, retrieveContext, searchKnowledgeBase } from './ai/rag';
import { getRemoteHash, getCachedAST, saveASTCache } from './ingest/cache';
import { CodeModule } from './parser/analyzer';

type CachedAnalysis = {
  entryPoints: string[];
  modules: CodeModule[];
  graph: ReturnType<typeof buildDependencyGraph>;
  latestFiles: string[];
};

function parseRole(value: unknown): AudienceRole {
  if (typeof value === 'string' && (AUDIENCE_ROLES as readonly string[]).includes(value)) {
    return value as AudienceRole;
  }

  return 'backend';
}

export function startServer(port = 3000) {
  const app = express();
  app.use(cors());
  app.use(express.json());
  const maxPortRetries = 10;

  app.post('/api/analyze', async (req, res) => {
    const { target, role } = req.body;
    if (!target) return res.status(400).json({ error: 'Target URL required' });
    const selectedRole = parseRole(role);

    let resolvedPath = target;
    try {
      resolvedPath = resolveCodebase(target);
      const { entryPoints, modules } = parseCodebase(resolvedPath);
      const graph = buildDependencyGraph(modules);
      const aiSummary = await generateCodebaseSummary(entryPoints, modules, graph, selectedRole);
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
    const { target, role } = req.body;
    if (!target) return res.status(400).json({ error: 'Target URL required' });
    const selectedRole = parseRole(role);

    let resolvedPath = target;
    try {
      let hash = target.startsWith('http') ? getRemoteHash(target) : target;
      let astData = (hash ? getCachedAST(hash) : null) as CachedAnalysis | null;

      resolvedPath = resolveCodebase(target);
      latestResolvedPath = resolvedPath;

      if (!astData || !astData.modules) {
        console.log('🐌 No AST cache found or parsing locally. Processing...');
        const { entryPoints, modules } = parseCodebase(resolvedPath);
        latestFiles = modules.flatMap(m => m.files);
        const graph = buildDependencyGraph(modules);
        
        astData = { entryPoints, modules, graph, latestFiles };
        if (hash) saveASTCache(hash, astData);
      } else {
        console.log('⚡ AST Cache hit! Skipping ts-morph parsing.');
        latestFiles = astData.latestFiles;
        if (!astData.modules.length) {
          const parsed = parseCodebase(resolvedPath);
          astData.modules = parsed.modules;
          astData.entryPoints = parsed.entryPoints;
          astData.graph = buildDependencyGraph(parsed.modules);
          latestFiles = parsed.modules.flatMap(m => m.files);
          if (hash) saveASTCache(hash, astData);
        }
      }
      
      const result = await streamCodebaseSummary(target, astData.entryPoints, astData.modules, astData.graph, selectedRole);
      result.pipeTextStreamToResponse(res);
      
      // Cleanup happens asynchronously after stream finishes - a minor gap for this MVP
    } catch (error: any) {
      if (resolvedPath !== target) cleanupCodebase(resolvedPath);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/chat', async (req, res) => {
    const { messages, role } = req.body;
    const selectedRole = parseRole(role);
    
    // Ensure KB is built (happens instantly if already cached)
    if (latestResolvedPath && latestFiles.length > 0) {
      await buildKnowledgeBase(latestResolvedPath, latestFiles);
    }

    const lastMessage = messages[messages.length - 1].content;
    const context = await retrieveContext(lastMessage);

    const result = await streamText({
      model: openai('gpt-4o'),
      system: `You are an expert codebase assistant. Act as if you maintain this repository. Use ONLY the following contextual code chunks to answer questions.

Role perspective: ${selectedRole}
Role guidance: ${getRoleGuidance(selectedRole)}

Be direct and specific. When possible, cite the exact file paths and line ranges from the provided context in a short Sources section at the end.

Context:\n\n${context}`,
      messages
    });

    result.pipeDataStreamToResponse(res);
  });

  app.post('/api/search', async (req, res) => {
    const { target, query } = req.body;

    if (!query) return res.status(400).json({ error: 'Search query required' });

    let resolvedPath = target || latestResolvedPath;

    if (!resolvedPath) {
      return res.status(400).json({ error: 'Analyze a repository first' });
    }

    try {
      if (target && target !== latestResolvedPath) {
        resolvedPath = resolveCodebase(target);
        const { modules } = parseCodebase(resolvedPath);
        latestResolvedPath = resolvedPath;
        latestFiles = modules.flatMap(m => m.files);
      }

      if (latestResolvedPath && latestFiles.length > 0) {
        await buildKnowledgeBase(latestResolvedPath, latestFiles);
      }

      const results = await searchKnowledgeBase(query);
      res.json({ results });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    } finally {
      if (target && resolvedPath !== target) cleanupCodebase(resolvedPath);
    }
  });

  const listenWithFallback = (desiredPort: number, retriesLeft: number) => {
    const server = app.listen(desiredPort, () => {
      console.log(`🚀 API Server running on http://localhost:${desiredPort}`);
    });

    server.once('error', (error: any) => {
      if (error?.code === 'EADDRINUSE' && retriesLeft > 0) {
        const nextPort = desiredPort + 1;
        console.warn(`⚠️ Port ${desiredPort} is in use. Retrying on ${nextPort}...`);
        listenWithFallback(nextPort, retriesLeft - 1);
        return;
      }

      throw error;
    });
  };

  listenWithFallback(port, maxPortRetries);
}
