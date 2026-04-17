#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import * as p from '@clack/prompts';
import pc from 'picocolors';

import { resolveCodebase, cleanupCodebase } from './ingest/fetcher';
import { parseCodebase } from './parser/analyzer';
import { buildDependencyGraph } from './parser/graph';
import { generateCodebaseSummary } from './ai/summary';
import { printDashboard } from './cli/printer';
import { startServer } from './server';

const program = new Command();

program
  .name('onboard')
  .description('Codebase Onboarding Bot')
  .version('1.0.0');

program
  .command('analyze')
  .description('Analyze a target codebase')
  .argument('<target>', 'Path to local directory or GitHub URL')
  .action(async (target) => {
    console.clear();
    p.intro(pc.bgCyan(pc.black(' 🧠 CODEBASE ONBOARDING BOT ')));

    const s = p.spinner();
    let resolvedPath = target;

    try {
      s.start(`Ingesting repository: ${target}`);
      resolvedPath = resolveCodebase(target);
      s.stop(`Ingestion complete: ${pc.gray(resolvedPath)}`);

      s.start('Parsing AST and generating dependency graphs');
      const { entryPoints, modules } = parseCodebase(resolvedPath);
      const graph = buildDependencyGraph(modules);
      s.stop(`AST parsed: ${pc.blue(modules.length.toString())} modules found`);

      if (!process.env.OPENAI_API_KEY) {
        p.cancel('OPENAI_API_KEY missing from .env file.');
        return;
      }

      s.start('AI analyzing architecture context');
      const aiSummary = await generateCodebaseSummary(entryPoints, graph);
      s.stop('AI analysis complete');

      printDashboard(aiSummary);

      p.outro(pc.green('✅ Guide generated successfully. Happy coding!'));
    } catch (error: any) {
      s.stop('Analysis Failed');
      p.log.error(error.message);
    } finally {
      if (resolvedPath !== target) cleanupCodebase(resolvedPath);
    }
  });

program
  .command('serve')
  .description('Start the Web UI API server')
  .option('-p, --port <number>', 'Port to listen on', '3000')
  .action((options) => {
    startServer(parseInt(options.port));
  });

program.parse();
