import { marked } from 'marked';

const BLOCKS = new Set(['P','DIV','H1','H2','H3','H4','H5','H6','BLOCKQUOTE','LI','UL','OL','TABLE','TR','PRE','SECTION','ARTICLE']);
export function bodyText(markdown, includeCode = false) {
  // A template is inert: never insert parsed note HTML into the live document.
  const template = document.createElement('template');
  template.innerHTML = marked.parse(markdown, { async:false, gfm:true });
  template.content.querySelectorAll('script,style,template,noscript,iframe,object,embed,img,svg,math,head,input,button,select,[hidden],[aria-hidden="true"]'+(includeCode?'':',pre,code')).forEach(el=>el.remove());
  const walk = node => {
    if(node.nodeType===3) return !node.textContent.trim() && ['TABLE','THEAD','TBODY','TFOOT','TR'].includes(node.parentNode?.nodeName) ? '' : node.textContent;
    if(node.nodeName==='BR') return '\n';
    const text=Array.from(node.childNodes,walk).join('');
    return BLOCKS.has(node.nodeName) ? '\n'+text+'\n' : ['TD','TH'].includes(node.nodeName) ? text+' ' : text;
  };
  return walk(template.content).replace(/\r\n?/g,'\n').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
export function countText(text) {
  text=text.replace(/\r\n?/g,'\n');
  const graphemes=Array.from(new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(text),v=>v.segment);
  const chinese=(text.match(/\p{Script=Han}/gu)||[]).length;
  const words=(text.match(/\p{Script=Latin}[\p{Script=Latin}\p{M}]*(?:['’‐-][\p{Script=Latin}\p{M}]+)*/gu)||[]).length;
  const numbers=(text.match(/\p{N}+(?:[.,]\p{N}+)*/gu)||[]).length;
  return {chinese,words,numbers,chars:graphemes.length,nonSpace:graphemes.filter(s=>!/\s/u.test(s)).length,lines:text?text.split('\n').length:0,minutes:Math.ceil(chinese/400+words/200)};
}
const STYLE=`
.eewc-root{font:inherit;color:inherit;display:grid;gap:14px;min-width:0}.eewc-controls{display:flex;flex-wrap:wrap;gap:10px;align-items:center}.eewc-controls label{display:flex;gap:6px;align-items:center;font-size:13px}
.eewc-root select,.eewc-root button{font:inherit;color:inherit;background:transparent;border:1px solid color-mix(in srgb,currentColor 25%,transparent);border-radius:7px;padding:7px 9px}.eewc-root option{color:CanvasText;background:Canvas}
.eewc-root button{cursor:pointer}.eewc-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.eewc-card{padding:14px;border:1px solid color-mix(in srgb,currentColor 17%,transparent);border-radius:9px}.eewc-value{font-size:26px;font-weight:650;font-variant-numeric:tabular-nums}.eewc-label,.eewc-note{font-size:12px;opacity:.78;line-height:1.6}.eewc-time{background:color-mix(in srgb,#528b6d 15%,transparent);padding:12px;border-radius:9px}.eewc-status{font-size:13px;overflow-wrap:anywhere}.eewc-root :focus-visible{outline:2px solid #528b6d;outline-offset:2px}
`;
export default {
  activate(context) {
    const disposePanel=context.ui.panels.register({
      id:'word-count-panel',title:'字数统计',purpose:'dashboard',presentation:'dialog',
      mount(container,{shell}) {
        shell.set({header:{title:'字数统计',description:'正文、源码与选区，分别看清楚'}});
        let alive=true,request=0,snapshot=null,scope='auto',mode='body',includeCode=false;
        const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
        const root=el('div',null,'eewc-root');container.append(root);
        const controls=el('div',null,'eewc-controls'), result=el('div');
        function select(label,options,onChange) {
          const l=el('label',label),s=el('select');
          for(const [value,text] of options){const o=el('option',text);o.value=value;s.append(o);}
          s.onchange=()=>{onChange(s.value);render();};l.append(s);controls.append(l);return s;
        }
        const scopeSelect=select('范围',[['auto','优先选区'],['all','整篇笔记'],['selection','仅选区']],v=>scope=v);
        const modeSelect=select('口径',[['body','正文'],['source','Markdown 源码']],v=>mode=v);
        const codeLabel=el('label','包含代码'),code=el('input');code.type='checkbox';code.onchange=()=>{includeCode=code.checked;render();};codeLabel.prepend(code);controls.append(codeLabel);
        const refresh=el('button','刷新');refresh.type='button';refresh.onclick=load;controls.append(refresh);
        root.append(el('style',STYLE),controls,result);
        function render() {
          if(!alive || !snapshot)return;
          result.replaceChildren();code.disabled=mode==='source';
          const {doc,selection}=snapshot;
          if(!doc){result.append(el('p','请先打开一篇文本笔记，再点击刷新。','eewc-status'));return;}
          const hasSelection=selection && !selection.empty && selection.noteId===doc.noteId;
          if(scope==='selection'&&!hasSelection){result.append(el('p','当前没有选区。请选中文字后刷新，或切换为整篇笔记。','eewc-status'));return;}
          const selected=scope!=='all'&&hasSelection;
          const source=selected?selection.contentMarkdown:doc.contentMarkdown;
          const plainFallback=selected&&typeof source!=='string';
          const raw=typeof source==='string'?source:selected?selection.text||'':'';
          const text=mode==='body'&&!plainFallback?bodyText(raw,includeCode):raw;
          const counts=countText(text),grid=el('div',null,'eewc-grid');
          for(const [key,label] of [['chinese','汉字'],['words','英文／拉丁字母词'],['nonSpace','非空白字符'],['chars','总字符（含空白）'],['numbers','数字组'],['lines',mode==='body'?'正文文本行数':'源码行数']]){
            const card=el('div',null,'eewc-card');card.dataset.metric=key;card.append(el('div',String(counts[key]),'eewc-value'),el('div',label,'eewc-label'));grid.append(card);
          }
          result.append(grid,el('p',`统计范围：${selected?'当前选区':'整篇笔记'} · ${mode==='body'?'正文':'Markdown 源码'}${plainFallback?'（宿主仅提供选区纯文本）':''}${doc.hasUnsavedChanges?' · 包含编辑器未保存修改':''}`,'eewc-note'));
          result.append(el('div',`预计阅读 ${counts.minutes} 分钟（汉字约 400 字／分，拉丁字母词约 200 词／分）`,'eewc-time'));
          result.append(el('p',mode==='body'?'正文去除格式符号、链接地址、图片和隐藏内容；代码由上方开关控制。行数指提取后的文本行，不是屏幕折行。':'源码口径保留 Markdown 标记和链接地址。','eewc-note'));
          result.append(el('p','字符按可见字符组合计数，例如家庭 emoji 计为 1；数字组单独统计。选区或笔记变化后点击刷新。','eewc-note'));
        }
        async function load() {
          const id=++request;refresh.disabled=true;scopeSelect.disabled=true;modeSelect.disabled=true;result.replaceChildren(el('p','正在读取编辑器…','eewc-status'));
          try {
            const [doc,selection]=await Promise.all([context.editor.getDocument(),context.editor.getSelection()]);
            if(!alive||id!==request)return;
            snapshot={doc,selection};render();
          } catch(error){if(alive&&id===request){snapshot=null;result.replaceChildren(el('p',`读取失败，请重试：${error.message||error}`,'eewc-status'));}}
          finally{if(alive&&id===request){refresh.disabled=false;scopeSelect.disabled=false;modeSelect.disabled=false;}}
        }
        load();return()=>{alive=false;request++;root.remove();};
      },
    });
    const disposeCommand=context.commands.register({id:'open-word-count',title:'字数统计',listed:true,async run(){await context.ui.panels.open('word-count-panel');}});
    return()=>{disposeCommand();disposePanel();};
  },
};
