import {test,expect,type Page} from '@playwright/test';

async function enter(page:Page){
 // Observe the real API boundary and inject one-shot failures in the test only.
 await page.addInitScript(()=>{(window as any).__qaCalls=[]});
 await page.route('**/src/lib/api.ts*',async route=>{
  const response=await route.fetch();const source=await response.text();
  const instrumented=source.replace(/async function request\([^)]*\)\s*\{/,match=>match+`
   window.__qaCalls.push({fn,action});
   if(window.__qaFailAction===action){window.__qaFailAction=null;throw new Error('QA injected failure');}
  `);
  expect(instrumented).not.toBe(source);
  await route.fulfill({response,body:instrumented});
 });
 await page.route('https://**/*',route=>route.abort());
 await page.goto('/telegram-dashboard/?qa=1');
 await page.getByRole('textbox',{name:'Как тебя зовут?'}).fill('QA Tester');
 await page.getByRole('button',{name:'Войти в QA Sandbox'}).click();
 await expect(page.getByText('Добро пожаловать')).toBeVisible();
}
async function navigate(page:Page,name:string){
 const open=page.getByRole('button',{name:'Открыть меню',exact:true});
 if(await open.isVisible())await open.click();
 await page.locator('.sidebar-scroll').getByRole('button',{name,exact:true}).click();
}
async function sample(page:Page){
 await navigate(page,'Буфер задач');
 await page.locator('.buffer-mvp .task-copy').filter({hasText:'Идеи для автомобильного блога'}).click();
 await expect(page.getByRole('textbox',{name:'Название страницы'})).toHaveValue('🚀 Запуск проекта');
}
const calls=(page:Page)=>page.evaluate(()=>(window as any).__qaCalls as Array<{fn:string;action:string}>);
const clearCalls=(page:Page)=>page.evaluate(()=>{(window as any).__qaCalls=[]});

test('recent tasks open repeatedly from other screens, including direct reload and Back',async({page})=>{
 await enter(page);await sample(page);
 const url=page.url();
 for(let i=0;i<20;i++){
  await navigate(page,i%2?'Сегодня':'Главное');
  const open=page.getByRole('button',{name:'Открыть меню',exact:true});if(await open.isVisible())await open.click();
  await page.locator('.sidebar-recent-link').filter({hasText:'Идеи для автомобильного блога'}).click();
  await expect(page.getByRole('textbox',{name:'Название страницы'})).toHaveValue('🚀 Запуск проекта');
  await expect(page.locator('.os-pipeline')).toBeVisible();
 }
 await page.reload();await expect(page.getByRole('textbox',{name:'Название страницы'})).toHaveValue('🚀 Запуск проекта');
 expect(page.url()).toBe(url);
 await page.getByRole('button',{name:'Назад',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Сегодня',exact:true})).toBeVisible();
});

test('working list has no empty actions, completed actions remain usable',async({page})=>{
 await enter(page);await navigate(page,'Буфер задач');
 await page.getByRole('tab',{name:'В работе',exact:true}).click();
 const working=page.locator('.task-library-row');await expect(working.first()).toBeVisible();
 await expect(working.locator('summary')).toHaveCount(0);
 await page.getByRole('tab',{name:'Завершённые',exact:true}).click();
 const row=page.locator('.task-library-row').first();
 await row.locator('summary').click();await expect(row.getByRole('button',{name:'Снять выполнение'})).toBeVisible();
 await row.locator('summary').press('Escape');await expect(row.getByRole('button',{name:'Снять выполнение'})).toBeHidden();
});

test('scheduling updates the mounted inspector without global bootstrap and preserves content',async({page})=>{
 await enter(page);await sample(page);
 await page.getByRole('button',{name:'Свойства',exact:true}).click();
 const date=page.locator('.os-task-properties input[type=date]');await expect(date).toHaveValue('');
 await clearCalls(page);
 await page.getByRole('button',{name:'Взять в работу',exact:true}).click();
 const selected=await page.getByLabel('День начала работы').inputValue();
 await page.getByRole('button',{name:'В работу',exact:true}).click();
 await expect(page.getByRole('button',{name:'Завершить',exact:true})).toBeEnabled();
 await expect(date).toHaveValue(selected);
 expect((await calls(page)).some(c=>c.action==='bootstrap'||c.action==='task_rollover'||c.action==='read')).toBe(false);
 await page.reload();await page.getByRole('button',{name:'Свойства',exact:true}).click();
 await expect(date).toHaveValue(selected);await expect(page.locator('.os-pipeline')).toBeVisible();
});

test('completion reconciles only tasks and metrics; failed write rolls back',async({page})=>{
 await enter(page);await navigate(page,'Сегодня');await clearCalls(page);
 const toggle=page.getByRole('button',{name:'Выполнить: Записаться на ТО',exact:true});
 await page.evaluate(()=>{(window as any).__qaFailAction='task_toggle'});await toggle.click();
 await expect(toggle).toBeVisible();await expect(page.getByText(/Не удалось обновить задачу/)).toBeVisible();
 await clearCalls(page);await toggle.click();
 await expect(page.getByRole('button',{name:'Все изменения сохранены',exact:true})).toBeVisible();
 const recorded=await calls(page);
 expect(recorded.filter(c=>c.action!=='task_cards_meta').map(c=>c.action)).toEqual(['task_toggle','tasks_list','metrics']);
 await page.reload();await expect(toggle).toBeHidden();
});

test('failed reconciliation does not undo a committed completion or replace the screen',async({page})=>{
 await enter(page);await navigate(page,'Сегодня');
 await page.evaluate(()=>{(window as any).__qaFailAction='metrics'});
 await page.getByRole('button',{name:'Выполнить: Записаться на ТО',exact:true}).click();
 await expect(page.getByText(/Задача сохранена, но не удалось обновить список/)).toBeVisible();
 await expect(page.getByRole('heading',{name:'Сегодня',exact:true})).toBeVisible();
 await page.reload();await expect(page.getByRole('button',{name:'Выполнить: Записаться на ТО',exact:true})).toBeHidden();
});

test('quick capture persists a single task without global bootstrap',async({page})=>{
 await enter(page);await navigate(page,'Буфер задач');await clearCalls(page);
 await page.getByRole('textbox',{name:'Быстро добавить задачу'}).fill('QA patch capture');
 await page.getByRole('button',{name:'Добавить',exact:true}).click();
 await page.getByRole('dialog',{name:'Категория новой задачи'}).getByRole('button',{name:'Добавить без категории'}).click();
 await expect(page.locator('.task-copy').filter({hasText:'QA patch capture'})).toHaveCount(1);
 expect((await calls(page)).some(c=>c.action==='bootstrap'||c.action==='task_rollover'||c.action==='read')).toBe(false);
 await page.reload();await expect(page.locator('.task-copy').filter({hasText:'QA patch capture'})).toHaveCount(1);
});

test('automatic goal rollups can be created and reloaded entirely in QA',async({page})=>{
 await enter(page);
 const fieldId=await page.evaluate(()=>{
  const session=JSON.parse(localStorage.getItem('personal-os:qa:session:v1')!);
  const key='personal-os:qa:data:v1:'+session.id,data=JSON.parse(localStorage.getItem(key)!);
  const id=crypto.randomUUID();
  data.propertyFields=[{id,name:'QA количество',field_type:'number',options:{}}];
  data.propertyValues={};
  for(const taskId of Object.keys(data.regularLinks))data.propertyValues[taskId]={[id]:'3'};
  localStorage.setItem(key,JSON.stringify(data));return id;
 });
 await navigate(page,'Цели');await page.locator('.goal-work-card').filter({hasText:'Собрать работающий MVP'}).click();
 const rollup=page.getByRole('region',{name:'Автоматические показатели по задачам'});
 await expect(rollup.getByRole('alert')).toHaveCount(0);
 await rollup.getByRole('button',{name:'+ Показатель',exact:true}).click();
 await rollup.getByLabel('Свойство задач').selectOption(fieldId);
 await rollup.getByLabel('Целевое значение (для времени — в минутах)').fill('10');
 await rollup.getByRole('button',{name:'Сохранить',exact:true}).click();
 await expect(rollup.locator('.os-goal-rollup-row')).toContainText('6');
 await expect(rollup.locator('.os-goal-rollup-row')).toContainText('из 10');
 await page.reload();await expect(rollup.locator('.os-goal-rollup-row')).toContainText('из 10');
 await rollup.getByRole('button',{name:'Удалить показатель QA количество',exact:true}).click();
 await expect(rollup.locator('.os-goal-rollup-row')).toHaveCount(0);
});

for(const width of [320,390,430,1440])test(`task page and schedule controls fit ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await enter(page);await sample(page);
 await page.getByRole('button',{name:'Свойства',exact:true}).click();
 await expect(page.locator('.os-task-properties')).toBeVisible();
 expect(await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth))).toBeLessThanOrEqual(1);
 await page.getByRole('button',{name:'Взять в работу',exact:true}).click();
 await expect(page.getByRole('button',{name:'В работу',exact:true})).toBeVisible();
 const calendar=await page.locator('.task-work-calendar').boundingBox();
 expect(calendar).not.toBeNull();expect(calendar!.x).toBeGreaterThanOrEqual(0);
 expect(calendar!.x+calendar!.width).toBeLessThanOrEqual(width);
 expect(await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth))).toBeLessThanOrEqual(1);
 await page.screenshot({path:test.info().outputPath(`task-${width}.png`),fullPage:false});
});
