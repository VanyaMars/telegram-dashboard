import {expect,test} from '@playwright/test';

test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});

test('mobile edge swipe opens and closes the menu without intercepting scrolling or center gestures',async({page})=>{
 await page.goto('/telegram-dashboard/?demo=1#/tab/today');
 const sidebar=page.getByRole('complementary',{name:'Боковая навигация'});
 const menuButton=page.getByRole('button',{name:'Открыть меню',exact:true});
 await expect(page.getByRole('heading',{name:'Сегодня'})).toBeVisible();
 await expect(menuButton).toHaveAttribute('aria-expanded','false');
 const touch=await page.context().newCDPSession(page);
 async function swipe(from:{x:number;y:number},to:{x:number;y:number}){
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[from]});
  for(let step=1;step<=8;step++){
   const x=Math.round(from.x+(to.x-from.x)*step/8);
   const y=Math.round(from.y+(to.y-from.y)*step/8);
   await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y}]});
  }
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 }
 await swipe({x:20,y:400},{x:36,y:275});
 await expect(menuButton).toHaveAttribute('aria-expanded','false');
 await swipe({x:160,y:380},{x:300,y:382});
 await expect(menuButton).toHaveAttribute('aria-expanded','false');
 await swipe({x:22,y:300},{x:145,y:305});
 await expect(menuButton).toHaveAttribute('aria-expanded','true');
 await expect(sidebar.getByRole('button',{name:'Календарь'})).toBeVisible();
 await swipe({x:220,y:290},{x:76,y:288});
 await expect(menuButton).toHaveAttribute('aria-expanded','false');
 await menuButton.click();
 await expect(menuButton).toHaveAttribute('aria-expanded','true');
 await sidebar.getByRole('button',{name:'Закрыть меню'}).click();
 await expect(menuButton).toHaveAttribute('aria-expanded','false');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('Today keeps task order on priority changes and preserves priority across reordering',async({page})=>{
 await page.goto('/telegram-dashboard/?qa=1#/tab/today');
 await page.getByRole('textbox',{name:'Как тебя зовут?'}).fill('Проверка важности');
 await page.getByRole('button',{name:'Войти в QA Sandbox'}).click();
 const list=page.locator('.today-task-group > .task-list');
 const row=list.locator('article').filter({has:page.getByRole('button',{name:'Действия с задачей Записаться на ТО'})});
 const actions=row.getByRole('button',{name:'Действия с задачей Записаться на ТО'});
 await expect(actions).toBeVisible();
 const titles=await list.locator('.task-text').allTextContents();
 await actions.click();
 await list.getByRole('button',{name:'Сделать важной'}).click();
 await expect(row).toHaveClass(/today-task-important/);
 await expect(row.getByRole('img',{name:'Важная задача'})).toBeVisible();
 expect(await list.locator('.task-text').allTextContents()).toEqual(titles);
 await actions.press('ArrowDown');
 await expect.poll(async()=>await list.locator('.task-text').allTextContents()).not.toEqual(titles);
 await expect(row).toHaveClass(/today-task-important/);
 await page.reload();
 await expect(row).toHaveClass(/today-task-important/);
 await expect(list.locator('.task-text').last()).toHaveText('Записаться на ТО');
 await actions.click();
 await row.getByRole('button',{name:'Снять важность'}).click();
 await expect(row).not.toHaveClass(/today-task-important/);
 await expect(list.locator('.task-text').last()).toHaveText('Записаться на ТО');
});
