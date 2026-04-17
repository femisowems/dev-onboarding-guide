import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const CACHE_DIR = join(process.cwd(), '.onboard-cache');

export function getRemoteHash(url: string): string | null {
  try {
    const output = execSync(`git ls-remote ${url} HEAD`, { encoding: 'utf-8', stdio: 'pipe' });
    return output.trim().split(/\s+/)[0] || null;
  } catch {
    return null;
  }
}

export function getCachedAST(identifier: string) {
  const file = join(CACHE_DIR, `${identifier.replace(/[^a-z0-9]/gi, '_')}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf-8'));
  return null;
}

export function saveASTCache(identifier: string, data: any) {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR);
  writeFileSync(join(CACHE_DIR, `${identifier.replace(/[^a-z0-9]/gi, '_')}.json`), JSON.stringify(data));
}
