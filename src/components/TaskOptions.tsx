import React,{useEffect,useRef,useState} from 'react';
import {request} from '../lib/api';
import {useApp} from '../AppContext';
import {Icon} from './Icons';
import type {Task} from '../types';
import {reportSaveState,retrySaveEvent} from '../lib/saveStatus';

export function TaskOptions({task,onSaved,propertiesOpen,onToggleProperties}:{task:Task;onSaved:()=>Promise<void>;propertiesOpen:boolean;onToggleProperties:()=>void}){
 const {refreshTasks,today,openTaskPage}=useApp();
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[calendarOpen,setCalendarOpen]=useState(false),[selectedDay,setSelectedDay]=useState(task.day||today);
 const menu=useRef<HTMLDetailsElement>(null),locked=useRef(false);
 const retry=useRef<(()=>void)|null>(null),saveKey='task-command:'+task.id;
 useEffect(()=>{const repeat=()=>retry.current?.();window.addEventListener(retrySaveEvent,repeat);return()=>{window.removeEventListener(retrySaveEvent,repeat);reportSaveState(saveKey,'saved')}},[saveKey]);
 const options=task.task_options||{};
 useEffect(()=>{setSelectedDay(task.day||today);if(task.day)setCalendarOpen(false)},[task.id,task.day,today]);
 const run=async(action:()=>Promise<void>,reloadPage=true)=>{if(locked.current)return;locked.current=true;setBusy(true);setError('');retry.current=null;reportSaveState(saveKey,'saving');let committed=false;try{
  await action();committed=true;
  await Promise.all([refreshTasks(task.completed&&!!task.day&&task.day<today),reloadPage?onSaved():Promise.resolve()]);
  if(menu.current)menu.current.open=false;
  reportSaveState(saveKey,'saved');
 }catch(e:any){
  reportSaveState(saveKey,committed?'saved':'error');
  if(!committed)retry.current=()=>{void run(action,reloadPage)};
  setError((committed?'Изменение сохранено, но обновить данные не удалось: ':'Изменение не сохранено: ')+(e.message||'Ошибка связи'));
 }finally{locked.current=false;setBusy(false)}};
 const patch=(patch:Record<string,unknown>)=>request('os8','task_options_set',{taskId:task.id,patch});
 return <div className="task-options">
  <div className="task-command-bar" aria-label="Управление задачей">
   <div className="task-work-control">
    <button className={'task-complete-button '+(task.completed?'is-complete':task.day?'is-active':'is-buffer')} type="button" disabled={busy} aria-expanded={!task.day&&!task.completed?calendarOpen:undefined} onClick={()=>{
     if(!task.day&&!task.completed){setSelectedDay(today);setCalendarOpen(v=>!v);return}
     void run(async()=>{await request('dashboard','task_toggle',{id:task.id,completed:!task.completed})})
    }}><Icon name={task.completed?'check-circle':task.day?'check':'calendar'} size={18}/>{task.completed?'Завершена':task.day?'Завершить':'Взять в работу'}</button>
    {calendarOpen&&!task.day&&!task.completed&&<form className="task-work-calendar" onSubmit={e=>{e.preventDefault();if(!selectedDay)return;void run(async()=>{await request('os8','task_native_patch',{taskId:task.id,key:'day',value:selectedDay});setCalendarOpen(false)})}}>
     <label>Выбери день<input aria-label="День начала работы" required type="date" value={selectedDay} onChange={e=>setSelectedDay(e.target.value)}/></label>
     <div><button type="button" onClick={()=>setCalendarOpen(false)}>Отмена</button><button type="submit" disabled={!selectedDay||busy}>В работу</button></div>
    </form>}
   </div>
   <button type="button" className={'task-properties-toggle '+(propertiesOpen?'selected':'')} aria-expanded={propertiesOpen} aria-controls="task-inspector" onClick={onToggleProperties}><Icon name="settings" size={17}/>Свойства<Icon name={propertiesOpen?'up':'down'} size={16}/></button>
   <details ref={menu} className="task-actions" onKeyDown={e=>{if(e.key==='Escape'&&menu.current){menu.current.open=false;menu.current.querySelector('summary')?.focus()}}}><summary aria-label="Действия с задачей" title="Действия с задачей"><Icon name="more" size={20}/></summary><div className="task-action-menu">
    <button disabled={busy} onClick={()=>void run(async()=>{const r=await request('os8','task_duplicate',{taskId:task.id});await openTaskPage({...task,id:r.id})},false)}><Icon name="plus" size={16}/>Дублировать</button>
    <button disabled={busy} onClick={()=>void run(async()=>{await patch({template:!options.template})})}><Icon name="book-open" size={16}/>{options.template?'Убрать из шаблонов':'Сохранить как шаблон'}</button>
    <button disabled={busy} onClick={()=>void run(async()=>{await patch({archived:!options.archived})})}><Icon name="inbox" size={16}/>{options.archived?'Вернуть из архива':'В архив'}</button>
    
   </div></details>
  </div>
  {options.archived&&<p className="task-context-note">Задача в архиве. Её можно вернуть через меню действий.</p>}
  {error&&<p role="alert" className="task-error">{error}</p>}
 </div>;
}
