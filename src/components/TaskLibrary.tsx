import React,{useEffect,useRef,useState} from 'react';
import {request} from '../lib/api';
import {useApp} from '../AppContext';
import {Icon} from './Icons';
import type {Task} from '../types';
export type TaskLibraryView='working'|'completed'|'templates'|'archive';
export function TaskLibrary({view,query}:{view:TaskLibraryView;query:string}){
 const {openTaskPage,refreshTasks,today}=useApp();
 const [rows,setRows]=useState<Task[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[more,setMore]=useState(false),[busy,setBusy]=useState<string|null>(null);
 const version=useRef(0),offset=useRef(0);
 const load=async(append=false)=>{const current=++version.current;setLoading(true);setError('');try{const r=await request('os8','task_library',{view,query,offset:append?offset.current:0});if(version.current!==current)return;setRows(old=>append?[...old,...r.tasks]:r.tasks);offset.current=(append?offset.current:0)+r.tasks.length;setMore(r.hasMore===true)}catch(e:any){if(version.current===current)setError(e.message)}finally{if(version.current===current)setLoading(false)}};
 const reload=useRef(load);reload.current=load;
 useEffect(()=>{version.current++;setRows([]);setLoading(true);const timer=setTimeout(()=>void load(),150);return()=>{clearTimeout(timer);version.current++}},[view,query]);
 const act=async(task:Task,fn:()=>Promise<void>)=>{if(busy)return;setBusy(task.id);setError('');try{await fn();await refreshTasks(task.completed&&!!task.day&&task.day<today);await reload.current()}catch(e:any){setError(e.message)}finally{setBusy(null)}};
 const empty={working:'Распределённых задач пока нет',completed:'Завершённых задач пока нет',templates:'Сохранённых шаблонов пока нет',archive:'Архив пуст'}[view];
 return <section className="task-library" aria-label={{working:'Задачи в работе',completed:'Завершённые задачи',templates:'Шаблоны задач',archive:'Архив задач'}[view]}>
  {view==='working'&&<p className="task-library-caption">Все незавершённые задачи, запланированные на даты или связанные с целями. Задачи без даты из Буфера здесь тоже появятся, если они связаны с целью.</p>}
  {view==='completed'&&<p className="task-library-caption">Завершённые задачи за все даты. Нажми на название, чтобы открыть содержание.</p>}
  {error&&<div role="alert" className="task-error">{error}<button onClick={()=>void load()}>Повторить</button></div>}
  {!loading&&!error&&!rows.length&&<div className="task-library-empty"><Icon name={view==='completed'?'check-circle':'inbox'} size={28}/><h3>{query?'Ничего не найдено':empty}</h3><p>{query?'Попробуй изменить поисковый запрос.':view==='working'?'Назначь задаче дату или свяжи её с целью — она появится здесь.':view==='completed'?'Заверши задачу — она появится здесь.':view==='templates'?'Сохрани задачу как шаблон через меню «•••».':'Архивные задачи сохраняют свойства и содержимое.'}</p></div>}
  {rows.map(t=><article className="task-library-row" key={t.id}><Icon name={t.completed?'check-circle':view==='working'?'calendar-check':view==='templates'?'book-open':'inbox'} size={19}/><button className="task-library-title" onClick={()=>void openTaskPage(t)}><strong>{t.title}</strong><span>{t.sphere||'Без категории'}{t.day?' · План: '+t.day:''}{t.task_options?.archived?' · В архиве':''}</span></button>{(t.completed||t.task_options?.template||t.task_options?.archived)&&<details className="task-actions" onKeyDown={e=>{if(e.key==='Escape'){e.currentTarget.open=false;e.currentTarget.querySelector('summary')?.focus()}}}><summary aria-label={'Действия: '+t.title}><Icon name="more" size={20}/></summary><div className="task-action-menu">{t.completed&&<button disabled={!!busy} onClick={()=>void act(t,async()=>{await request('dashboard','task_toggle',{id:t.id,completed:false})})}><Icon name="undo" size={16}/>Снять выполнение</button>}{t.task_options?.template&&<button disabled={!!busy} onClick={()=>void act(t,async()=>{const r=await request('os8','task_duplicate',{taskId:t.id});await openTaskPage({...t,id:r.id})})}><Icon name="plus" size={16}/>Создать по шаблону</button>}{t.task_options?.archived&&<button disabled={!!busy} onClick={()=>void act(t,async()=>{await request('os8','task_options_set',{taskId:t.id,patch:{archived:false}})})}><Icon name="undo" size={16}/>Восстановить</button>}</div></details>}</article>)}
  {loading&&<p role="status" className="task-library-caption">Загрузка задач…</p>}{more&&!loading&&<button className="btn outline" onClick={()=>void load(true)}>Показать ещё</button>}
 </section>;
}
