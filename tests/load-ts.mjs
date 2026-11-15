import { readFileSync } from 'node:fs';
import ts from 'typescript';
export function loadTs(file, modules, globals={}) {
  const source=readFileSync(new URL('../'+file,import.meta.url),'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={};
  const require=name=>{if(!(name in modules))throw new Error('Missing test module: '+name);return modules[name];};
  new Function('require','exports',...Object.keys(globals),compiled)(require,exports,...Object.values(globals));
  return exports;
}
