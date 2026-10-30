import React,{useEffect,useMemo,useState,useRef} from 'react';
import {AnimatePresence,LayoutGroup,useReducedMotion} from 'motion/react';
import * as m from 'motion/react-m';
import {Icon} from './Icons';
import {motionTokens} from './motionTokens';
import {pipelineProgress,splitProgress,WSplit,WItem} from '../lib/workspace';

type Props={blockId:string;initialSplits:WSplit[];initialItems:WItem[];write:(action:string,body:Record<string,unknown>)=>Promise<any>;reload:()=>Promise<void>};
const sameOrder=(a:string[],b:string[])=>a.length===b.length&&a.every((id,i)=>id===b[i]);

/** Local optimistic order only: the backend remains authoritative after each commit. */
export function SplitPipeline({blockId,initialSplits,initialItems,write,reload}:Props){
 const reduced=useReducedMotion();
 const splits=useMemo(()=>initialSplits.filter(s=>s.block_id===blockId).sort((a,b)=>a.position-b.position),[initialSplits,blockId]);
 const items=useMemo(()=>initialItems.filter(t=>splits.some(s=>s.id===t.split_id)).sort((a,b)=>a.position-b.position),[initialItems,splits]);
 const [active,setActive]=useState<string>('');
 const [newSplit,setNewSplit]=useState(''),[newSplitError,setNewSplitError]=useState(''),[pending,setPending]=useState(false);
 const [localOrder,setLocalOrder]=useState<string[]|null>(null),[orderError,setOrderError]=useState(''),[failedOrder,setFailedOrder]=useState<string[]|null>(null),[moving,setMoving]=useState(false);
 const movingRef=useRef(false),creatingRef=useRef(false),splitRef=useRef<HTMLInputElement>(null);
 useEffect(()=>{if(!splits.some(s=>s.id===active))setActive(splits[0]?.id||'')},[splits,active]);
 useEffect(()=>{if(localOrder&&sameOrder(splits.map(s=>s.id),localOrder))setLocalOrder(null)},[splits,localOrder]);
 const arranged=useMemo(()=>localOrder?[...splits].sort((a,b)=>localOrder.indexOf(a.id)-localOrder.indexOf(b.id)):splits,[splits,localOrder]);
 const total=items.length,done=items.filter(x=>x.completed).length;
 const completed=pipelineProgress(splits,items);
 const action=async(name:string,body:Record<string,unknown>)=>{const result=await write(name,body);await reload();return result};
 const commitOrder=async(ids:string[])=>{
  if(movingRef.current)return;
  movingRef.current=true;setMoving(true);setLocalOrder(ids);setOrderError('');setFailedOrder(null);
  try{await action('split_reorder',{blockId,ids})}
  catch{setLocalOrder(null);setFailedOrder(ids);setOrderError('Порядок этапов не сохранён. Восстановлен последний подтверждённый порядок.')}
  finally{movingRef.current=false;setMoving(false)}
 };
 const move=async(splitId:string,direction:number)=>{
  const ids=arranged.map(s=>s.id),i=ids.indexOf(splitId),j=i+direction;
  if(i<0||j<0||j>=ids.length||movingRef.current)return;
  [ids[i],ids[j]]=[ids[j],ids[i]];await commitOrder(ids);
 };
 const addSplit=async(e:React.FormEvent)=>{
  e.preventDefault();if(creatingRef.current)return;
  if(!newSplit.trim()){setNewSplitError('Сначала введи название этапа');splitRef.current?.focus();return}
  creatingRef.current=true;setPending(true);setNewSplitError('');
  try{await action('split_save',{blockId,title:newSplit.trim()});setNewSplit('');splitRef.current?.focus()}
  catch{setNewSplitError('Не удалось сохранить этап. Повтори попытку.')}
  finally{creatingRef.current=false;setPending(false)}
 };
 return <section className="os-pipeline os-pipeline-premium" aria-label="Pipeline">
  <div className="os-pipe-summary"><div><strong>Pipeline</strong><span>{total?done+' из '+total+' действий':'Нет задач'}</span></div><b>{completed}%</b></div>
  <div className="os-progress os-pipe-progress" role="progressbar" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={100} aria-label="Прогресс Pipeline">
   <m.span initial={false} style={{width:'100%',transformOrigin:'0% 50%'}} animate={{scaleX:completed/100}}
    transition={reduced?{duration:0}:motionTokens.progress}/>
  </div>
  {orderError&&<div className="os-pipe-feedback" role="alert">{orderError}{failedOrder&&<button type="button" disabled={moving} onClick={()=>void commitOrder(failedOrder)}>Повторить перестановку</button>}</div>}
  <div className="os-pipe-tabs" role="tablist" aria-label="Этапы Pipeline">{arranged.map((s,i)=><button role="tab" key={s.id} aria-selected={active===s.id} className={active===s.id?'active':''} onClick={()=>setActive(s.id)}><small>Этап {i+1}</small>{s.title}</button>)}</div>
  <LayoutGroup id={'pipeline-'+blockId}>
   <div className="os-pipe-columns">{arranged.map((s,i)=>
    <m.div className={'os-split '+(active===s.id?'active expanded':'is-collapsed')} key={s.id}
     layout={reduced?false:'position'} initial={false} transition={reduced?{duration:0}:{type:'spring',stiffness:380,damping:34,mass:.8}}>
     <SplitColumn split={s}index={i}items={items.filter(x=>x.split_id===s.id)}
      move={move}action={action}allSplits={arranged}
      expanded={active===s.id}toggle={()=>setActive(s.id)}stageMoving={moving}/>
    </m.div>
   )}</div>
  </LayoutGroup>
  <form className="os-add-split" onSubmit={e=>void addSplit(e)}>
   <input ref={splitRef} value={newSplit} onChange={e=>{setNewSplit(e.target.value);if(newSplitError)setNewSplitError('')}} placeholder="Например, Планирование" aria-label="Название этапа" aria-invalid={!!newSplitError} aria-describedby={newSplitError?'split-name-error':undefined} maxLength={120}/>
   <button className="os-icon os-save-icon" type="submit" disabled={pending} title="Добавить этап · Enter" aria-label="Добавить этап"><Icon name="check" size={18}/></button>
  </form>
  {newSplitError?<p className="os-inline-error" id="split-name-error" role="alert">{newSplitError}</p>:<p className="os-inline-hint">Введи название и нажми Enter ↵ или галочку</p>}
 </section>;
}
type ColumnProps={split:WSplit;index:number;items:WItem[];move:(id:string,step:number)=>Promise<void>;action:(name:string,body:Record<string,unknown>)=>Promise<any>;allSplits:WSplit[];expanded:boolean;toggle:()=>void;stageMoving:boolean};
function SplitColumn({split,index,items,move,action,allSplits,expanded,toggle,stageMoving}:ColumnProps){
 const reduced=useReducedMotion();
 const [title,setTitle]=useState(split.title),[adding,setAdding]=useState(''),[editError,setEditError]=useState(''),[editing,setEditing]=useState<string|null>(null),[editText,setEditText]=useState(''),[editBusy,setEditBusy]=useState(false),[workflowEditError,setWorkflowEditError]=useState('');
 const [localOrder,setLocalOrder]=useState<string[]|null>(null),[orderError,setOrderError]=useState(''),[failedOrder,setFailedOrder]=useState<string[]|null>(null),[reordering,setReordering]=useState(false);
 const [pendingItems,setPendingItems]=useState<string[]>([]),[renameError,setRenameError]=useState(''),[addingBusy,setAddingBusy]=useState(false);
 const busyItemsRef=useRef(new Set<string>()),orderRef=useRef(false),renameRef=useRef(false),addRef=useRef(false),addInputRef=useRef<HTMLInputElement>(null);
 useEffect(()=>setTitle(split.title),[split.id,split.title]);
 useEffect(()=>{if(localOrder&&sameOrder(items.map(t=>t.id),localOrder))setLocalOrder(null)},[items,localOrder]);
 const arranged=useMemo(()=>localOrder?[...items].sort((a,b)=>localOrder.indexOf(a.id)-localOrder.indexOf(b.id)):items,[items,localOrder]);
 const done=items.filter(t=>t.completed).length,progress=splitProgress(items);
 const commitRowOrder=async(ids:string[])=>{
  if(orderRef.current)return;
  orderRef.current=true;setReordering(true);setLocalOrder(ids);setOrderError('');setFailedOrder(null);
  try{await action('workflow_reorder',{splitId:split.id,ids})}
  catch{setLocalOrder(null);setFailedOrder(ids);setOrderError('Не удалось сохранить порядок. Вернули предыдущий.')}
  finally{orderRef.current=false;setReordering(false)}
 };
 const reorder=async(id:string,delta:number)=>{
  const ids=arranged.map(t=>t.id),a=ids.indexOf(id),b=a+delta;
  if(a<0||b<0||b>=ids.length||orderRef.current)return;
  [ids[a],ids[b]]=[ids[b],ids[a]];await commitRowOrder(ids);
 };
 const toggleDone=async(item:WItem,checked:boolean)=>{
  if(busyItemsRef.current.has(item.id))return;
  busyItemsRef.current.add(item.id);setPendingItems(prev=>[...prev,item.id]);
  setWorkflowEditError('');
  try{await action('workflow_save',{id:item.id,splitId:split.id,completed:checked})}
  catch{setWorkflowEditError('Не удалось сохранить отметку. Повтори действие.')}
  finally{busyItemsRef.current.delete(item.id);setPendingItems(prev=>prev.filter(id=>id!==item.id))}
 };
 const rename=async()=>{
  const next=title.trim();if(renameRef.current)return;
  if(!next){setRenameError('Название этапа не может быть пустым');return}
  if(next===split.title){setRenameError('');return}
  renameRef.current=true;setRenameError('');
  try{await action('split_save',{id:split.id,blockId:split.block_id,title:next})}
  catch{setRenameError('Не удалось сохранить название. Нажми Enter для повторной попытки.')}
  finally{renameRef.current=false}
 };
 const startEdit=(item:WItem)=>{setWorkflowEditError('');setEditText(item.title);setEditing(item.id)};
 const cancelEdit=()=>{if(editBusy)return;setWorkflowEditError('');setEditing(null)};
 const saveEdit=async(item:WItem)=>{
  const next=editText.trim();if(editBusy)return;
  if(!next){setWorkflowEditError('Название не может быть пустым');return}
  if(next===item.title){setEditing(null);setWorkflowEditError('');return}
  setEditBusy(true);setWorkflowEditError('');
  try{await action('workflow_save',{id:item.id,splitId:split.id,title:next});setEditing(null)}
  catch{setWorkflowEditError('Не удалось сохранить действие. Повтори попытку.')}
  finally{setEditBusy(false)}
 };
 const addItem=async(e:React.FormEvent)=>{
  e.preventDefault();if(addRef.current)return;
  if(!adding.trim()){setEditError('Напиши действие перед добавлением');return}
  addRef.current=true;setAddingBusy(true);setEditError('');
  try{await action('workflow_save',{splitId:split.id,title:adding.trim()});setAdding('');addInputRef.current?.focus()}
  catch{setEditError('Не удалось сохранить действие. Ввод сохранён — повтори попытку.')}
  finally{addRef.current=false;setAddingBusy(false)}
 };
 return <div className="os-split-card">
  <div className="os-split-top"><span className="os-kicker">ЭТАП {index+1}</span>
   <button type="button" className="os-split-mobile-toggle" onClick={toggle} aria-expanded={expanded} aria-controls={'os-split-body-'+split.id}>
    <strong>{split.title}</strong><Icon name={expanded?'up':'down'} size={17}/>
   </button>
   <details className="os-split-menu"><summary aria-label={'Действия с этапом '+split.title} title="Действия с этапом"><Icon name="more" size={17}/></summary><div className="os-split-actions">
    <button type="button" className="os-icon" disabled={stageMoving||index===0} title="Этап левее" aria-label="Этап левее" onClick={()=>void move(split.id,-1)}><Icon name="left" size={16}/></button>
    <button type="button" className="os-icon" disabled={stageMoving||index===allSplits.length-1} title="Этап правее" aria-label="Этап правее" onClick={()=>void move(split.id,1)}><Icon name="right" size={16}/></button>
    <button type="button" className="os-icon os-danger" title="Удалить этап" aria-label="Удалить этап" onClick={()=>{if(window.confirm('Удалить этап и все его пункты?'))void action('split_delete',{id:split.id}).catch(()=>setRenameError('Не удалось удалить этап.'))}}><Icon name="trash" size={15}/></button>
   </div></details>
  </div>
  <div className="os-split-body" id={'os-split-body-'+split.id}>
   <input className="os-split-title" value={title} onChange={e=>{setTitle(e.target.value);setRenameError('')}} maxLength={120} aria-label="Название этапа" onBlur={()=>void rename()} onKeyDown={e=>{if(e.key==='Enter')(e.target as HTMLInputElement).blur()}}/>
   {renameError&&<p className="os-inline-error" role="alert">{renameError}</p>}
   <div className="os-split-metrics"><span>{done} / {items.length} выполнено</span><b>{progress}%</b></div>
   <div className="os-progress"><m.span initial={false} style={{width:'100%',transformOrigin:'0% 50%'}} animate={{scaleX:progress/100}} transition={reduced?{duration:0}:motionTokens.progress}/></div>
   {orderError&&<p className="os-inline-error" role="alert">{orderError}{failedOrder&&<button type="button" className="os-pipe-retry" disabled={reordering} onClick={()=>void commitRowOrder(failedOrder)}>Повторить порядок</button>}</p>}
   {workflowEditError&&editing===null&&<p className="os-inline-error" role="alert">{workflowEditError}</p>}
   <LayoutGroup id={'workflow-'+split.id}><div className="os-workflow-list">
    <AnimatePresence initial={false}>{arranged.map(item=><m.div className="os-workflow-row" key={item.id}
     layout={reduced?false:'position'} initial={false} animate={{opacity:1}} exit={reduced?{opacity:0}:{opacity:0,y:-4}}
     transition={reduced?{duration:0}:{type:'spring',stiffness:380,damping:34,mass:.8}}>
     <m.input type="checkbox" checked={item.completed} disabled={pendingItems.includes(item.id)}
      whileTap={reduced?undefined:{scale:0.97}} transition={reduced?{duration:0}:motionTokens.press}
      aria-label={'Выполнено: '+item.title} onChange={e=>void toggleDone(item,e.target.checked)}/>
     {editing===item.id?<div className="os-workflow-edit">
      <input className="os-inline-input" autoFocus aria-label={'Редактировать действие: '+item.title} value={editText} onChange={e=>setEditText(e.target.value)} maxLength={240}
       onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();cancelEdit()}else if(e.key==='Enter'){e.preventDefault();void saveEdit(item)}}}/>
      <button type="button" disabled={editBusy} onClick={()=>void saveEdit(item)}>Сохранить</button>
      <button type="button" disabled={editBusy} onClick={cancelEdit}>Отмена</button>
      {workflowEditError&&<small role="alert" className="os-inline-error">{workflowEditError}</small>}
     </div>:<button type="button" className={'os-workflow-name '+(item.completed?'completed':'')} aria-label={'Изменить действие: '+item.title} onClick={()=>startEdit(item)}>{item.title}</button>}
     {pendingItems.includes(item.id)&&<span className="os-workflow-pending" role="status">Сохраняем…</span>}
     <div className="os-task-mini-controls">
      <button type="button" title="Выше" aria-label={'Выше: '+item.title} disabled={reordering||arranged[0].id===item.id} onClick={()=>void reorder(item.id,-1)}>↑</button>
      <button type="button" title="Ниже" aria-label={'Ниже: '+item.title} disabled={reordering||arranged[arranged.length-1].id===item.id} onClick={()=>void reorder(item.id,1)}>↓</button>
      <button type="button" title="Удалить" aria-label={'Удалить: '+item.title} onClick={()=>{if(window.confirm('Удалить это действие?'))void action('workflow_delete',{id:item.id}).catch(()=>setWorkflowEditError('Не удалось удалить действие.'))}}>×</button>
     </div>
    </m.div>)}</AnimatePresence>
   </div></LayoutGroup>
   <form className="os-workflow-add" onSubmit={e=>void addItem(e)}>
    <input ref={addInputRef} placeholder="Новое действие…" aria-label="Новое действие Workflow" value={adding} onChange={e=>{setAdding(e.target.value);setEditError('')}} maxLength={240}/>
    <button className="os-icon" type="submit" disabled={addingBusy} title="Добавить действие · Enter"><Icon name="check" size={17}/></button>
   </form>
   {editError&&<p role="alert" className="os-inline-error">{editError}</p>}
  </div>
 </div>;
}
