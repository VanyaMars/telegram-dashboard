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
 await expect(page.locator('.sidebar-bottom')).toContainText('v6.7.2');
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
