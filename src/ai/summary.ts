import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { GraphNode } from '../parser/graph';

export interface AIAnalysisResult {
  overview: string;
  keyModules: Array<{ name: string; responsibility: string }>;
  onboardingSteps: string[];
}

export async function generateCodebaseSummary(
  entryPoints: string[],
  graph: GraphNode[]
): Promise<AIAnalysisResult> {
  const context = JSON.stringify({
    entryPoints,
    modules: graph.map(g => ({
      name: g.module,
      internalDependencies: g.dependsOn,
      externalDependencies: g.externalDeps
    }))
  });

  const { object } = await generateObject({
    model: openai('gpt-4o'),
    schema: z.object({
      overview: z.string().describe('A high-level architectural overview (2-3 sentences max).'),
      keyModules: z.array(z.object({
        name: z.string(),
        responsibility: z.string()
      })).describe('3-5 critical modules and their exact technical responsibility.'),
      onboardingSteps: z.array(z.string()).describe('A strict, 3-4 step chronological path for a new engineer to read the code.')
    }),
    prompt: `You are a Principal Engineer onboarding a new hire. Analyze the codebase structure and relationships, then generate the spec.
    
STRIPPED AST CONTEXT:
${context}

RULES:
- Be highly technical, terse, and precise.
- Only analyze the provided AST context. Do NOT hallucinate code.
- Focus on the data flow and entry points.`
  });

  return object;
}
