import { embedMany, embed, cosineSimilarity } from 'ai';
import { openai } from '@ai-sdk/openai';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface CodeChunk {
  path: string;
  content: string;
  vector: number[];
  startLine: number;
  endLine: number;
}

export interface SearchResult {
  path: string;
  startLine: number;
  endLine: number;
  snippet: string;
  score: number;
}

let globalKnowledgeBase: CodeChunk[] = [];
let currentCodebase = '';

function chunkByLines(content: string, linesPerChunk = 80) {
  const lines = content.split(/\r?\n/);
  const chunks: Array<{ content: string; startLine: number; endLine: number }> = [];

  for (let startIndex = 0; startIndex < lines.length; startIndex += linesPerChunk) {
    const endIndex = Math.min(startIndex + linesPerChunk, lines.length);
    const chunkLines = lines.slice(startIndex, endIndex);
    chunks.push({
      content: chunkLines.join('\n'),
      startLine: startIndex + 1,
      endLine: endIndex
    });
  }

  return chunks;
}

function summarizeSnippet(content: string, maxLines = 12) {
  return content.split(/\r?\n/).slice(0, maxLines).join('\n');
}

export async function buildKnowledgeBase(basePath: string, files: string[]) {
  if (currentCodebase === basePath && globalKnowledgeBase.length > 0) return; // already built
  console.log('🧠 Building RAG Knowledge Base...');

  const chunks: Array<{ path: string; content: string; startLine: number; endLine: number }> = [];
  
  files.forEach(file => {
    try {
      const content = readFileSync(join(basePath, file), 'utf-8');
      chunkByLines(content).forEach(chunk => {
        chunks.push({
          path: file,
          content: chunk.content,
          startLine: chunk.startLine,
          endLine: chunk.endLine
        });
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

export async function searchKnowledgeBase(query: string, topK = 5): Promise<SearchResult[]> {
  if (globalKnowledgeBase.length === 0) return [];

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

  return topChunks.map((chunk, index) => ({
    path: chunk.path,
    startLine: chunk.startLine,
    endLine: chunk.endLine,
    snippet: summarizeSnippet(chunk.content),
    score: scored[index].score
  }));
}

export async function retrieveContext(query: string, topK = 5): Promise<string> {
  const results = await searchKnowledgeBase(query, topK);

  if (results.length === 0) return 'No context available.';

  return results.map(c => `File: ${c.path} [L${c.startLine}-L${c.endLine}]\n\`\`\`\n${c.snippet}\n\`\`\``).join('\n\n');
}
