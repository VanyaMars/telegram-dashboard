import React,{useRef,useState} from 'react';
import {useApp} from '../AppContext';
import type {Task} from '../types';
import {Icon} from './Icons';
import {Empty} from './UI';
import {request} from '../lib/api';
import {TaskEmojiPicker,useTaskCardMeta,type TaskCardMeta} from './TaskCardMeta';
import {useReducedMotion} from 'motion/react';
import {motionTokens} from './motionTokens';
import * as m from 'motion/react-m';

type Zone='important'|'extra'|'buffer';
export function TaskList({items,zone,label,emptyMessage}:{items:Task[];zone:Zone;label?:string;emptyMessage?:string}){
  const {reorder}=useApp();const meta=useTaskCardMeta(items.map(x=>x.id));const [drag,setDrag]=useState<{id:string;over:string|null;section:Zone}|null>(null);
  const gesture=useRef<{id:string;active:boolean;timer:number|null;over:string|null;section:Zone;startY:number;startX:number;pointerType:string;moved:boolean}|null>(null);
  const stop=()=>{const g=gesture.current;if(g?.timer)window.clearTimeout(g.timer);gesture.current=null;setDrag(null);};
  const down=(e:React.PointerEvent<HTMLButtonElement>,id:string)=>{
    if(e.button!==0&&e.pointerType==='mouse')return;
    const g={id,active:false,moved:false,timer:null as number|null,over:null as string|null,section:zone,startY:e.clientY,startX:e.clientX,pointerType:e.pointerType};
    if(e.pointerType==='touch')g.timer=window.setTimeout(()=>{g.active=true;setDrag({id,over:null,section:zone});},180);
    gesture.current=g;
    try{e.currentTarget.setPointerCapture(e.pointerId);}catch{/* optional */}

  };
  const move=(e:React.PointerEvent<HTMLButtonElement>)=>{
    const g=gesture.current;if(!g)return;
    if(!g.active){if(g.pointerType!=='touch'&&(Math.abs(e.clientY-g.startY)+Math.abs(e.clientX-g.startX)>5)){g.active=true;setDrag({id:g.id,over:null,section:zone});}else if(g.pointerType==='touch'&&Math.abs(e.clientY-g.startY)>12){stop();return;}else return;}
    g.moved=true;
    const node=document.elementFromPoint(e.clientX,e.clientY) as HTMLElement|null;
    const sectionNode=node?.closest<HTMLElement>('[data-drop-zone]');
    if(sectionNode){
      const section=sectionNode.dataset.dropZone as Zone;
      const task=node?.closest<HTMLElement>('[data-task-id]');
      g.over=task?.dataset.taskId||null;g.section=section;
      setDrag({id:g.id,over:g.over,section});
    }
  };
  const up=()=>{const g=gesture.current;if(g?.active&&g.moved){void reorder(g.id,g.section,g.over===g.id?null:g.over);}stop();};
  const keyboard=(e:React.KeyboardEvent,id:string)=>{
    if(e.key!=='ArrowUp'&&e.key!=='ArrowDown')return;e.preventDefault();
    const idx=items.findIndex(t=>t.id===id),to=idx+(e.key==='ArrowUp'?-1:1);
    if(idx<0||to<0||to>=items.length)return;
    const before=e.key==='ArrowUp'?items[to].id:items[to+1]?.id||null;
    void reorder(id,zone,before);
  };
  return <div className={'task-list '+(drag?'is-dragging':'')} data-drop-zone={zone}>
    {label&&<div className="task-zone-head">{label}<small>{items.length}</small></div>}
    {items.length===0?<div className="task-zone-empty">{emptyMessage||'Задач пока нет'}</div>:
    items.map(item=><TaskRow key={item.id} task={item} zone={zone} meta={meta[item.id]} dragging={drag?.id===item.id} targeted={drag?.over===item.id&&drag.id!==item.id} dragProps={{
      onPointerDown:(e:React.PointerEvent<HTMLButtonElement>)=>down(e,item.id),
      onPointerMove:move,onPointerUp:up,onPointerCancel:stop,
      onKeyDown:(e:React.KeyboardEvent)=>keyboard(e,item.id)
    }}/>) }
  </div>;
}
function TaskRow({task,zone,meta,dragging,targeted,dragProps}:{task:Task;zone:Zone;meta?:TaskCardMeta;dragging:boolean;targeted:boolean;dragProps:any}){
  const {categories,toggleTask,setEditor,reorder,deleteTask,os6,goals,openTaskPage}=useApp();const [menu,setMenu]=useState(false),[emojiMenu,setEmojiMenu]=useState(false),[emoji,setEmoji]=useState('📋');
 React.useEffect(()=>setEmoji(meta?.emoji||'📋'),[meta?.emoji]);
  const reduced=useReducedMotion();
  const category=categories.find(c=>c.id===task.os61_category_id)||categories.find(c=>c.name===task.sphere);
  const goalID=os6.links.find(x=>x.task_id===task.id)?.goal_id;
  const goal=goals.find(g=>g.id===goalID);
 const chooseEmoji=async(v:string)=>{setEmojiMenu(false);setEmoji(v);try{await request('os8','task_emoji_set',{taskId:task.id,emoji:v})}catch{setEmoji(meta?.emoji||'📋')}};
  return <article className={'task-row '+(task.completed?'is-done ':'')+(dragging?'task-moving ':'')+(targeted?'task-drop-target':'')} data-task-id={task.id}>
    <div className="task-leading-actions"><button className="drag-handle" aria-label={`Действия с задачей ${task.title}`} aria-expanded={menu} title="Нажать или удерживать" {...dragProps} onClick={()=>{if(!dragging)setMenu(v=>!v)}}><Icon name="grip" size={16}/></button>
    {menu&&<div className="task-popover" role="menu"><button onClick={()=>{setMenu(false);void openTaskPage(task)}}>Редактировать задачу</button><button onClick={()=>{setMenu(false);void reorder(task.id,'important',null)}}>В важное</button><button onClick={()=>{setMenu(false);void reorder(task.id,'extra',null)}}>В дополнительное</button><button onClick={()=>{setMenu(false);void openTaskPage(task)}}>Привязать к цели</button><button className="danger" onClick={()=>{setMenu(false);void deleteTask(task)}}>Удалить задачу</button></div>}</div>
    {zone!=='buffer'?<m.button whileTap={!reduced?{scale:0.975}:undefined} transition={reduced?{duration:0}:motionTokens.press} className={'task-checkbox '+(task.completed?'checked':'')} onClick={()=>void toggleTask(task)} aria-label={`${task.completed?'Снять выполнение':'Выполнить'}: ${task.title}`}>{task.completed&&<Icon name="check" size={15}/>}</m.button>:null}
    <div className="task-emoji-holder"><button className="task-emoji-trigger" aria-label="Выбрать эмодзи" onClick={()=>setEmojiMenu(x=>!x)}>{emoji}</button>{emojiMenu&&<TaskEmojiPicker value={emoji} onSelect={v=>void chooseEmoji(v)} onClose={()=>setEmojiMenu(false)}/>}</div>
    <button className="task-copy" onClick={()=>void openTaskPage(task)} title="Открыть страницу задачи"><span className="task-text">{task.title}</span><span className="task-labels">
      {category&&<span className="task-category"><i style={{background:category.color}}/>{category.name}</span>}{goal&&<span className="linked-goal"><Icon name="target" size={11}/>{goal.title}</span>}
      {zone==='buffer'&&task.notes&&<span className="task-notes">{task.notes.slice(0,64)}</span>}
    </span></button>
    {typeof meta?.progress==='number'&&<div className="task-card-progress"><div className="task-card-progress-track"><span style={{width:meta.progress+'%'}}/></div><small>{meta.progress}%</small></div>}
   </article>;
}

export function TaskEditor(){const{editor,setEditor,categories,goals,os6,day,saveTask}=useApp();
  const task=editor?.type==='task'?editor.item as Task|undefined:undefined;
  const [title,setTitle]=useState(task?.title||'');const [categoryId,setCategory]=useState(task?.os61_category_id||categories.find(c=>c.name===task?.sphere)?.id||categories[0]?.id||'');
  const [priority,setPriority]=useState<'important'|'extra'>(task?.priority||(editor?.type==='task'?editor.priority:undefined)||'extra');
  const [dayValue,setDayValue]=useState<string>(task?.day||(editor?.type==='task'?editor.day:undefined)||day);const [buffer,setBuffer]=useState(task?.day===null||(editor?.type==='task'&&editor.day===null));
  const [notes,setNotes]=useState(task?.notes||'');const [goalId,setGoalId]=useState(os6.links.find(l=>l.task_id===task?.id)?.goal_id||'');
  const [busy,setBusy]=useState(false);
  const save=async(e:React.FormEvent)=>{e.preventDefault();if(!title.trim())return;setBusy(true);
    try{await saveTask({id:task?.id,title,categoryId,sphere:categories.find(c=>c.id===categoryId)?.name||'Без категории',priority,day:buffer?null:dayValue,notes,goalId});}
    catch{/* notification handled above */}finally{setBusy(false);}
  };
  return <form onSubmit={save} className="editor-form">
    <label>Название задачи<input autoFocus required maxLength={180} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Что нужно сделать?"/></label>
    <div className="form-grid"><label>Категория<select value={categoryId} onChange={e=>setCategory(e.target.value)}><option value="">Без категории</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label>Тип<select value={priority} onChange={e=>setPriority(e.target.value as 'important'|'extra')}><option value="important">Важная</option><option value="extra">Дополнительная</option></select></label></div>
    <div className="form-grid"><label>Дата<input type="date" value={dayValue} disabled={buffer} onChange={e=>setDayValue(e.target.value)}/></label><label className="checkbox-inline"><input type="checkbox" checked={buffer} onChange={e=>setBuffer(e.target.checked)}/> В буфер</label></div>
    <details className="advanced-details"><summary>Дополнительно <Icon name="down" size={16}/></summary>
      <label>Заметка<textarea rows={3} maxLength={6000} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Детали, ссылки, идеи…"/></label>
      <label>Связать с целью<select value={goalId} onChange={e=>setGoalId(e.target.value)}><option value="">Без цели</option>{goals.map(g=><option key={g.id} value={g.id}>{g.title}</option>)}</select></label>
    </details>
    <div className="form-actions"><button type="button" className="btn subtle" onClick={()=>setEditor(null)}>Отмена</button><button type="submit" className="btn accent" disabled={busy||!title.trim()}><Icon name="check" size={16}/>{busy?'Сохраняю…':'Сохранить задачу'}</button></div>
  </form>;
}
