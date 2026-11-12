import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
const license=await readFile('node_modules/marked/LICENSE','utf8');
await writeFile('THIRD_PARTY_NOTICES.txt','Marked (MIT license)\n\n'+license.replace(/\r\n/g,'\n'));
await build({entryPoints:['src/main.js'],outfile:'main.js',bundle:true,format:'esm',platform:'browser',target:'es2022',legalComments:'inline',banner:{js:'/*!\nMarked license:\n'+license.replace(/\*\//g,'* /').replace(/\r\n/g,'\n')+'\n*/'}});
