import { embedMany, embed, cosineSimilarity } from 'ai';
import { openai } from '@ai-sdk/openai';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface CodeChunk {
  path: string;
  content: string;
  vector: number[];
}

let globalKnowledgeBase: CodeChunk[] = [];
let currentCodebase = '';

export async function buildKnowledgeBase(basePath: string, files: string[]) {
  if (currentCodebase === basePath && globalKnowledgeBase.length > 0) return; // already built
  console.log('🧠 Building RAG Knowledge Base...');

  const chunks: { path: string; content: string }[] = [];
  
  files.forEach(file => {
    try {
      const content = readFileSync(join(basePath, file), 'utf-8');
      // Simple chunking strategy for MVP: split every roughly 4000 characters
      const chunkedContent = content.match(/.{1,4000}/gs) || [];
      chunkedContent.forEach(chunk => {
        chunks.push({ path: file, content: chunk });
      });
    } catch (e) {}
  });

  if (chunks.length === 0) return;

  const { embeddings } = await embedMany({
    model: openai.embedding('text-embedding-3-small'),
    values: chunks.map(c => c.content)
  });

  globalKnowledgeBase = chunks.map((chunk, i) => ({
    ...chunk,
    vector: embeddings[i]
  }));
  currentCodebase = basePath;
  console.log('✅ RAG Vector Store populated');
}

export async function retrieveContext(query: string, topK = 5): Promise<string> {
  if (globalKnowledgeBase.length === 0) return 'No context available.';

  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: query
  });

  const scored = globalKnowledgeBase.map(chunk => ({
    chunk,
    score: cosineSimilarity(embedding, chunk.vector)
  }));

  scored.sort((a, b) => b.score - a.score);
  const topChunks = scored.slice(0, topK).map(s => s.chunk);

  return topChunks.map(c => `File: ${c.path}\n\`\`\`\n${c.content}\n\`\`\``).join('\n\n');
}
