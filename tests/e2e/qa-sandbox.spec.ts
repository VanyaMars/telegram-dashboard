import {test,expect,type Page} from '@playwright/test';
const entry='/telegram-dashboard/?qa=1';
async function enter(page:Page,name='QA Проверяющий'){
 await page.goto(entry);
 await page.getByRole('textbox',{name:'Как тебя зовут?'}).fill(name);
 await page.getByRole('button',{name:'Войти в QA Sandbox'}).click();
 await expect(page.getByText('Добро пожаловать')).toBeVisible();
 await expect(page.getByText(/QA Sandbox.*только локальные данные/)).toBeVisible();
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
 const dialog=page.getByRole('dialog',{name:'Новая обычная цель'});
 await expect(dialog).toBeVisible();
 await dialog.getByRole('textbox',{name:'Название'}).fill('QA цель: доступность окна');
 await dialog.getByRole('button',{name:'Сохранить'}).click();
 await expect(dialog).toHaveCount(0);
 await expect(page.getByText('QA цель: доступность окна')).toBeVisible();
 await page.reload();
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Цели'}).click();
 await expect(page.getByText('QA цель: доступность окна')).toBeVisible();
});

test('F02: nested pages and breadcrumbs render without reloading',async({page})=>{
 await enter(page);
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Буфер задач'}).click();
 await page.getByText('Дополнительные страницы и базы').click();
 await page.getByPlaceholder('Название новой страницы').fill('QA Родитель 671');
 await page.getByRole('button',{name:'Создать',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Название страницы'})).toHaveValue('QA Родитель 671');
 await page.locator('.os-children').getByRole('button',{name:'+ Страница'}).click();
 await expect(page.locator('.os-page-editor')).toBeVisible();
 await expect(page.locator('.os-page-editor')).not.toBeEmpty();
 await page.getByRole('button',{name:'QA Родитель 671',exact:true}).last().click();
 await expect(page.locator('.os-page-editor')).toBeVisible();
 await expect(page.getByRole('textbox',{name:'Название страницы'})).toHaveValue('QA Родитель 671');
 await page.goBack();
 await expect(page.locator('.os-page-editor')).toBeVisible();
});

for(const width of [320,390,430,1440]){
 test('6.7.1: dialog and page navigation fit '+width+'px',async({page})=>{
  await page.setViewportSize({width,height:830});
  await enter(page);
  const nav=page.locator('.sidebar-scroll').getByRole('button',{name:'Цели'});
  if(width<=860)await page.getByRole('button',{name:'Открыть меню'}).click();
  await nav.click();
  await page.getByRole('button',{name:'Цель',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Новая обычная цель'});
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

test('6.7.2 F04 and N01: local-only status and accessible workspace, no Details',async({page})=>{
 await enter(page);
 await expect(page.getByText('Синхронизация с облаком')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Обновить локальные тестовые данные'})).toBeVisible();
 await expect(page.locator('.sidebar-bottom')).toContainText('v6.8.1');
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Буфер задач'}).click();
 await page.getByRole('button',{name:'Дополнительные страницы и базы'}).click();
 await expect(page.locator('#os-workspace-panel')).toBeVisible();
 await expect(page.locator('#os-workspace-panel > summary')).toHaveCount(0);
 await page.locator('.os-page-gallery').getByRole('button',{name:/Запуск проекта/}).click();
 await expect(page.locator('.os-page-editor')).toBeVisible();
 await expect(page.locator('#os-workspace-panel > summary')).toHaveCount(0);
});

test('6.7.2 F07: keyboard Workflow edit with Escape cancellation and Enter save',async({page})=>{
 await enter(page);
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Буфер задач'}).click();
 await page.getByRole('button',{name:'Дополнительные страницы и базы'}).click();
 await page.locator('.os-page-gallery').getByRole('button',{name:/Запуск проекта/}).click();
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
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Буфер задач'}).click();
 await page.getByRole('button',{name:'Дополнительные страницы и базы'}).click();
 await page.locator('.os-page-gallery').getByRole('button',{name:/Запуск проекта/}).click();
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
  await expect(page.getByRole('button',{name:'Начать с 5 минут'})).toBeVisible();
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

test('6.8 foundations: reduced motion keeps fast navigation and focus action clickable',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await enter(page);
 const action=page.getByRole('button',{name:'Начать с 5 минут'});
 await expect(action).toBeVisible();
 await action.click();
 await expect(page.locator('.sidebar-scroll').getByRole('button',{name:'Фокус-таймер'})).toHaveAttribute('aria-current','page');
 await expect(page.locator('main.app-content .motion-route')).toBeVisible();
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
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Буфер задач'}).click();
 await page.getByRole('button',{name:'Дополнительные страницы и базы'}).click();
 await page.locator('.os-page-gallery').getByRole('button',{name:/Запуск проекта/}).click();
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
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Буфер задач'}).click();
 await page.getByRole('button',{name:'Дополнительные страницы и базы'}).click();
 await page.locator('.os-page-gallery').getByRole('button',{name:/Запуск проекта/}).click();
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
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Буфер задач'}).click();
 await page.getByRole('button',{name:'Дополнительные страницы и базы'}).click();
 await page.locator('.os-page-gallery').getByRole('button',{name:/Запуск проекта/}).click();
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


test('6.8.1 Shell: Pages inside Buffer only, nested editor and old URLs remain available',async({page})=>{
 await enter(page);
 await expect(page.locator('.sidebar-scroll').getByRole('button',{name:'Страницы'})).toHaveCount(0);
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Буфер задач'}).click();
 await expect(page.locator('.buffer-mvp')).toBeVisible();
 await page.getByRole('button',{name:'Дополнительные страницы и базы'}).click();
 await expect(page.locator('.os-page-gallery')).toBeVisible();
 await expect(page.locator('.sidebar-scroll').getByRole('button',{name:'Буфер задач'})).toHaveAttribute('aria-current','page');
 await page.locator('.os-page-gallery').getByRole('button',{name:/Запуск проекта/}).click();
 await expect.poll(()=>new URL(page.url()).hash).toMatch(/^#\/page\//);
 await page.reload();
 await expect(page.locator('.os-workspace')).toBeVisible();
 await expect(page.locator('.sidebar-scroll').getByRole('button',{name:'Буфер задач'})).toHaveAttribute('aria-current','page');
 await page.goto(entry+'#/workspace');
 await expect(page.locator('.os-page-gallery')).toBeVisible();
 await expect(page.locator('.sidebar-scroll').getByRole('button',{name:'Буфер задач'})).toHaveAttribute('aria-current','page');
});

test('6.8 Shell: confirmed task Income has a direct route, never manual Finance data',async({page})=>{
 await enter(page);
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Доходы'}).click();
 await expect.poll(()=>new URL(page.url()).hash).toBe('#/tab/income');
 await expect(page.getByRole('heading',{name:'Доходы',exact:true})).toBeVisible();
 await expect(page.locator('.mvp-income-feature')).toBeVisible();
 await expect(page.getByRole('heading',{name:'Полученный доход'})).toBeVisible();
 await expect(page.locator('.mvp-income-feature')).toContainText('Разные валюты не складываются');
 await page.reload();
 await expect(page.getByRole('heading',{name:'Доходы',exact:true})).toBeVisible();
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

test('6.8 Goals: regular linked goal has truthful dynamic task target',async({page})=>{
 await enter(page);
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Цели'}).click();
 const linked=page.locator('.regular-goal-card').filter({hasText:'Собрать работающий MVP'});
 await expect(linked).toBeVisible();
 await expect(linked).toContainText('Сейчас');
 await expect(linked).toContainText('Целевое значение');
 await expect(linked).toContainText('задач');
 await expect(linked).toContainText('Автоматически: связанные задачи');
});

test('6.8 Goals: decreasing ambitious goal uses current/target with accurate progress',async({page})=>{
 await enter(page);
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Цели'}).click();
 const weight=page.locator('.goal-full').filter({hasText:'Вес 90 кг'});
 await expect(weight).toBeVisible();
 await expect(weight).toContainText('Сейчас');
 await expect(weight).toContainText('100 кг');
 await expect(weight).toContainText('Целевое значение');
 await expect(weight).toContainText('90 кг');
 await expect(weight).toContainText('41%');
 await weight.getByRole('button',{name:'Обновить'}).click();
 const dialog=page.getByRole('dialog',{name:'Изменить цель'});
 await expect(dialog).toContainText('Снижение');
 await expect(dialog).toContainText('41% пути от старта');
 await dialog.getByRole('spinbutton',{name:'Целевое значение'}).fill('');
 await expect(dialog.getByRole('button',{name:'Сохранить'})).toBeDisabled();
 await dialog.getByRole('spinbutton',{name:'Целевое значение'}).fill('90');
 await dialog.getByRole('button',{name:'Сохранить'}).click();
 await expect(dialog).toHaveCount(0);
 await page.reload();
 await expect(page.locator('.goal-full').filter({hasText:'Вес 90 кг'})).toContainText('Целевое значение');
});

test('6.8 Goals: manual ordinary goal clearly shows 100-percent target',async({page})=>{
 await enter(page);
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Цели'}).click();
 await page.getByRole('button',{name:'Цель',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Новая обычная цель'});
 await dialog.getByRole('textbox',{name:'Название'}).fill('Цель без связей 68');
 await expect(dialog).toContainText('Целевое значение: 100%');
 await dialog.getByRole('button',{name:'Сохранить'}).click();
 await expect(dialog).toHaveCount(0);
 const card=page.locator('.regular-goal-card').filter({hasText:'Цель без связей 68'});
 await expect(card).toContainText('Целевое значение');
 await expect(card).toContainText('100 %');
 await expect(card).toContainText('Ручной процент');
});

test('6.8 integration: Home to Buffer capture, Today transfer and direct Pages/Income',async({page})=>{
 const called:string[]=[];
 page.on('request',r=>{if(r.url().includes('/functions/v1/'))called.push(r.url())});
 await enter(page);
 await expect(page.locator('.next-step-title')).toBeVisible();
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Буфер задач'}).click();
 const capture=page.getByRole('textbox',{name:'Быстро добавить задачу'});
 await capture.fill('Сквозная задача Personal OS 6.8');
 await capture.press('Enter');
 await expect(page.getByRole('button',{name:'Сквозная задача Personal OS 6.8',exact:true})).toBeVisible();
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Сегодня'}).click();
 const picker=page.getByRole('button',{name:/Из буфера/});
 await picker.click();
 await page.getByRole('combobox',{name:'Задача из буфера'}).selectOption({label:'Сквозная задача Personal OS 6.8'});
 await page.locator('#today-buffer-picker').getByRole('button',{name:/В день/}).click();
 await expect(page.getByRole('button',{name:'Сквозная задача Personal OS 6.8',exact:true})).toBeVisible();
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Цели'}).click();
 await expect(page.locator('.goal-values').first()).toBeVisible();
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Буфер задач'}).click();
 await page.getByRole('button',{name:'Дополнительные страницы и базы'}).click();
 await expect(page.locator('.os-page-gallery')).toBeVisible();
 await expect(page.locator('.buffer-mvp')).toBeVisible();
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Доходы'}).click();
 await expect(page.getByRole('heading',{name:'Полученный доход'})).toBeVisible();
 await page.reload();
 await expect(page.getByRole('heading',{name:'Доходы',exact:true})).toBeVisible();
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Сегодня'}).click();
 await expect(page.getByRole('button',{name:'Сквозная задача Personal OS 6.8',exact:true})).toBeVisible();
 expect(called).toEqual([]);
});

for(const width of [320,390,430,1440]){
 test('6.8 integration: Pages and Income routes fit '+width+'px',async({page})=>{
  await page.setViewportSize({width,height:830});
  await enter(page);
  for(const route of ['workspace','income']){
   await page.goto(entry+(route==='workspace'?'#/workspace':'#/tab/income'));
   await expect(page.locator('main.app-content .motion-route')).toBeVisible();
   if(route==='workspace')await expect(page.locator('.os-page-gallery')).toBeVisible();
   else await expect(page.locator('.mvp-income-feature')).toBeVisible();
   const dim=await page.evaluate(()=>({doc:document.documentElement.scrollWidth,width:document.documentElement.clientWidth}));
   expect(dim.doc,'Document overflow at '+width+'px in '+route).toBeLessThanOrEqual(dim.width+2);
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

test('6.8.1 Today: no Focus CTA while Home and Focus timer remain accessible',async({page})=>{
 await enter(page);
 await expect(page.getByRole('button',{name:'Начать с 5 минут'})).toBeVisible();
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Сегодня'}).click();
 await expect(page.locator('.today-task-group--important')).toBeVisible();
 await expect(page.locator('.today-start-focus')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Начать главное — фокус'})).toHaveCount(0);
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Фокус-таймер'}).click();
 await expect(page.locator('.sidebar-scroll').getByRole('button',{name:'Фокус-таймер'})).toHaveAttribute('aria-current','page');
});

