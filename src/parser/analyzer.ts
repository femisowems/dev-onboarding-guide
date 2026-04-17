import { Project, SourceFile } from 'ts-morph';
import { existsSync, readFileSync } from 'fs';
import { join, relative } from 'path';

export interface CodeModule {
  name: string;
  files: string[];
  imports: string[];
}

export function parseCodebase(basePath: string) {
  const project = new Project({ compilerOptions: { allowJs: true } });

  const searchPath = join(basePath, '**/*.{ts,tsx,js,jsx}').replace(/\\/g, '/');
  const ignoreNodeModules = `!${join(basePath, 'node_modules/**/*').replace(/\\/g, '/')}`;
  
  project.addSourceFilesAtPaths([searchPath, ignoreNodeModules]);
  const files = project.getSourceFiles();

  return {
    entryPoints: detectEntryPoints(basePath, files),
    modules: groupModules(basePath, files)
  };
}

function detectEntryPoints(basePath: string, files: SourceFile[]): string[] {
  const entries = new Set<string>();
  const pkgPath = join(basePath, 'package.json');
  
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      if (pkg.main) entries.add(pkg.main);
      if (pkg.bin) Object.values(pkg.bin).forEach((b: any) => entries.add(b));
    } catch {}
  }

  files.forEach(f => {
    const rel = relative(basePath, f.getFilePath());
    if (/^(index|main|App|server)\.(ts|js|tsx)$/.test(rel.split('/').pop() || '')) {
      entries.add(rel);
    }
  });

  return Array.from(entries);
}

function groupModules(basePath: string, files: SourceFile[]): CodeModule[] {
  const map = new Map<string, CodeModule>();

  files.forEach(f => {
    const relPath = relative(basePath, f.getFilePath());
    let folder = 'root';
    const parts = relPath.split('/');
    if (parts.length > 2 && parts[0] === 'src') folder = parts[1];
    else if (parts.length > 1) folder = parts[0];

    if (!map.has(folder)) map.set(folder, { name: folder, files: [], imports: [] });
    
    const mod = map.get(folder)!;
    mod.files.push(relPath);

    f.getImportDeclarations().forEach(imp => {
      mod.imports.push(imp.getModuleSpecifierValue());
    });
  });

  return Array.from(map.values()).map(m => ({
    ...m,
    imports: Array.from(new Set(m.imports))
  }));
}
