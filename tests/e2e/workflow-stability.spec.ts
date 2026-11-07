import {test,expect,type Page,type Locator} from '@playwright/test';

async function prepare(page:Page,width=390,reduced=false){
 await page.setViewportSize({width,height:900});
 await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'});
 await page.route('https://**/*',route=>route.abort());
 // Delay the actual QA transport to expose the optimistic -> server-ID handoff.
 await page.route('**/src/lib/api.ts*',async route=>{
  const response=await route.fetch(),source=await response.text();
  const body=source.replace(/async function request\([^)]*\)\s*\{/,match=>match+`
   if(action==='workflow_save'||action==='workflow_delete'){
    await new Promise(resolve=>setTimeout(resolve,400));
    if(window.__failWorkflow===action){window.__failWorkflow=null;throw new Error('QA write failure');}
   }
  `);
  expect(body).not.toBe(source);await route.fulfill({response,body});
 });
 await page.goto('/telegram-dashboard/?qa=1');
 await page.getByRole('textbox',{name:'Как тебя зовут?'}).fill('Motion QA');
 await page.getByRole('button',{name:'Войти в QA Sandbox'}).click();
 await expect(page.getByText('Добро пожаловать')).toBeVisible();
 const menu=page.getByRole('button',{name:'Открыть меню'});if(await menu.isVisible())await menu.click();
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Буфер задач',exact:true}).click();
 await page.locator('.buffer-mvp .task-copy').filter({hasText:'Идеи для автомобильного блога'}).click();
 await page.getByRole('textbox',{name:'Название этапа',exact:true}).last().fill('Новая');
 await page.getByRole('button',{name:'Добавить этап',exact:true}).click();
 const stage=page.locator('.os-split').filter({has:page.locator('.os-split-title[value="Новая"]')});
 await expect(stage.locator('.os-split-title')).toBeEnabled();
 return stage;
}
async function observe(stage:Locator){
 await stage.evaluate(el=>{
  const win=window as any;win.__samples=[];win.__sampling=true;
  function tick(){if(!win.__sampling)return;
   const form=el.querySelector('.os-workflow-add')!;
   win.__samples.push({y:form.getBoundingClientRect().top-el.getBoundingClientRect().top,count:el.querySelectorAll('.os-workflow-row').length,t:performance.now()});
   requestAnimationFrame(tick);
  }tick();
 });
}
async function finish(page:Page){
 await expect.poll(()=>page.evaluate(()=>{const s=(window as any).__samples;return s.length?s[s.length-1].t-s[0].t:0})).toBeGreaterThan(800);
 return page.evaluate(()=>{(window as any).__sampling=false;return (window as any).__samples as Array<{y:number;count:number;t:number}>});
}
for(const width of [320,390,430,1440])test(`Workflow has one stable row and no acknowledgement bounce at ${width}px`,async({page})=>{
 const stage=await prepare(page,width),input=stage.getByRole('textbox',{name:'Новое действие Workflow'});
 await input.fill('Задача 1');await observe(stage);await input.press('Enter');
 const pending=stage.locator('[data-workflow-id^="pending-item-"]');await expect(pending).toHaveCount(1);
 await pending.evaluate(el=>{(window as any).__optimisticRow=el});
 const row=stage.locator('.os-workflow-row').filter({hasText:'Задача 1'});
 await expect(row.getByRole('button',{name:'Изменить действие: Задача 1',exact:true})).toBeEnabled();
 expect(await row.evaluate(el=>el===(window as any).__optimisticRow)).toBe(true);
 const samples=await finish(page),start=samples[0].y,end=samples[samples.length-1].y;
 expect(Math.max(...samples.map(s=>s.count))).toBe(1);
 expect(Math.max(...samples.map(s=>s.y))).toBeLessThanOrEqual(end+2);
 expect(Math.min(...samples.map(s=>s.y))).toBeGreaterThanOrEqual(start-2);
 await expect(input).toBeFocused();
 // Marking an item must not change the row's or input's vertical position.
 await observe(stage);await row.getByRole('checkbox').check();
 const marked=await finish(page);expect(Math.max(...marked.map(s=>s.y))-Math.min(...marked.map(s=>s.y))).toBeLessThanOrEqual(2);
 // Deletion collapses exactly once and returns keyboard focus to the add field.
 await row.locator('summary').click();page.once('dialog',dialog=>dialog.accept());await observe(stage);
 await row.getByRole('button',{name:'Удалить: Задача 1',exact:true}).click();
 await expect(row).toHaveCount(0);await expect(input).toBeFocused();
 const removed=await finish(page),final=removed[removed.length-1].y;
 expect(Math.max(...removed.map(s=>s.y))).toBeLessThanOrEqual(removed[0].y+2);
 expect(Math.min(...removed.map(s=>s.y))).toBeGreaterThanOrEqual(final-2);
 await page.reload();await expect(stage.locator('.os-workflow-row')).toHaveCount(0);
});

test('failed creation restores the draft and failed deletion restores one saved row',async({page})=>{
 const stage=await prepare(page),input=stage.getByRole('textbox',{name:'Новое действие Workflow'});
 await page.evaluate(()=>{(window as any).__failWorkflow='workflow_save'});
 await input.fill('Повторить действие');await input.press('Enter');
 await expect(stage.getByRole('alert')).toContainText('Не удалось подтвердить действие');
 await expect(input).toHaveValue('Повторить действие');await expect(stage.locator('.os-workflow-row')).toHaveCount(0);
 await input.press('Enter');const row=stage.locator('.os-workflow-row').filter({hasText:'Повторить действие'});
 await expect(row.getByRole('button',{name:'Изменить действие: Повторить действие',exact:true})).toBeEnabled();
 await page.evaluate(()=>{(window as any).__failWorkflow='workflow_delete'});
 await row.locator('summary').click();page.once('dialog',dialog=>dialog.accept());
 await row.getByRole('button',{name:'Удалить: Повторить действие',exact:true}).click();
 await expect(stage.getByRole('alert')).toContainText('Не удалось удалить действие');await expect(row).toHaveCount(1);
 await page.reload();await expect(row).toHaveCount(1);
});

test('reduced motion preserves the row instance and keyboard input on confirmation',async({page})=>{
 const stage=await prepare(page,390,true),input=stage.getByRole('textbox',{name:'Новое действие Workflow'});
 await input.fill('Без движения');await input.press('Enter');
 await stage.locator('[data-workflow-id^="pending-item-"]').evaluate(el=>{(window as any).__optimisticRow=el});
 const row=stage.locator('.os-workflow-row').filter({hasText:'Без движения'});
 await expect(row.getByRole('button',{name:'Изменить действие: Без движения',exact:true})).toBeEnabled();
 expect(await row.evaluate(el=>el===(window as any).__optimisticRow)).toBe(true);await expect(input).toBeFocused();
});
