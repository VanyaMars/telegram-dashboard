import {test,expect,type Page} from '@playwright/test';

async function enter(page:Page){
 await page.goto('/telegram-dashboard/?qa=1');
 await page.getByRole('textbox',{name:'Как тебя зовут?'}).fill('ProDesk Flow QA');
 await page.getByRole('button',{name:'Войти в QA Sandbox'}).click();
 await expect(page.getByText('Добро пожаловать')).toBeVisible();
}
const buffer=async(page:Page)=>{await page.locator('.sidebar-scroll').getByRole('button',{name:'Буфер задач'}).click();await expect(page.locator('.buffer-mvp')).toBeVisible()};
test('sidebar sections collapse and last ten tasks return to their origin',async({page})=>{
 await enter(page);await buffer(page);
 const sample=page.locator('.buffer-mvp .task-copy').filter({hasText:'Идеи для автомобильного блога'});
 await sample.click();
 await expect(page.getByRole('button',{name:'Назад',exact:true})).toBeVisible();
 await expect(page.locator('.sidebar-recent-link').first()).toContainText('Идеи для автомобильного блога');
 await page.getByRole('button',{name:'Назад',exact:true}).click();
 await expect(page.locator('.buffer-mvp')).toBeVisible();
 const toggle=page.getByRole('button',{name:'ОСНОВНОЕ — свернуть'});
 await toggle.click();
 await expect(page.locator('.sidebar-scroll').getByRole('button',{name:'Буфер задач'})).toBeHidden();
 await page.getByRole('button',{name:'ОСНОВНОЕ — раскрыть'}).click();
 await expect(page.locator('.sidebar-scroll').getByRole('button',{name:'Буфер задач'})).toBeVisible();
 await page.reload();
 await expect(page.locator('.sidebar-recent-link').first()).toContainText('Идеи для автомобильного блога');
});

test('overdue unfinished tasks automatically move to Today, completed tasks preserve date',async({page})=>{
 await enter(page);
 const ids=await page.evaluate(()=>{
  const session=JSON.parse(localStorage.getItem('personal-os:qa:session:v1')!);
  const key='personal-os:qa:data:v1:'+session.id;
  const data=JSON.parse(localStorage.getItem(key)!);
  const sample=data.tasks.find((t:any)=>t.title==='Идеи для автомобильного блога');
  const overdue=crypto.randomUUID(),completed=crypto.randomUUID();
  data.tasks.push({...sample,id:overdue,title:'Перенос незавершённой задачи',day:'2020-01-15',completed:false,task_options:{...sample.task_options,archived:false,template:false}});
  data.tasks.push({...sample,id:completed,title:'История выполненной задачи',day:'2020-01-15',completed:true,task_options:{...sample.task_options,archived:false,template:false}});
  localStorage.setItem(key,JSON.stringify(data));return {key,overdue,completed};
 });
 await page.reload();
 await page.locator('.sidebar-scroll').getByRole('button',{name:'Сегодня'}).click();
 await expect(page.locator('.task-copy').filter({hasText:'Перенос незавершённой задачи'})).toBeVisible();
 const persisted=await page.evaluate(({key,overdue,completed})=>{
  const tasks=JSON.parse(localStorage.getItem(key)!).tasks;
  return {date:tasks.find((t:any)=>t.id===overdue)?.day,completedDate:tasks.find((t:any)=>t.id===completed)?.day};
 },ids);
 expect(persisted.date).not.toBe('2020-01-15');
 expect(persisted.completedDate).toBe('2020-01-15');
 await buffer(page);await page.getByRole('tab',{name:'В работе',exact:true}).click();
 await expect(page.locator('.task-library-row').filter({hasText:'Перенос незавершённой задачи'})).toBeVisible();
 await expect(page.getByRole('tab',{name:'Завершённые',exact:true})).toBeVisible();
});
test('Pipeline four-dot grip reorders with keyboard and editor sync belongs to cloud',async({page})=>{
 await enter(page);await buffer(page);
 await page.locator('.buffer-mvp .task-copy').filter({hasText:'Идеи для автомобильного блога'}).click();
 const rows=page.locator('.os-pipeline .os-split').first().locator('.os-workflow-row');
 await expect(rows).toHaveCount(2);
 const grip=rows.first().locator('.os-workflow-drag-grip');
 await expect(grip.locator('.os-four-dot-grip i')).toHaveCount(4);
 const first=await rows.first().getByRole('button',{name:/Изменить действие:/}).innerText();
 await grip.press('ArrowDown');
 await expect(rows.last().getByRole('button',{name:/Изменить действие:/})).toHaveText(first);
 const doc=page.getByRole('textbox',{name:'Содержимое задачи'}).first();
 await doc.click();await doc.pressSequentially(' Новый текст для проверки сохранения.');
 await expect(page.locator('.editor-save-hint')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Все изменения сохранены'})).toBeVisible();
 await page.reload();
 await expect(page.getByRole('button',{name:'Назад',exact:true})).toBeVisible();
});
