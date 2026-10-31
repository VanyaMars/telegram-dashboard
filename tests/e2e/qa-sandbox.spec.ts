import {test,expect,type Page} from '@playwright/test';
const entry='/telegram-dashboard/?qa=1';
async function enter(page:Page,name='QA Проверяющий'){
 await page.goto(entry);
 await page.getByRole('textbox',{name:'Как тебя зовут?'}).fill(name);
 await page.getByRole('button',{name:'Войти в QA Sandbox'}).click();
 await expect(page.getByText('Добро пожаловать')).toBeVisible();
 await expect(page.getByText(/QA Sandbox.*только локальные данные/)).toBeVisible();
}
async function openSampleTaskPage(page:Page){
 const menu=page.getByRole('button',{name:'Открыть меню'});
 if(await menu.isVisible())await menu.click();
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Буфер задач'}).click();
 const task=page.locator('.buffer-mvp .task-copy').filter({hasText:'Идеи для автомобильного блога'});
 await expect(task).toBeVisible();
 await task.click();
 await expect(page.locator('.os-page-editor')).toBeVisible();
}
test('guest sign-in, UI actions, local persistence and no Supabase calls',async({page})=>{
 const called:string[]=[];
 page.on('request',r=>{if(r.url().includes('/functions/v1/'))called.push(r.url())});
 await enter(page);
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Буфер задач'}).click();
 await page.getByRole('textbox',{name:'Быстро добавить задачу'}).fill('QA задача для проверки');
 await page.locator('.buffer-quick').getByRole('button',{name:'Добавить'}).click();
 await expect(page.getByRole('button',{name:'QA задача для проверки',exact:true})).toBeVisible();
 await page.reload();
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Буфер задач'}).click();
 await expect(page.getByRole('button',{name:'QA задача для проверки',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'QA задача для проверки',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Свойства задачи'})).toBeVisible();
 await page.getByRole('button',{name:'Добавить блок'}).click();
 await page.locator('.os-block-picker').getByRole('button',{name:'Чеклист'}).click();
 await page.locator('.os-block-picker').getByRole('button',{name:'Вставить чеклист'}).click();
 const input=page.getByRole('textbox',{name:'Пункт чеклиста'}).first();
 await input.fill('Первый пункт QA');
 await input.press('Enter');
 await expect(page.getByRole('textbox',{name:'Пункт чеклиста'})).toHaveCount(2);
 await expect(page.getByRole('textbox',{name:'Пункт чеклиста'}).last()).toBeFocused();
 await page.reload();
 await expect(page.getByRole('textbox',{name:'Пункт чеклиста'}).first()).toHaveValue('Первый пункт QA');
 expect(called,'A QA session must never call the production Edge endpoints').toEqual([]);
});
test('QA is isolated for each newly created browser session',async({page})=>{
 await enter(page,'Первый тестировщик');
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Буфер задач'}).click();
 await page.getByRole('textbox',{name:'Быстро добавить задачу'}).fill('Секрет первой сессии');
 await page.locator('.buffer-quick').getByRole('button',{name:'Добавить'}).click();
 await expect(page.getByRole('button',{name:'Секрет первой сессии',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Выйти'}).click();
 await page.getByRole('textbox',{name:'Как тебя зовут?'}).fill('Второй тестировщик');
 await page.getByRole('button',{name:'Войти в QA Sandbox'}).click();
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Буфер задач'}).click();
 await expect(page.getByText('Секрет первой сессии')).toHaveCount(0);
});
for(const width of [320,360,390,430,768,1440]){
 test('responsive home has no page overflow at '+width+'px',async({page},testInfo)=>{
  await page.setViewportSize({width,height:830});
  await enter(page);
  await expect(page.locator('.home-dashboard')).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('home-'+width+'.png'),fullPage:true});
  const sizes=await page.evaluate(()=>({doc:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth}));
  expect(sizes.doc,'Unexpected horizontal page scroll: '+JSON.stringify(sizes)).toBeLessThanOrEqual(sizes.viewport+2);
 });
}

test('F01: regular goal dialog stays above ambitious cards and saves by mouse click',async({page})=>{
 await enter(page);
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Цели'}).click();
 await page.getByRole('button',{name:'Цель',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Новая цель'});
 await expect(dialog).toBeVisible();
 await dialog.getByRole('textbox',{name:'Название'}).fill('QA цель: доступность окна');
 await dialog.getByRole('button',{name:'Сохранить'}).click();
 await expect(dialog).toHaveCount(0);
 await expect(page.getByText('QA цель: доступность окна')).toBeVisible();
 await page.reload();
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Цели'}).click();
 await expect(page.getByText('QA цель: доступность окна')).toBeVisible();
});

test('F02: a task-page editor and nested blocks return directly to Buffer',async({page})=>{
 await enter(page);
 await openSampleTaskPage(page);
 await page.locator('.os-children').getByRole('button',{name:'+ Страница'}).click();
 await expect(page.locator('.os-page-editor')).toBeVisible();
 await page.getByRole('button',{name:'Назад в буфер задач'}).click();
 await expect(page.locator('.buffer-mvp')).toBeVisible();
 await expect.poll(()=>new URL(page.url()).hash).toBe('#/tab/buffer');
});

for(const width of [320,390,430,1440]){
 test('6.7.1: dialog and page navigation fit '+width+'px',async({page})=>{
  await page.setViewportSize({width,height:830});
  await enter(page);
  const nav=page.locator('.sidebar-scroll').getByRole('button',{name:'Цели'});
  if(width<=860)await page.getByRole('button',{name:'Открыть меню'}).click();
  await nav.click();
  await page.getByRole('button',{name:'Цель',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Новая цель'});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Сохранить'})).toBeVisible();
  const dimensions=await page.evaluate(()=>({doc:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth}));
  expect(dimensions.doc).toBeLessThanOrEqual(dimensions.viewport+2);
 });
}

test('6.7.2 F03: selected section, date and Back/Forward survive reload',async({page})=>{
 await enter(page);
 const todayNav=page.locator('.sidebar-scroll').getByRole('button',{name:'Сегодня'});
 await todayNav.click();
 await expect(todayNav).toHaveAttribute('aria-current','page');
 await page.getByRole('button',{name:'Следующий день'}).click();
 const selected=await page.getByLabel('Дата задач').inputValue();
 await expect.poll(() => new URL(page.url()).hash).toBe('#/tab/today');
 await page.reload();
 await expect(todayNav).toHaveAttribute('aria-current','page');
 await expect(page.getByLabel('Дата задач')).toHaveValue(selected);
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Цели'}).click();
 await page.goBack();
 await expect(todayNav).toHaveAttribute('aria-current','page');
 await page.goForward();
 await expect(page.locator('.sidebar-scroll').getByRole('button',{name:'Цели'})).toHaveAttribute('aria-current','page');
});

test('6.9.1 guest: task editor accessible, no separate Pages catalog',async({page})=>{
 await enter(page);
 await expect(page.getByText('Синхронизация с облаком')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Обновить локальные тестовые данные'})).toBeVisible();
 await expect(page.locator('.sidebar-bottom')).toContainText('v6.9.1-rc.1');
 await openSampleTaskPage(page);
 await expect(page.locator('.os-page-editor')).toBeVisible();
 await expect(page.locator('#os-workspace-panel')).toHaveCount(0);
});

test('6.7.2 F07: keyboard Workflow edit with Escape cancellation and Enter save',async({page})=>{
 await enter(page);
 await openSampleTaskPage(page);
 const row=page.locator('.os-workflow-row').filter({hasText:'Подготовить макеты'});
 await row.getByRole('button',{name:'Изменить действие: Подготовить макеты'}).click();
 await page.getByRole('textbox',{name:'Редактировать действие: Подготовить макеты'}).fill('Не сохранять отмену');
 await page.getByRole('textbox',{name:'Редактировать действие: Подготовить макеты'}).press('Escape');
 await expect(row.getByRole('button',{name:'Изменить действие: Подготовить макеты'})).toBeVisible();
 await row.getByRole('button',{name:'Изменить действие: Подготовить макеты'}).click();
 await page.getByRole('textbox',{name:'Редактировать действие: Подготовить макеты'}).fill('Проверить дизайн 6.7.2');
 await page.getByRole('textbox',{name:'Редактировать действие: Подготовить макеты'}).press('Enter');
 await expect(page.getByRole('button',{name:'Изменить действие: Проверить дизайн 6.7.2'})).toBeVisible();
 await page.reload();
 await expect(page.getByRole('button',{name:'Изменить действие: Проверить дизайн 6.7.2'})).toBeVisible();
});

test('6.7.2 F06: a record without date stays accessible in Calendar',async({page})=>{
 await enter(page);
 await openSampleTaskPage(page);
 const db=page.locator('.os-database');
 await db.getByRole('button',{name:'Запись',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Запись базы'});
 await dialog.getByRole('textbox',{name:'Название'}).fill('QA запись без даты');
 await dialog.getByRole('button',{name:'Сохранить',exact:true}).click();
 await expect(dialog).toHaveCount(0);
 await db.getByRole('tab',{name:/Календарь/}).click();
 await expect(db.locator('.os-calendar-undated')).toContainText('Без даты (1)');
 await expect(db.locator('.os-calendar-undated')).toContainText('QA запись без даты');
});

for(const width of [320,390,430,1440]){
 test('6.8 foundations: Calm Precision and 4 core screens fit '+width+'px',async({page})=>{
  await page.setViewportSize({width,height:830});
  await enter(page);
  const palette=await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--purple').trim());
  expect(palette).toBe('#6658D9');
  await expect(page.locator('.next-step-title')).toBeVisible();
  for(const route of ['home','today','goals','buffer']){
   await page.goto(entry+'#/tab/'+route);
   await expect(page.locator('main.app-content .motion-route')).toBeVisible();
   const dimensions=await page.evaluate(()=>({doc:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth}));
   expect(dimensions.doc,'Global overflow at '+route+' '+width+'px: '+JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.viewport+2);
  }
 });
}

test('6.8 foundations: keyboard activation on a goal card and shared selection',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});
 await enter(page);
 const goal=page.locator('.goal-mini[role="button"]').first();
 await expect(goal).toBeVisible();
 await goal.focus();
 await page.keyboard.press('Enter');
 await expect(page.locator('.sidebar-scroll').getByRole('button',{name:'Цели'})).toHaveAttribute('aria-current','page');
 await expect(page.locator('.premium-nav-selection')).toHaveCount(1);
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Сегодня'}).click();
 await expect(page.locator('.sidebar-scroll').getByRole('button',{name:'Сегодня'})).toHaveAttribute('aria-current','page');
 await expect(page.locator('.premium-nav-selection')).toHaveCount(1);
});

test('6.9 foundations: reduced motion keeps Goal page usable',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await enter(page);
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Цели'}).click();
 await expect(page.locator('.goal-work-card').first()).toBeVisible();
 await page.locator('.goal-work-card').first().click();
 await expect(page.locator('.goal-detail-hero')).toBeVisible();
 const transform=await page.locator('main.app-content .motion-route').evaluate(el=>getComputedStyle(el).transform);
 expect(transform).toBe('none');
});

test('6.8 Action Flow: Home puts next step first and shows real daily score',async({page})=>{
 await enter(page);
 await expect(page.locator('.next-step-title')).toBeVisible();
 await expect(page.locator('.next-step-card .plan-score-value')).toBeVisible();
 await expect(page.locator('.next-step-card .next-step-score-heading')).toContainText('РЕЗУЛЬТАТ ДНЯ');
 await expect(page.locator('.next-step-card').getByRole('button',{name:'Открыть план на сегодня'})).toBeVisible();
});

test('6.8 Action Flow: fast Buffer capture prevents duplicate Enter and clears search',async({page})=>{
 await enter(page);
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Буфер задач'}).click();
 const input=page.getByRole('textbox',{name:'Быстро добавить задачу'});
 await input.fill('QA быстрый захват 6.8');
 await input.press('Enter');
 await input.press('Enter');
 await expect(page.getByRole('button',{name:'QA быстрый захват 6.8',exact:true})).toHaveCount(1);
 await expect(input).toBeFocused();
 await expect(input).toHaveValue('');
 await page.getByRole('searchbox',{name:'Поиск задач'}).fill('НЕСУЩЕСТВУЮЩИЙ_ЗАПРОС_68');
 await expect(page.getByText('Ничего не найдено')).toBeVisible();
 await page.getByRole('button',{name:'Сбросить фильтры'}).click();
 await expect(page.getByRole('button',{name:'QA быстрый захват 6.8',exact:true})).toBeVisible();
});

test('6.8 Action Flow: Today important tasks before score and optional Buffer picker',async({page})=>{
 await enter(page);
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Сегодня'}).click();
 await expect(page.locator('.today-task-group--important')).toBeVisible();
 await expect(page.locator('.today-summary--compact')).toBeVisible();
 const above=await page.evaluate(()=>{
  const imp=document.querySelector('.today-task-group--important');
  const score=document.querySelector('.today-summary--compact');
  return !!(imp&&score&&(imp.compareDocumentPosition(score)&Node.DOCUMENT_POSITION_FOLLOWING));
 });
 expect(above).toBe(true);
 const toggle=page.getByRole('button',{name:/Из буфера/});
 await expect(toggle).toHaveAttribute('aria-expanded','false');
 await toggle.click();
 await expect(toggle).toHaveAttribute('aria-expanded','true');
 await expect(page.locator('#today-buffer-picker')).toBeVisible();
});

test('6.8 Action Flow: planning keeps the linked goal and task ID',async({page})=>{
 await enter(page);
 const reference=await page.evaluate(()=>{
  const session=JSON.parse(localStorage.getItem('personal-os:qa:session:v1')||'{}');
  const key='personal-os:qa:data:v1:'+session.id;
  const data=JSON.parse(localStorage.getItem(key)||'{}');
  const link=data.os6.links[0];const task=data.tasks.find((t:any)=>t.id===link.task_id);
  task.day=null;task.completed=false;
  localStorage.setItem(key,JSON.stringify(data));
  return {taskId:task.id,goalId:link.goal_id,title:task.title,key,categoryId:task.os61_category_id};
 });
 await page.reload();
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Планирование'}).click();
 const item=page.locator('.planning-task').filter({hasText:reference.title});
 await item.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Запланировать 1'}).click();
 await expect(page.getByText('Запланировано: 1')).toBeVisible();
 const after=await page.evaluate(key=>{
  const data=JSON.parse(localStorage.getItem(key)||'{}');
  return {task:data.tasks.find((t:any)=>t.id===data.os6.links[0]?.task_id),link:data.os6.links[0],all:data.tasks.filter((t:any)=>t.title==='Отправить три предложения клиентам').length};
 },reference.key);
 expect(after.link.task_id).toBe(reference.taskId);
 expect(after.link.goal_id).toBe(reference.goalId);
 expect(after.task.os61_category_id).toBe(reference.categoryId);
 expect(after.task.day).toBeTruthy();
 expect(after.all).toBe(1);
});


test('6.8 Pipeline: stage reorder saves and survives reload',async({page})=>{
 await enter(page);
 await openSampleTaskPage(page);
 const stages=page.locator('.os-pipeline-premium .os-split');
 await expect(stages).toHaveCount(2);
 await expect(stages.first().getByRole('textbox',{name:'Название этапа'})).toHaveValue('Планирование');
 await stages.nth(1).locator('.os-split-menu summary').click();
 await stages.nth(1).getByRole('button',{name:'Этап левее'}).click();
 await expect(stages.first().getByRole('textbox',{name:'Название этапа'})).toHaveValue('Разработка');
 await page.reload();
 await expect(page.locator('.os-pipeline-premium .os-split').first().getByRole('textbox',{name:'Название этапа'})).toHaveValue('Разработка');
});

test('6.8 Pipeline: Workflow reorder is persisted without changing split',async({page})=>{
 await enter(page);
 await openSampleTaskPage(page);
 const stage=page.locator('.os-pipeline-premium .os-split').first();
 const rows=stage.locator('.os-workflow-row');
 await expect(rows).toHaveCount(2);
 await rows.nth(1).getByRole('button',{name:'Выше: Подготовить макеты'}).click();
 await expect(rows.first().getByRole('button',{name:'Изменить действие: Подготовить макеты'})).toBeVisible();
 await page.reload();
 const after=page.locator('.os-pipeline-premium .os-split').first().locator('.os-workflow-row');
 await expect(after.first().getByRole('button',{name:'Изменить действие: Подготовить макеты'})).toBeVisible();
});

test('6.8 Pipeline: 390px vertical accordion keeps one stage visible',async({page})=>{
 await page.setViewportSize({width:390,height:780});
 await enter(page);
 await page.getByRole('button',{name:'Открыть меню'}).click();
 await openSampleTaskPage(page);
 const stages=page.locator('.os-pipeline-premium .os-split');
 await expect(stages).toHaveCount(2);
 await expect(stages.first().locator('.os-split-body')).toBeVisible();
 await expect(stages.nth(1).locator('.os-split-body')).toBeHidden();
 await stages.nth(1).getByRole('button',{name:'Разработка',exact:true}).click();
 await expect(stages.nth(1).locator('.os-split-body')).toBeVisible();
 await expect(stages.first().locator('.os-split-body')).toBeHidden();
 const size=await page.evaluate(()=>({doc:document.documentElement.scrollWidth,width:document.documentElement.clientWidth}));
 expect(size.doc).toBeLessThanOrEqual(size.width+2);
});


test('6.9.1: task page Back returns to Buffer and old Pages route redirects',async({page})=>{
 await enter(page);
 await expect(page.locator('.sidebar-scroll').getByRole('button',{name:'Страницы'})).toHaveCount(0);
 await openSampleTaskPage(page);
 await expect.poll(()=>new URL(page.url()).hash).toMatch(/^#\/page\//);
 await page.reload();
 await expect(page.locator('.os-page-editor')).toBeVisible();
 await page.getByRole('button',{name:'Назад в буфер задач'}).click();
 await expect(page.locator('.buffer-mvp')).toBeVisible();
 await expect.poll(()=>new URL(page.url()).hash).toBe('#/tab/buffer');
 await page.goto(entry+'#/workspace');
 await expect.poll(()=>new URL(page.url()).hash).toBe('#/tab/buffer');
 await expect(page.locator('.buffer-mvp')).toBeVisible();
 await expect(page.locator('.os-page-gallery')).toHaveCount(0);
});

test('6.9 Shell: removed navigation items and preserved Analytics income',async({page})=>{
 await enter(page);
 for(const name of ['Доходы','Фокус-таймер','Повторения'])await expect(page.locator('.sidebar-scroll').getByRole('button',{name})).toHaveCount(0);
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Аналитика'}).click();
 await expect(page.getByRole('heading',{name:'Полученный доход'})).toBeVisible();
});

test('6.8.1 Shell: mobile Pages accessible from Buffer, not a sidebar tab',async({page})=>{
 await page.setViewportSize({width:390,height:780});
 await enter(page);
 const bottom=page.getByRole('navigation',{name:'Основная навигация'});
 for(const label of ['Сегодня','Буфер задач','Цели','Ещё'])await expect(bottom.getByRole('button',{name:label})).toBeVisible();
 await bottom.getByRole('button',{name:'Ещё'}).click();
 await expect(page.locator('.app-sidebar')).toHaveClass(/is-open/);
 await expect(page.locator('.sidebar-scroll').getByRole('button',{name:'Страницы'})).toHaveCount(0);
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Буфер задач'}).click();
 await page.getByRole('button',{name:'Дополнительные страницы и базы'}).click();
 await expect(page.locator('.os-page-gallery')).toBeVisible();
 await expect(bottom.getByRole('button',{name:'Буфер задач'})).toHaveAttribute('aria-current','page');
 await bottom.getByRole('button',{name:'Сегодня'}).click();
 await expect(bottom.getByRole('button',{name:'Сегодня'})).toHaveAttribute('aria-current','page');
 const size=await page.evaluate(()=>({doc:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
 expect(size.doc).toBeLessThanOrEqual(size.client+2);
});

test('6.9 Goals: linked goal card opens tasks and analytics',async({page})=>{
 await enter(page);
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Цели'}).click();
 await expect(page.getByRole('heading',{name:'Стратегические цели'})).toBeVisible();
 const card=page.locator('.goal-work-card').filter({hasText:'Собрать работающий MVP'});
 await expect(card).toBeVisible();
 await expect(card).toContainText(/Активна \d+/);
 await card.click();
 await expect(page.locator('.goal-detail-hero')).toContainText('Собрать работающий MVP');
 await page.getByRole('tab',{name:'Задачи'}).click();
 await expect(page.locator('.goal-task-summary')).toBeVisible();
 await page.getByRole('tab',{name:'Аналитика'}).click();
 await expect(page.getByRole('heading',{name:'Аналитика показателей'})).toBeVisible();
 await page.getByRole('button',{name:'Все цели'}).click();
 await expect(page.locator('.goal-work-card').filter({hasText:'Собрать работающий MVP'})).toBeVisible();
});
test('6.9 Goals: strategic numeric goal edit, decreasing progress and reload',async({page})=>{
 await enter(page);
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Цели'}).click();
 const card=page.locator('.goal-work-card').filter({hasText:'Вес 90 кг'});
 await expect(card).toBeVisible();
 await card.click();
 await page.getByRole('button',{name:'Свойства'}).click();
 const dialog=page.getByRole('dialog',{name:'Изменить цель'});
 await expect(dialog).toContainText('Снижение');
 await expect(dialog).toContainText('41% пути от старта');
 await dialog.getByRole('spinbutton',{name:'Целевое значение'}).fill('');
 await expect(dialog.getByRole('button',{name:'Сохранить'})).toBeDisabled();
 await dialog.getByRole('spinbutton',{name:'Целевое значение'}).fill('90');
 await dialog.getByRole('button',{name:'Сохранить'}).click();
 await expect(dialog).toHaveCount(0);
 await page.reload();
 await expect(page.locator('.goal-detail-hero')).toBeVisible();
});
test('6.9 Goals: featured numeric metric, close and reopen persist',async({page})=>{
 await enter(page);
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Цели'}).click();
 await page.getByRole('button',{name:'Цель',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Новая цель'});
 await dialog.getByRole('textbox',{name:'Название'}).fill('Клиенты в ноябре');
 await dialog.getByRole('button',{name:'Сохранить'}).click();
 await expect(dialog).toHaveCount(0);
 const card=page.locator('.goal-work-card').filter({hasText:'Клиенты в ноябре'});
 await expect(card).toBeVisible();
 await card.click();
 await page.getByRole('button',{name:'Показатель',exact:true}).click();
 const field=page.locator('.goal-field-editor').first();
 await field.getByRole('textbox',{name:'Название'}).fill('Клиенты');
 await field.getByRole('spinbutton',{name:'Значение'}).fill('1');
 await field.getByRole('spinbutton',{name:'Цель'}).fill('10');
 await field.getByRole('checkbox',{name:'Показывать на карточке'}).check();
 await page.getByRole('button',{name:'Сохранить показатели'}).click();
 await expect(page.locator('.goal-save-status')).toContainText('Изменения сохранены');
 await page.reload();
 await expect(page.locator('.goal-field-editor')).toHaveCount(1);
 await expect(page.locator('.goal-field-editor').first().getByRole('textbox',{name:'Название'})).toHaveValue('Клиенты');
 await page.getByRole('button',{name:'Закрыть цель'}).click();
 await expect(page.locator('.goal-detail-state')).toContainText('Закрыта');
 await page.getByRole('button',{name:'Все цели'}).click();
 await page.getByRole('tab',{name:'Закрытые цели'}).click();
 const closed=page.locator('.goal-work-card').filter({hasText:'Клиенты в ноябре'});
 await expect(closed).toBeVisible();
 await expect(closed).toContainText(/Выполнена за \d+/);
 await expect(closed).toContainText('Клиенты');
 await closed.click();
 await page.getByRole('button',{name:'Вернуть в активные'}).click();
 await page.getByRole('button',{name:'Все цели'}).click();
 await page.getByRole('tab',{name:'Активные'}).click();
 await expect(page.locator('.goal-work-card').filter({hasText:'Клиенты в ноябре'})).toBeVisible();
});
test('6.9 Goals: a new goal task survives reload with the same ID',async({page})=>{
 await enter(page);
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Цели'}).click();
 await page.locator('.goal-work-card').filter({hasText:'Собрать работающий MVP'}).click();
 await page.getByRole('tab',{name:'Задачи'}).click();
 const input=page.getByRole('textbox',{name:'Новая задача в Буфере'});
 await input.fill('Новая задача цели 6.9');
 await page.getByRole('button',{name:'Создать и привязать'}).click();
 await expect(page.locator('.goal-task-summary')).toContainText('3');
 await page.reload();
 await page.getByRole('tab',{name:'Задачи'}).click();
 await expect(page.locator('.goal-task-open').filter({hasText:'Новая задача цели 6.9'})).toHaveCount(1);
});

test('6.9 integration: Buffer→Today→Goals→Pages→Analytics',async({page})=>{
 const called:string[]=[];
 page.on('request',r=>{if(r.url().includes('/functions/v1/'))called.push(r.url())});
 await enter(page);
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Буфер задач'}).click();
 await page.getByRole('textbox',{name:'Быстро добавить задачу'}).fill('Сквозная задача Personal OS 6.9');
 await page.getByRole('textbox',{name:'Быстро добавить задачу'}).press('Enter');
 await expect(page.getByRole('button',{name:'Сквозная задача Personal OS 6.9',exact:true})).toBeVisible();
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Сегодня'}).click();
 await page.getByRole('button',{name:/Из буфера/}).click();
 await page.getByRole('combobox',{name:'Задача из буфера'}).selectOption({label:'Сквозная задача Personal OS 6.9'});
 await page.locator('#today-buffer-picker').getByRole('button',{name:/В день/}).click();
 await expect(page.getByRole('button',{name:'Сквозная задача Personal OS 6.9',exact:true})).toBeVisible();
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Цели'}).click();
 await expect(page.locator('.goal-work-grid').first()).toBeVisible();
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Буфер задач'}).click();
 await page.getByRole('button',{name:'Дополнительные страницы и базы'}).click();
 await expect(page.locator('.os-page-gallery')).toBeVisible();
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Аналитика'}).click();
 await expect(page.getByRole('heading',{name:'Полученный доход'})).toBeVisible();
 await page.reload();
 await expect(page.getByRole('heading',{name:'Аналитика'})).toBeVisible();
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Сегодня'}).click();
 await expect(page.getByRole('button',{name:'Сквозная задача Personal OS 6.9',exact:true})).toBeVisible();
 expect(called).toEqual([]);
});

for(const width of [320,390,430,1440]){
 test('6.9 integration: Goals/Pages/Analytics fit '+width+'px',async({page})=>{
  await page.setViewportSize({width,height:830});
  await enter(page);
  for(const route of ['workspace','goals','analytics']){
   await page.goto(entry+(route==='workspace'?'#/workspace':'#/tab/'+route));
   await expect(page.locator('main.app-content .motion-route')).toBeVisible();
   if(route==='workspace')await expect(page.locator('.os-page-gallery')).toBeVisible();
   else if(route==='goals')await expect(page.locator('.goal-work-grid').first()).toBeVisible();
   else await expect(page.getByRole('heading',{name:'Полученный доход'})).toBeVisible();
   const dim=await page.evaluate(()=>({doc:document.documentElement.scrollWidth,width:document.documentElement.clientWidth}));
   expect(dim.doc,'Overflow '+width+'px '+route).toBeLessThanOrEqual(dim.width+2);
  }
 });
}

test('6.8.1 integration: mobile Buffer stays active when a nested page is opened',async({page})=>{
 await page.setViewportSize({width:390,height:780});
 await enter(page);
 const nav=page.getByRole('navigation',{name:'Основная навигация'});
 await nav.getByRole('button',{name:'Буфер задач'}).click();
 await page.getByRole('button',{name:'Дополнительные страницы и базы'}).click();
 await page.locator('.os-page-gallery').getByRole('button',{name:/Запуск проекта/}).click();
 await expect(nav.getByRole('button',{name:'Буфер задач'})).toHaveClass(/current/);
 await expect(nav.getByRole('button',{name:'Ещё'})).not.toHaveClass(/current/);
 await nav.getByRole('button',{name:'Буфер задач'}).click();
 await expect(page.locator('.buffer-mvp')).toBeVisible();
});

test('6.9: Focus, Income tab and Repeats are not in the product UI',async({page})=>{
 await enter(page);
 for(const name of ['Фокус-таймер','Доходы','Повторения'])await expect(page.locator('.sidebar-scroll').getByRole('button',{name})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Начать с 5 минут'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Начать фокус'})).toHaveCount(0);
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Сегодня'}).click();
 await expect(page.locator('.today-task-group--important')).toBeVisible();
 await expect(page.locator('.today-start-focus')).toHaveCount(0);
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Аналитика'}).click();
 await expect(page.getByRole('heading',{name:'Полученный доход'})).toBeVisible();
});

