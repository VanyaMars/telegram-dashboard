import {test,expect,type Page} from '@playwright/test';

async function signIn(page:Page){
 await page.goto('/telegram-dashboard/?qa=1');
 await page.getByRole('textbox',{name:'Как тебя зовут?'}).fill('Категории QA');
 await page.getByRole('button',{name:'Войти в QA Sandbox'}).click();
 await expect(page.getByText('Добро пожаловать')).toBeVisible();
}

test('Telegram webhook category is immediately regrouped in Buffer after inspector edit',async({page})=>{
 await signIn(page);
 const taskId=await page.evaluate(()=>{
  const session=JSON.parse(localStorage.getItem('personal-os:qa:session:v1')!);
  const key='personal-os:qa:data:v1:'+session.id;
  const data=JSON.parse(localStorage.getItem(key)!);
  const personalId=crypto.randomUUID(),taskId=crypto.randomUUID();
  data.categories.push({id:personalId,name:'Личное',color:'#a3a3a3',icon:'folder',sort_order:500});
  data.tasks.push({...data.tasks[0],id:taskId,title:'Задача из Telegram webhook',notes:'',day:null,completed:false,os61_category_id:personalId,sphere:'Личное'});
  localStorage.setItem(key,JSON.stringify(data));return taskId;
 });
 await page.reload();
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Буфер задач'}).click();
 const from=page.locator('.buffer-group').filter({has:page.getByRole('heading',{name:'Личное',exact:true})});
 await expect(from.locator('.task-row').filter({hasText:'Задача из Telegram webhook'})).toBeVisible();
 await from.locator('.task-copy').filter({hasText:'Задача из Telegram webhook'}).click();
 await page.getByRole('button',{name:'Свойства',exact:true}).click();
 const panel=page.locator('.os-task-properties');
 await panel.getByRole('button',{name:'Выбрать категорию'}).click();
 await panel.locator('.os-category-menu').getByRole('button',{name:'Быт',exact:true}).click();
 await expect(panel).toHaveAttribute('data-save-status','saved');
 await page.getByRole('button',{name:'Назад',exact:true}).click();
 const into=page.locator('.buffer-group').filter({has:page.getByRole('heading',{name:'Быт',exact:true})});
 await expect(into.locator('.task-row').filter({hasText:'Задача из Telegram webhook'})).toBeVisible();
 await expect(from.locator('.task-row').filter({hasText:'Задача из Telegram webhook'})).toHaveCount(0);
 const stored=await page.evaluate(id=>{
  const session=JSON.parse(localStorage.getItem('personal-os:qa:session:v1')!);
  const data=JSON.parse(localStorage.getItem('personal-os:qa:data:v1:'+session.id)!);
  return data.tasks.find((t:any)=>t.id===id);
 },taskId);
 expect(stored.id).toBe(taskId);
 expect(stored.sphere).toBe('Быт');
 await page.reload();
 await expect(page.locator('.buffer-group').filter({has:page.getByRole('heading',{name:'Быт',exact:true})})
  .locator('.task-row').filter({hasText:'Задача из Telegram webhook'})).toBeVisible();
});
