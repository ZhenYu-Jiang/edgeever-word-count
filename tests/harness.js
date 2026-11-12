import plugin,{bodyText,countText} from '/main.js';
if(new URLSearchParams(location.search).has('dark'))document.body.classList.add('dark');
const host=window.host={doc:{noteId:'one',contentMarkdown:'# Hello\n\n你好 👨‍👩‍👧‍👦 123',hasUnsavedChanges:true},selection:null,fail:false,delay:0,disposed:0};
let panel,command,unmount;
const clone=async(value)=>{const result=structuredClone(value),fail=host.fail,delay=host.delay;if(delay)await new Promise(r=>setTimeout(r,delay));if(fail)throw Error('Editor unavailable');return result;};
const dispose=plugin.activate({editor:{getDocument:()=>clone(host.doc),getSelection:()=>clone(host.selection)},commands:{register(c){command=c;return()=>host.disposed++;}},ui:{panels:{register(p){panel=p;return()=>host.disposed++;},async open(){unmount?.();unmount=panel.mount(document.querySelector('#container'),{shell:{set({header}){document.querySelector('#title').textContent=header.title;document.querySelector('#description').textContent=header.description;}}});}}}});
host.bodyText=bodyText;host.countText=countText;host.close=()=>{unmount?.();unmount=null;};host.reopen=()=>command.run();host.deactivate=()=>{host.close();dispose();};
await command.run();
