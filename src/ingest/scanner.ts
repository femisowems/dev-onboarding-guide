import { readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage']);

export interface FileNode {
  path: string;
  type: 'file' | 'dir';
  children?: FileNode[];
}

export function generateFileTree(dir: string, baseDir: string = dir): FileNode[] {
  const entries = readdirSync(dir);
  const nodes: FileNode[] = [];

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry)) continue;

    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    const relPath = relative(baseDir, fullPath);

    if (stat.isDirectory()) {
      const children = generateFileTree(fullPath, baseDir);
      if (children.length > 0) {
        nodes.push({ path: relPath, type: 'dir', children });
      }
    } else {
      nodes.push({ path: relPath, type: 'file' });
    }
  }

  return nodes;
}
