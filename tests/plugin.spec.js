import { test,expect } from '@playwright/test';
test.beforeEach(async({page})=>{await page.goto('/');await expect(page.locator('[data-metric=chinese] .eewc-value')).toHaveText('2');});
const value=(page,key)=>page.locator(`[data-metric=${key}] .eewc-value`);
async function content(page,markdown){await page.evaluate(md=>host.doc.contentMarkdown=md,markdown);await page.getByRole('button',{name:'刷新'}).click();}
test('正文结构和链接、图片、代码的口径清楚',async({page})=>{
  await content(page,'# 标题\n\n**正文** [链接文字](https://example.com/a?token=secret) ![图片说明](https://example.com/photo.jpg)\n\n- 列表\n\n> 引用\n\n```js\nconst hiddenCode=42;\n```\n\n行内 `codeWord`');
  await expect(value(page,'words')).toHaveText('0');await expect(value(page,'chinese')).toHaveText('14');
  await page.getByLabel('包含代码').check();await expect(value(page,'words')).toHaveText('3');
  await page.getByLabel('口径').selectOption('source');await expect(value(page,'words')).not.toHaveText('3');
  await expect(page.getByLabel('包含代码')).toBeDisabled();
});
test('字素、扩展汉字、数字组、重音词和空文本',async({page})=>{
  const counts=await page.evaluate(()=>host.countText('𠀀你 👨‍👩‍👧‍👦 👍🏽 🇨🇳 e\u0301 123 45.6 hello-world don’t'));
  expect(counts.chinese).toBe(2);expect(counts.words).toBe(3);expect(counts.numbers).toBe(2);
  expect(await page.evaluate(()=>host.countText('👨‍👩‍👧‍👦👍🏽🇨🇳e\u0301').chars)).toBe(4);
  await content(page,'');await expect(value(page,'chars')).toHaveText('0');await expect(value(page,'lines')).toHaveText('0');
});
test('选区用 Markdown 保持相同口径，并能切换全文',async({page})=>{
  await page.evaluate(()=>host.selection={noteId:'one',empty:false,text:'你好',contentMarkdown:'**你好**'});await page.getByRole('button',{name:'刷新'}).click();
  await expect(value(page,'chars')).toHaveText('2');await expect(page.getByText(/统计范围：当前选区/)).toBeVisible();
  await page.getByLabel('口径').selectOption('source');await expect(value(page,'chars')).toHaveText('6');
  await page.getByLabel('范围').selectOption('all');await expect(page.getByText(/统计范围：整篇笔记/)).toBeVisible();
  await page.evaluate(()=>host.selection.noteId='different');await page.getByRole('button',{name:'刷新'}).click();
  await page.getByLabel('范围').selectOption('selection');await expect(page.getByText(/当前没有选区/)).toBeVisible();
});
test('旧宿主选区没有 Markdown 时明确使用纯文本',async({page})=>{
  await page.evaluate(()=>host.selection={noteId:'one',empty:false,text:'2 * 3'});await page.getByRole('button',{name:'刷新'}).click();
  await expect(page.getByText(/宿主仅提供选区纯文本/)).toBeVisible();await expect(value(page,'chars')).toHaveText('5');
});
test('表格和实体不粘连，HTML 不执行或加载远程资源',async({page})=>{
  const requests=[];page.on('request',r=>{if(r.url().startsWith('https://'))requests.push(r.url());});
  const text=await page.evaluate(()=>host.bodyText('| 姓名 | 姓氏 |\n| --- | --- |\n| Tom | Lee |\n\n<div>中文 &amp; English</div>\n\n<script>window.bad=1</script><img src="https://example.com/track" onerror="window.bad=2"><iframe src="https://example.com/"></iframe>'));
  expect(text).toContain('Tom Lee');expect(text).toContain('中文 & English');expect(text).not.toContain('window.bad');
  expect(await page.evaluate(()=>window.bad)).toBeUndefined();expect(requests).toEqual([]);
});
test('错误、空编辑器及关闭后迟到响应',async({page})=>{
  await page.evaluate(()=>host.fail=true);await page.getByRole('button',{name:'刷新'}).click();await expect(page.getByText(/读取失败/)).toBeVisible();
  await page.evaluate(()=>{host.fail=false;host.doc=null;});await page.getByRole('button',{name:'刷新'}).click();await expect(page.getByText(/请先打开一篇文本笔记/)).toBeVisible();
  await page.evaluate(()=>{host.delay=150;host.reopen();host.close();});await page.waitForTimeout(200);await expect(page.locator('.eewc-root')).toHaveCount(0);
  await page.evaluate(()=>host.deactivate());expect(await page.evaluate(()=>host.disposed)).toBe(2);
});
test('深色窄屏且样式不再使用 wc-root',async({page})=>{
  await page.setViewportSize({width:360,height:900});await page.goto('/?dark');await expect(value(page,'chinese')).toHaveText('2');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.locator('.wc-root')).toHaveCount(0);
  await page.screenshot({path:'test-results/word-count-narrow.png',fullPage:true});
});
