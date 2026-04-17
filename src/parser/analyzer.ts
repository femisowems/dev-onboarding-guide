import Parser from 'tree-sitter';
const TypeScript = require('tree-sitter-typescript').tsx;
import { join } from 'path';
import { readFileSync } from 'fs';
import { generateFileTree, FileNode } from '../ingest/scanner';

export interface CodeModule {
  name: string;
  files: string[];
  imports: string[];
  exports: string[];
}

export function parseCodebase(basePath: string) {
  const parser = new Parser();
  parser.setLanguage(TypeScript);
  
  const tree = generateFileTree(basePath);
  const flatten = (nodes: FileNode[]): string[] => nodes.flatMap(n => n.type === 'file' ? n.path : flatten(n.children || []));
  const files = flatten(tree).filter(f => f.match(/\.(ts|tsx|js|jsx)$/));
  
  const modulesMap = new Map<string, CodeModule>();

  // Extract top-level directory grouping
  const getModule = (path: string) => path.split('/')[0];

  let entryPoints: string[] = [];

  for (const file of files) {
    const fullPath = join(basePath, file);
    
    // Naively identify entry points
    if (file.match(/(injected|index|main|App|route|page)\.(ts|tsx)$/i)) {
      entryPoints.push(file);
    }

    try {
      const code = readFileSync(fullPath, 'utf8');
      const tree = parser.parse(code);
      
      const modName = getModule(file);
      if (!modulesMap.has(modName)) {
        modulesMap.set(modName, { files: [], imports: [], exports: [] });
      }
      
      const mod = modulesMap.get(modName)!;
      mod.files.push(file);

      // Recursive semantic descent via Tree-sitter
      const walk = (node: Parser.SyntaxNode) => {
        if (node.type === 'import_statement') {
          const sourceNode = node.children.find(c => c.type === 'string');
          if (sourceNode) mod.imports.push(sourceNode.text.slice(1, -1));
        }
        if (node.text.startsWith('export ') || node.type === 'export_statement') {
          // Capture up to the first 120 chars of the actual function/class signature for the LLM!
           mod.exports.push(node.text.split(/\n| {/)[0].slice(0, 120));
        }
        for (const child of node.children) walk(child);
      };
      
      walk(tree.rootNode);

    } catch (e) {
      console.warn(`[Tree-Sitter] Skipped or failed to parse AST for: ${file}`);
    }
  }

  const modules = Array.from(modulesMap.entries()).map(([module, data]) => ({
    module,
    ...data
  }));
  
  return { entryPoints, modules };
}
