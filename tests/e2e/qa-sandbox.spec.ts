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
