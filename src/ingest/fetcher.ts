import { execSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

export function resolveCodebase(target: string): string {
  if (target.startsWith('http') || target.startsWith('git@')) {
    const tempDir = mkdtempSync(join(tmpdir(), 'onboard-bot-'));
    execSync(`git clone --depth 1 ${target} ${tempDir}`, { stdio: 'ignore' });
    return tempDir;
  }
  return target;
}

export function cleanupCodebase(targetPath: string) {
  if (targetPath.includes('onboard-bot-') && targetPath.includes(tmpdir())) {
    rmSync(targetPath, { recursive: true, force: true });
  }
}
