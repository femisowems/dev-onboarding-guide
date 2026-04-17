import { generateObject, streamObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { GraphNode } from '../parser/graph';
import { CodeModule } from '../parser/analyzer';

export const AUDIENCE_ROLES = ['frontend', 'backend', 'platform', 'product-qa'] as const;
export type AudienceRole = (typeof AUDIENCE_ROLES)[number];

const ROLE_GUIDANCE: Record<AudienceRole, string> = {
  frontend: 'Prioritize UI entrypoints, state transitions, client-side data fetching, and user interaction flow. Emphasize React components and browser behavior.',
  backend: 'Prioritize server startup, request handling, route flow, integration boundaries, parsing/processing logic, and system-side data flow.',
  platform: 'Prioritize runtime configuration, deployment assumptions, environment variables, cache behavior, failure modes, and operational reliability.',
  'product-qa': 'Prioritize user-visible features, end-to-end interaction paths, acceptance-critical behaviors, and likely regression points to test.'
};

export function getRoleGuidance(role: AudienceRole): string {
  return ROLE_GUIDANCE[role] ?? ROLE_GUIDANCE.backend;
}

export interface OnboardingStep {
  title: string;
  filePath: string;
  why: string;
  focus: string;
}

export interface AIAnalysisResult {
  overview: string;
  keyModules: Array<{ name: string; responsibility: string }>;
  onboardingSteps: OnboardingStep[];
  repoName?: string;
  tagline?: string;
}

export async function generateCodebaseSummary(
  entryPoints: string[],
  modules: CodeModule[],
  graph: GraphNode[],
  role: AudienceRole = 'backend'
): Promise<AIAnalysisResult> {
  const context = JSON.stringify({
    entryPoints,
    moduleDetails: modules.map(module => ({
      name: module.name,
      files: module.files,
      exports: module.exports,
      imports: module.imports,
      internalDependencies: graph.find(g => g.module === module.name)?.dependsOn ?? [],
      externalDependencies: graph.find(g => g.module === module.name)?.externalDeps ?? []
    })),
    graph: graph.map(g => ({
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
      onboardingSteps: z.array(z.object({
        title: z.string(),
        filePath: z.string(),
        why: z.string(),
        focus: z.string()
      })).describe('A strict, 3-4 step chronological path for a new engineer to read the code. Each step must name one concrete file path from the context.')
    }),
    prompt: `You are a Principal Engineer onboarding a new hire. Analyze the codebase structure and relationships, then generate the spec.
  Role perspective: ${role}
  Role guidance: ${getRoleGuidance(role)}
    
STRIPPED AST CONTEXT:
${context}

RULES:
- Be highly technical, terse, and precise.
- Only analyze the provided AST context. Do NOT hallucinate code.
- Focus on the data flow and entry points.
- For onboarding steps, pick the actual files that matter first, in order, and explain what a new engineer should inspect in each one.`
  });

  return object;
}

export async function streamCodebaseSummary(
  targetUrl: string,
  entryPoints: string[],
  modules: CodeModule[],
  graph: GraphNode[],
  role: AudienceRole = 'backend'
) {
  const context = JSON.stringify({
    repositoryUrl: targetUrl,
    entryPoints,
    moduleDetails: modules.map(module => ({
      name: module.name,
      files: module.files,
      exports: module.exports,
      imports: module.imports,
      internalDependencies: graph.find(g => g.module === module.name)?.dependsOn ?? [],
      externalDependencies: graph.find(g => g.module === module.name)?.externalDeps ?? []
    })),
    graph: graph.map(g => ({
      name: g.module,
      internalDependencies: g.dependsOn,
      externalDependencies: g.externalDeps
    }))
  });

  return streamObject({
    model: openai('gpt-4o'),
    schema: z.object({
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
    }),
    prompt: `You are a Principal Engineer onboarding a new hire to a highly specific codebase. Analyze the exact Codebase AST structure and relationships.
  Role perspective: ${role}
  Role guidance: ${getRoleGuidance(role)}
    
STRIPPED AST CONTEXT:
${context}

RULES:
- Be highly technical. You MUST reference SPECIFIC file names, class names, function signatures, and exported variables mapped in the AST. 
- Example: If the AST shows "export const db = drizzle(sql)" in src/db/index.ts, you specifically write: "The database is instantiated via Drizzle ORM in src/db/index.ts".
- DO NOT speak in generic architectural terms ("The frontend talks to the backend"). Speak in precise literal code context ("The 'app' module imports 'lucide-react' and handles layout...").
- Only synthesize your steps based entirely on the provided literal AST context and function signatures.
- For onboarding steps, use the real file paths from the AST and order them as a practical read path for a new engineer.`
  });
}
