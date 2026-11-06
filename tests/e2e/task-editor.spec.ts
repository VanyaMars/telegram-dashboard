import {test,expect,type Page} from '@playwright/test';
async function enter(page:Page){await page.goto('/telegram-dashboard/?qa=1');await page.getByRole('textbox',{name:'Как тебя зовут?'}).fill('Редактор QA');await page.getByRole('button',{name:'Войти в QA Sandbox'}).click();await expect(page.getByText('Добро пожаловать')).toBeVisible();}
async function buffer(page:Page){const menu=page.getByRole('button',{name:'Открыть меню'});if(await menu.isVisible())await menu.click();await page.locator('.sidebar-scroll').getByRole('button',{name:'Буфер задач'}).click();}
async function finishQuick(page:Page){await page.getByRole('dialog',{name:'Категория новой задачи'}).getByRole('button',{name:'Добавить без категории'}).click()}
async function sample(page:Page){await buffer(page);await page.locator('.buffer-mvp .task-copy').filter({hasText:'Идеи для автомобильного блога'}).click();await expect(page.locator('.os-page-editor')).toBeVisible();}
test.use({hasTouch:true});
for(const width of [320,390,430])test('task editor touch: stage and Workflow persist at '+width,async({page},info)=>{
 await page.setViewportSize({width,height:830});await enter(page);await sample(page);
 const pipeline=page.locator('.os-pipeline');await pipeline.locator('.os-add-split input').fill('Публикация с телефона');await pipeline.getByRole('button',{name:'Добавить этап',exact:true}).click();
 const stage=pipeline.locator('.os-split').filter({has:page.locator('input.os-split-title[value="Публикация с телефона"]')});
 await expect(stage).toHaveClass(/expanded/);await stage.getByRole('textbox',{name:'Новое действие Workflow'}).fill('Проверить выпуск');await stage.locator('.os-workflow-add button').click();
 await expect(stage.getByRole('button',{name:'Изменить действие: Проверить выпуск'})).toBeVisible();
 await stage.locator('.os-split-menu summary').click();await stage.getByRole('button',{name:'Копировать этап'}).click();await expect(pipeline.getByRole('button',{name:'Публикация с телефона — копия',exact:true})).toBeVisible();
 const target=await pipeline.locator('.os-split-title').first().evaluate(el=>(el.closest('.os-split')!.querySelector('.os-split-body')!.id).replace('os-split-body-',''));
 await stage.getByLabel('Действия Workflow: Проверить выпуск',{exact:true}).click();await stage.getByLabel('Перенести действие: Проверить выпуск').selectOption(target);
 await expect(stage.getByRole('button',{name:'Изменить действие: Проверить выпуск'})).toHaveCount(0);
 await page.reload();await expect(page.getByRole('button',{name:'Публикация с телефона — копия',exact:true})).toBeVisible();
 await page.screenshot({path:info.outputPath('task-'+width+'.png'),fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});
test('free text autosave survives navigation and supports formatting, slash and toggles',async({page})=>{
 await enter(page);await buffer(page);await page.getByRole('textbox',{name:'Быстро добавить задачу'}).fill('Свободный документ');await page.locator('.buffer-quick button').click();await finishQuick(page);await page.getByRole('button',{name:'Свободный документ',exact:true}).click();
 const doc=page.getByRole('textbox',{name:'Содержимое задачи'});await doc.fill('Документ / со ссылкой');await doc.press('ControlOrMeta+a');await page.getByRole('button',{name:'Добавить блок в текущей строке'}).click();await page.getByRole('button',{name:'Жирный',exact:true}).click();await expect(doc.locator('strong')).toContainText('Документ / со ссылкой');
 await doc.press('ArrowRight');await doc.press('Enter');await expect(doc.locator('p')).toHaveCount(2);await doc.press('/');await page.getByRole('button',{name:'Раскрывающийся список',exact:true}).click();await expect(doc.locator('[data-type="details"]')).toHaveCount(1);
 await page.getByRole('button',{name:'Назад'}).click();await page.getByRole('button',{name:'Свободный документ',exact:true}).click();await expect(page.locator('.task-document strong')).toContainText('Документ / со ссылкой');await expect(page.locator('.task-document [data-type="details"]')).toHaveCount(1);
});
test('custom priorities, optional properties, duplicate, template and archive',async({page})=>{
 await enter(page);await sample(page);await page.getByRole('button',{name:'Свойства',exact:true}).click();await page.getByLabel('Приоритет задачи').selectOption('new');await page.getByLabel('Название приоритета').fill('На этой неделе');await page.getByRole('dialog',{name:'Новый приоритет'}).getByRole('button',{name:'Создать',exact:true}).click();await page.getByLabel('Приоритет задачи').selectOption({label:'На этой неделе'});
 await page.getByRole('button',{name:'Добавить',exact:true}).click();await page.locator('.os-custom-property-add').getByLabel('Название', {exact:true}).fill('Оценка');await page.locator('.os-custom-property-add').getByLabel('Тип свойства',{exact:true}).selectOption('number');await page.getByRole('button',{name:'Создать свойство',exact:true}).click();
 const row=page.locator('.os-custom-property-row').filter({hasText:'Оценка'});await row.locator('input').fill('42');await row.locator('input').blur();await expect(page.getByRole('status').filter({hasText:'Свойство сохранено'})).toBeVisible();await row.getByRole('button',{name:'Настроить свойство Оценка'}).click();await row.getByRole('button',{name:'Удалить из задачи'}).click();await expect(row).toHaveCount(0);
 await page.getByLabel('Действия с задачей',{exact:true}).click();await page.getByRole('button',{name:'Сохранить как шаблон'}).click();await expect(page.locator('.task-actions').first()).not.toHaveAttribute('open','');await page.getByLabel('Действия с задачей',{exact:true}).click();await expect(page.getByRole('button',{name:'Убрать из шаблонов'})).toBeVisible();
 await page.getByRole('button',{name:'Дублировать',exact:true}).click();await expect(page.getByLabel('Название страницы')).toHaveValue('Идеи для автомобильного блога — копия');await expect(page.locator('.os-pipe-summary b')).toHaveText('0%');await expect(page.getByLabel('Приоритет задачи').locator('option:checked')).toHaveText('На этой неделе');
 await page.getByLabel('Действия с задачей',{exact:true}).click();await page.getByRole('button',{name:'В архив',exact:true}).click();await expect(page.locator('.task-context-note')).toBeVisible();await page.getByLabel('Действия с задачей',{exact:true}).click();await expect(page.getByRole('button',{name:'Вернуть из архива'})).toBeVisible();await page.getByRole('button',{name:'Назад'}).click();await expect(page.locator('.task-copy').filter({hasText:'— копия'})).toHaveCount(0);await page.getByRole('tab',{name:'Архив',exact:true}).click();await page.locator('.task-library-row').filter({hasText:'— копия'}).locator('summary').click();await page.getByRole('button',{name:'Восстановить',exact:true}).click();await expect(page.locator('.task-library-row')).toHaveCount(0);await page.getByRole('tab',{name:'Активные',exact:true}).click();await expect(page.locator('.task-copy').filter({hasText:'— копия'})).toHaveCount(1);
});

test('rapid formatting followed by Enter preserves native editing across renders',async({page})=>{
 await enter(page);await buffer(page);await page.getByLabel('Быстро добавить задачу').fill('Быстрый ввод');await page.locator('.buffer-quick button').click();await finishQuick(page);await page.getByRole('button',{name:'Быстрый ввод',exact:true}).click();
 const doc=page.getByRole('textbox',{name:'Содержимое задачи'});
 for(let i=0;i<8;i++){
  await doc.fill('Строка '+i);await doc.press('ControlOrMeta+a');await page.getByRole('button',{name:'Добавить блок в текущей строке'}).click();await page.getByRole('button',{name:'Жирный',exact:true}).click();await doc.press('ArrowRight');await doc.press('Enter');await expect(doc.locator('p')).toHaveCount(2);await doc.pressSequentially('Продолжение '+i);await expect(doc).toContainText('Строка '+i);await expect(doc).toContainText('Продолжение '+i);
 }
 await expect(page.getByRole('button',{name:'Все изменения сохранены'})).toBeVisible();await page.reload();await expect(doc).toContainText('Продолжение 7');
});
