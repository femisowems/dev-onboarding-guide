import * as p from '@clack/prompts';
import pc from 'picocolors';
import { AIAnalysisResult } from '../ai/summary';

export function printDashboard(result: AIAnalysisResult) {
  p.note(result.overview, '📐 Architecture Overview');

  let modulesText = '';
  result.keyModules.forEach(mod => {
    modulesText += `${pc.bold(pc.magenta(mod.name))}\n${pc.gray('└')} ${mod.responsibility}\n\n`;
  });
  p.note(modulesText.trim(), '📦 Key Modules');

  let stepsText = '';
  result.onboardingSteps.forEach((step, i) => {
    stepsText += `${pc.green(`${i + 1}.`)} ${step}\n`;
  });
  p.note(stepsText.trim(), '🚀 Where to Start');
}
