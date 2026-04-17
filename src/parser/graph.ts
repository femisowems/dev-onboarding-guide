import { CodeModule } from './analyzer';

export interface GraphNode {
  module: string;
  dependsOn: string[];
  externalDeps: string[];
}

export function buildDependencyGraph(modules: CodeModule[]): GraphNode[] {
  return modules.map(mod => {
    const dependsOn = new Set<string>();
    const externalDeps = new Set<string>();

    mod.imports.forEach(imp => {
      if (imp.startsWith('.')) {
        const importBase = imp.split('/').pop() || '';
        const targetMod = modules.find(m => 
          m.name !== mod.name && 
          m.files.some(f => f.includes(`/${importBase}.`) || f.startsWith(`${importBase}.`))
        );
        if (targetMod) {
          dependsOn.add(targetMod.name);
        }
      } else {
        externalDeps.add(imp.split('/')[0]); 
      }
    });

    return {
      module: mod.name,
      dependsOn: Array.from(dependsOn),
      externalDeps: Array.from(externalDeps)
    };
  });
}
