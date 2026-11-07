import React,{useEffect,useMemo,useState,useRef} from 'react';
import {AnimatePresence,LayoutGroup,useReducedMotion,useIsPresent} from 'motion/react';
import * as m from 'motion/react-m';
import {Icon} from './Icons';
import {motionTokens} from './motionTokens';
import {pipelineProgress,splitProgress,WSplit,WItem} from '../lib/workspace';

type Props={title?:string;blockId:string;initialSplits:WSplit[];initialItems:WItem[];write:(action:string,body:Record<string,unknown>)=>Promise<any>;reload:()=>Promise<void>};
const sameOrder=(a:string[],b:string[])=>a.length===b.length&&a.every((id,i)=>id===b[i]);

/** Local optimistic order only: the backend remains authoritative after each commit. */
export function SplitPipeline({title='Pipeline',blockId,initialSplits,initialItems,write,reload}:Props){
 const reduced=useReducedMotion();
 const [localSplits,setLocalSplits]=useState<WSplit[]>([]);
 const [localItems,setLocalItems]=useState<WItem[]>([]);
 const [patches,setPatches]=useState<Record<string,Partial<WItem>>>({});
 const [deletedItems,setDeletedItems]=useState<string[]>([]);
 const newStages=useRef(new Map<string,Promise<string>>()),stableKeys=useRef(new Map<string,string>());
 const serverSplits=useMemo(()=>initialSplits.filter(s=>s.block_id===blockId).sort((a,b)=>a.position-b.position),[initialSplits,blockId]);
 const splits=useMemo(()=>{
  const ids=new Set(serverSplits.map(s=>s.id));
  return [...serverSplits,...localSplits.filter(s=>!ids.has(s.id))].sort((a,b)=>a.position-b.position);
 },[serverSplits,localSplits]);
 const serverItems=useMemo(()=>initialItems.filter(t=>splits.some(s=>s.id===t.split_id)).sort((a,b)=>a.position-b.position),[initialItems,splits]);
 const items=useMemo(()=>{
  const ids=new Set(serverItems.map(t=>t.id));
  return [...serverItems,...localItems.filter(t=>!ids.has(t.id))]
   .filter(t=>!deletedItems.includes(t.id))
   .map(t=>({...t,...patches[t.id]})).sort((a,b)=>a.position-b.position);
 },[serverItems,localItems,patches,deletedItems]);
 useEffect(()=>{
  const ids=new Set(serverSplits.map(s=>s.id));
  setLocalSplits(prev=>prev.some(s=>ids.has(s.id))?prev.filter(s=>!ids.has(s.id)):prev);
 },[serverSplits]);
 useEffect(()=>{
  const ids=new Set(serverItems.map(t=>t.id));
  setLocalItems(prev=>prev.some(t=>ids.has(t.id))?prev.filter(t=>!ids.has(t.id)):prev);
  setPatches(prev=>{
   let changed=false;const next={...prev};
   for(const [id,patch] of Object.entries(prev)){
    const item=serverItems.find(t=>t.id===id);
    if(item&&Object.entries(patch).every(([k,v])=>item[k as keyof WItem]===v)){delete next[id];changed=true}
   }
   return changed?next:prev;
  });
 },[serverItems]);
 const [active,setActive]=useState<string>('');
 const [newSplit,setNewSplit]=useState(''),[newSplitError,setNewSplitError]=useState(''),[pending,setPending]=useState(false);
 const [localOrder,setLocalOrder]=useState<string[]|null>(null),[orderError,setOrderError]=useState(''),[failedOrder,setFailedOrder]=useState<string[]|null>(null),[moving,setMoving]=useState(false);
 const movingRef=useRef(false),creatingRef=useRef(false),splitRef=useRef<HTMLInputElement>(null);
 useEffect(()=>{if(!splits.some(s=>s.id===active))setActive(splits[0]?.id||'')},[splits,active]);
 useEffect(()=>{if(localOrder&&sameOrder(splits.map(s=>s.id),localOrder))setLocalOrder(null)},[splits,localOrder]);
 const arranged=useMemo(()=>localOrder?[...splits].sort((a,b)=>localOrder.indexOf(a.id)-localOrder.indexOf(b.id)):splits,[splits,localOrder]);
 const total=items.length,done=items.filter(x=>x.completed).length;
 const completed=pipelineProgress(splits,items);
 const nextAction=arranged.flatMap(s=>items.filter(i=>i.split_id===s.id)).find(i=>!i.completed);
 const refreshLater=()=>{void reload().catch(()=>{})};
 const action=async(name:string,body:Record<string,unknown>)=>{const result=await write(name,body);await reload();return result};
 const createWorkflow=async(splitId:string,title:string)=>{
  const draft='pending-item-'+crypto.randomUUID();
  const position=Math.max(0,...items.filter(i=>i.split_id===splitId).map(i=>i.position))+1024;
  setLocalItems(prev=>[...prev,{id:draft,split_id:splitId,title,position,completed:false}]);
  try{
   const actualSplitId=await (newStages.current.get(splitId)||Promise.resolve(splitId));
   const saved=await write('workflow_save',{splitId:actualSplitId,title});
   if(typeof saved?.id!=='string')throw Error('Сервер не вернул ID действия');
   // The optimistic row and the confirmed row are the same React instance.
   // Changing its key here would leave an exiting copy beside the new row.
   stableKeys.current.set(saved.id,draft);
   setLocalItems(prev=>prev.map(i=>i.id===draft?{...i,id:saved.id,split_id:actualSplitId}:i));
   refreshLater();
  }catch(e){setLocalItems(prev=>prev.filter(i=>i.id!==draft));throw e}
 };
 const updateWorkflow=async(item:WItem,patch:Partial<Pick<WItem,'completed'|'title'>>)=>{
  setPatches(prev=>({...prev,[item.id]:{...prev[item.id],...patch}}));
  try{await write('workflow_save',{id:item.id,splitId:item.split_id,...patch});refreshLater()}
  catch(e){setPatches(prev=>{const next={...prev};delete next[item.id];return next});throw e}
 };
 const deleteWorkflow=async(item:WItem)=>{
  setDeletedItems(prev=>[...new Set([...prev,item.id])]);
  try{await write('workflow_delete',{id:item.id});refreshLater()}
  catch(e){setDeletedItems(prev=>prev.filter(id=>id!==item.id));throw e}
 };
 const commitOrder=async(ids:string[])=>{
  if(movingRef.current)return;
  movingRef.current=true;setMoving(true);setLocalOrder(ids);setOrderError('');setFailedOrder(null);
  let committed=false;
  try{await write('split_reorder',{blockId,ids});committed=true;await reload()}
  catch{if(committed)setOrderError('Порядок сохранён, но обновление данных не удалось. Открой страницу повторно.');
   else{setLocalOrder(null);setFailedOrder(ids);setOrderError('Порядок этапов не сохранён. Восстановлен последний подтверждённый порядок.')}}
  finally{movingRef.current=false;setMoving(false)}
 };
 const move=async(splitId:string,direction:number)=>{
  const ids=arranged.map(s=>s.id),i=ids.indexOf(splitId),j=i+direction;
  if(i<0||j<0||j>=ids.length||movingRef.current)return;
  [ids[i],ids[j]]=[ids[j],ids[i]];await commitOrder(ids);
 };
 const addSplit=async(e:React.FormEvent)=>{
  e.preventDefault();if(creatingRef.current)return;
  const title=newSplit.trim();
  if(!title){setNewSplitError('Сначала введи название этапа');splitRef.current?.focus();return}
  creatingRef.current=true;setPending(true);setNewSplitError('');
  const draft='pending-split-'+crypto.randomUUID();
  const position=Math.max(0,...splits.map(s=>s.position))+1024;
  setLocalSplits(prev=>[...prev,{id:draft,block_id:blockId,title,position}]);
  setActive(draft);setNewSplit('');splitRef.current?.focus();
  const creation=write('split_save',{blockId,title}).then((result:any)=>{
   if(typeof result?.id!=='string')throw Error('Сервер не вернул ID этапа');
   return result.id as string;
  });
  newStages.current.set(draft,creation);
  try{
   const id=await creation;
   stableKeys.current.set(id,draft);
   setLocalSplits(prev=>prev.map(s=>s.id===draft?{...s,id}:s));
   setLocalItems(prev=>prev.map(i=>i.split_id===draft?{...i,split_id:id}:i));
   setActive(current=>current===draft?id:current);
   refreshLater();
  }catch{
   setLocalSplits(prev=>prev.filter(s=>s.id!==draft));
   setNewSplit(current=>current||title);
   setNewSplitError('Не удалось подтвердить этап. Проверь список перед повтором.');
  }finally{
   newStages.current.delete(draft);
   creatingRef.current=false;setPending(false);
  }
 };
 return <section className="os-pipeline os-pipeline-premium" aria-label="Pipeline">
  <div className="os-pipe-summary"><div><strong>{title}</strong><span>{total?done+' из '+total+' действий':'Нет задач'}</span></div><b>{completed}%</b></div>
  <div className="os-progress os-pipe-progress" role="progressbar" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={100} aria-label="Прогресс Pipeline">
   <m.span initial={false} style={{width:'100%',transformOrigin:'0% 50%'}} animate={{scaleX:completed/100}}
    transition={reduced?{duration:0}:motionTokens.progress}/>
  </div>
  <p className="os-inline-hint os-pipeline-feedback" role={total>0&&completed===100?'status':undefined}>
   {nextAction?'Следующее действие: '+nextAction.title:total>0&&completed===100?'Все действия выполнены. Можно завершить задачу кнопкой вверху страницы.':'Добавь действие, чтобы начать выполнение.'}
  </p>
  {orderError&&<div className="os-pipe-feedback" role="alert">{orderError}{failedOrder&&<button type="button" disabled={moving} onClick={()=>void commitOrder(failedOrder)}>Повторить перестановку</button>}</div>}
  <div className="os-pipe-tabs" role="tablist" aria-label="Этапы Pipeline">{arranged.map((s,i)=><button role="tab" key={s.id} aria-selected={active===s.id} className={active===s.id?'active':''} onClick={()=>setActive(s.id)}><small>Этап {i+1}</small>{s.title}</button>)}</div>
  <LayoutGroup id={'pipeline-'+blockId}>
   <div className="os-pipe-columns">{arranged.map((s,i)=>
    <m.div className={'os-split '+(active===s.id?'active expanded':'is-collapsed')} key={stableKeys.current.get(s.id)||s.id}
     layout={reduced||!moving?false:'position'} initial={false} transition={reduced?{duration:0}:{type:'spring',stiffness:380,damping:34,mass:.8}}>
     <SplitColumn split={s}index={i}items={items.filter(x=>x.split_id===s.id)}
      move={move}action={action}write={write}reload={reload}createWorkflow={createWorkflow}updateWorkflow={updateWorkflow}deleteWorkflow={deleteWorkflow}rowKey={id=>stableKeys.current.get(id)||id}allSplits={arranged}
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
type ColumnProps={split:WSplit;index:number;items:WItem[];move:(id:string,step:number)=>Promise<void>;action:(name:string,body:Record<string,unknown>)=>Promise<any>;write:(action:string,body:Record<string,unknown>)=>Promise<any>;reload:()=>Promise<void>;createWorkflow:(splitId:string,title:string)=>Promise<void>;updateWorkflow:(item:WItem,patch:Partial<Pick<WItem,'completed'|'title'>>)=>Promise<void>;deleteWorkflow:(item:WItem)=>Promise<void>;rowKey:(id:string)=>string;allSplits:WSplit[];expanded:boolean;toggle:()=>void;stageMoving:boolean};
function SplitColumn({split,index,items,move,action,write,reload,createWorkflow,updateWorkflow,deleteWorkflow,rowKey,allSplits,expanded,toggle,stageMoving}:ColumnProps){
 const reduced=useReducedMotion();
 const [title,setTitle]=useState(split.title),[adding,setAdding]=useState(''),[editError,setEditError]=useState(''),[editing,setEditing]=useState<string|null>(null),[editText,setEditText]=useState(''),[editBusy,setEditBusy]=useState(false),[workflowEditError,setWorkflowEditError]=useState('');
 const [localOrder,setLocalOrder]=useState<string[]|null>(null),[orderError,setOrderError]=useState(''),[failedOrder,setFailedOrder]=useState<string[]|null>(null),[reordering,setReordering]=useState(false);
 const [pendingItems,setPendingItems]=useState<string[]>([]),[renameError,setRenameError]=useState(''),[addingBusy,setAddingBusy]=useState(false);
 const busyItemsRef=useRef(new Set<string>()),orderRef=useRef(false),renameRef=useRef(false),addRef=useRef(false),addInputRef=useRef<HTMLInputElement>(null);
 const [dragging,setDragging]=useState<string|null>(null),[dragOver,setDragOver]=useState<string|null>(null);
 const gesture=useRef<{id:string;startX:number;startY:number;active:boolean;over:string|null;moved:boolean;timer:number|null;pointerType:string}|null>(null);
 const suppressGripClick=useRef(false);
 const stopGrip=()=>{const g=gesture.current;if(g?.timer)window.clearTimeout(g.timer);gesture.current=null;setDragging(null);setDragOver(null)};
 useEffect(()=>()=>{if(gesture.current?.timer)window.clearTimeout(gesture.current.timer)},[]);
 const startGrip=(e:React.PointerEvent<HTMLElement>,id:string)=>{
  if(e.pointerType==='mouse'&&e.button!==0)return;
  const g={id,startX:e.clientX,startY:e.clientY,active:false,over:null as string|null,moved:false,timer:null as number|null,pointerType:e.pointerType};
  if(e.pointerType==='touch')g.timer=window.setTimeout(()=>{g.active=true;setDragging(id)},200);
  gesture.current=g;
  try{e.currentTarget.setPointerCapture(e.pointerId)}catch{}
 };
 const moveGrip=(e:React.PointerEvent<HTMLElement>)=>{
  const g=gesture.current;if(!g)return;
  const distance=Math.abs(e.clientY-g.startY)+Math.abs(e.clientX-g.startX);
  if(!g.active){
   if(g.pointerType==='touch'){if(distance>12)stopGrip();return}
   if(distance<6)return;g.active=true;setDragging(g.id);
  }
  if(e.cancelable)e.preventDefault();
  g.moved=true;
  const hit=(document.elementFromPoint(e.clientX,e.clientY) as HTMLElement|null)?.closest<HTMLElement>('[data-workflow-id]');
  const id=hit?.dataset.workflowId||null;
  if(id&&id!==g.id){g.over=id;setDragOver(id)}
 };
 const endGrip=()=>{
  const g=gesture.current;
  if(g?.active&&g.moved){
   suppressGripClick.current=true;
   if(g.over&&g.over!==g.id){
    const ids=arranged.map(t=>t.id),from=ids.indexOf(g.id),to=ids.indexOf(g.over);
    if(from>=0&&to>=0){ids.splice(from,1);ids.splice(to,0,g.id);void commitRowOrder(ids)}
   }
  }
  stopGrip();
 };
 const gripKeyboard=(e:React.KeyboardEvent,item:WItem)=>{
  if(e.key!=='ArrowUp'&&e.key!=='ArrowDown')return;
  e.preventDefault();e.stopPropagation();void reorder(item.id,e.key==='ArrowUp'?-1:1);
 };
 useEffect(()=>setTitle(split.title),[split.id,split.title]);
 useEffect(()=>{if(localOrder&&sameOrder(items.map(t=>t.id),localOrder))setLocalOrder(null)},[items,localOrder]);
 const arranged=useMemo(()=>localOrder?[...items].sort((a,b)=>localOrder.indexOf(a.id)-localOrder.indexOf(b.id)):items,[items,localOrder]);
 const done=items.filter(t=>t.completed).length,progress=splitProgress(items);
 const commitRowOrder=async(ids:string[])=>{
  if(orderRef.current)return;
  orderRef.current=true;setReordering(true);setLocalOrder(ids);setOrderError('');setFailedOrder(null);
  let committed=false;
  try{await write('workflow_reorder',{splitId:split.id,ids});committed=true;await reload()}
  catch{if(committed)setOrderError('Порядок сохранён, но данные не обновились. Открой страницу повторно.');
   else{setLocalOrder(null);setFailedOrder(ids);setOrderError('Не удалось сохранить порядок. Вернули предыдущий.')}}
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
  try{await updateWorkflow(item,{completed:checked})}
  catch{setWorkflowEditError('Не удалось сохранить отметку. Повтори действие.')}
  finally{busyItemsRef.current.delete(item.id);setPendingItems(prev=>prev.filter(id=>id!==item.id))}
 };
 const rename=async()=>{
  const next=title.trim();if(renameRef.current)return;
  if(!next){setRenameError('Название этапа не может быть пустым');return}
  if(next===split.title){setRenameError('');return}
  renameRef.current=true;setRenameError('');
  try{await write('split_save',{id:split.id,blockId:split.block_id,title:next})}
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
  setEditing(null);
  try{await updateWorkflow(item,{title:next})}
  catch{setEditing(item.id);setWorkflowEditError('Не удалось сохранить действие. Повтори попытку.')}
  finally{setEditBusy(false)}
 };
 const addItem=async(e:React.FormEvent)=>{
  e.preventDefault();if(addRef.current)return;
  if(!adding.trim()){setEditError('Напиши действие перед добавлением');return}
  addRef.current=true;setAddingBusy(true);setEditError('');
  const text=adding.trim();setAdding('');addInputRef.current?.focus({preventScroll:true});
  try{await createWorkflow(split.id,text)}
  catch{setAdding(current=>current||text);setEditError('Не удалось подтвердить действие. Проверь список перед повтором.')}
  finally{addRef.current=false;setAddingBusy(false)}
 };
 return <div className="os-split-card">
  <div className="os-split-top"><span className="os-kicker">ЭТАП {index+1}</span>
   <button type="button" className="os-split-mobile-toggle" onClick={toggle} aria-expanded={expanded} aria-controls={'os-split-body-'+split.id}>
    <strong>{split.title}</strong><Icon name={expanded?'up':'down'} size={17}/>
   </button>
   <details className="os-split-menu"><summary aria-label={'Действия с этапом '+split.title} title="Действия с этапом"><Icon name="more" size={17}/></summary><div className="os-split-actions">
    <button type="button" className="os-icon" disabled={stageMoving||split.id.startsWith('pending-split-')||index===0} title="Этап левее" aria-label="Этап левее" onClick={()=>void move(split.id,-1)}><Icon name="left" size={16}/></button>
    <button type="button" className="os-icon" disabled={stageMoving||split.id.startsWith('pending-split-')||index===allSplits.length-1} title="Этап правее" aria-label="Этап правее" onClick={()=>void move(split.id,1)}><Icon name="right" size={16}/></button>
    <button type="button" onClick={()=>void action('split_duplicate',{id:split.id}).catch(()=>setRenameError('Не удалось скопировать этап.'))}>Копировать этап</button>
    <button type="button" className="os-icon os-danger" title="Удалить этап" aria-label="Удалить этап" onClick={()=>{if(window.confirm('Удалить этап и все его пункты?'))void action('split_delete',{id:split.id}).catch(()=>setRenameError('Не удалось удалить этап.'))}}><Icon name="trash" size={15}/></button>
   </div></details>
  </div>
  <div className="os-split-body" id={'os-split-body-'+split.id}>
    <input className="os-split-title" disabled={split.id.startsWith('pending-split-')} value={title} onChange={e=>{setTitle(e.target.value);setRenameError('')}} maxLength={120} aria-label="Название этапа" onBlur={()=>void rename()} onKeyDown={e=>{if(e.key==='Enter')(e.target as HTMLInputElement).blur()}}/>
   {renameError&&<p className="os-inline-error" role="alert">{renameError}</p>}
   <div className="os-split-metrics"><span>{done} / {items.length} выполнено</span><b>{progress}%</b></div>
   <div className="os-progress"><m.span initial={false} style={{width:'100%',transformOrigin:'0% 50%'}} animate={{scaleX:progress/100}} transition={reduced?{duration:0}:motionTokens.progress}/></div>
   {orderError&&<p className="os-inline-error" role="alert">{orderError}{failedOrder&&<button type="button" className="os-pipe-retry" disabled={reordering} onClick={()=>void commitRowOrder(failedOrder)}>Повторить порядок</button>}</p>}
   {workflowEditError&&editing===null&&<p className="os-inline-error" role="alert">{workflowEditError}</p>}
   <LayoutGroup id={'workflow-'+split.id}><div className="os-workflow-list">
    <AnimatePresence initial={false}>{arranged.map(item=><WorkflowPresence key={rowKey(item.id)} reordering={reordering}>
     <div data-workflow-id={item.id} className={'os-workflow-row '+(dragging===item.id?'is-grip-dragging ':'')+(dragOver===item.id?'is-grip-target':'')}>
     <m.input type="checkbox" checked={item.completed} disabled={item.id.startsWith('pending-item-')||pendingItems.includes(item.id)}
      whileTap={reduced?undefined:{scale:0.97}} transition={reduced?{duration:0}:motionTokens.press}
      aria-label={'Выполнено: '+item.title} onChange={e=>void toggleDone(item,e.target.checked)}/>
     {editing===item.id?<div className="os-workflow-edit">
      <input className="os-inline-input" autoFocus aria-label={'Редактировать действие: '+item.title} value={editText} onChange={e=>setEditText(e.target.value)} maxLength={240}
       onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();cancelEdit()}else if(e.key==='Enter'){e.preventDefault();void saveEdit(item)}}}/>
      <button type="button" disabled={editBusy} onClick={()=>void saveEdit(item)}>Сохранить</button>
      <button type="button" disabled={editBusy} onClick={cancelEdit}>Отмена</button>
      {workflowEditError&&<small role="alert" className="os-inline-error">{workflowEditError}</small>}
     </div>:<button type="button" disabled={item.id.startsWith('pending-item-')} className={'os-workflow-name '+(item.completed?'completed':'')} aria-label={'Изменить действие: '+item.title} onClick={()=>startEdit(item)}>{item.title}</button>}
     {!item.id.startsWith('pending-item-')&&<details className="workflow-actions task-actions" onClickCapture={e=>{if(suppressGripClick.current){e.preventDefault();e.stopPropagation();suppressGripClick.current=false}}}>
      <summary className="os-workflow-drag-grip" aria-label={'Действия Workflow: '+item.title} title="Зажми и перетащи · стрелки вверх/вниз для клавиатуры"
       onPointerDown={e=>startGrip(e,item.id)} onPointerMove={moveGrip} onPointerUp={endGrip} onPointerCancel={stopGrip} onKeyDown={e=>gripKeyboard(e,item)}>
       <span className="os-four-dot-grip" aria-hidden="true"><i/><i/><i/><i/></span></summary><div className="os-task-mini-controls task-action-menu">
      {allSplits.length>1&&<select className="os-workflow-move" aria-label={'Перенести действие: '+item.title} value="" onChange={e=>void action('workflow_move',{id:item.id,splitId:e.target.value}).catch(()=>setWorkflowEditError('Не удалось перенести действие.'))}><option value="" disabled>Перенести в этап…</option>{allSplits.filter(s=>s.id!==split.id).map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select>}
      <button type="button" title="Выше" aria-label={'Выше: '+item.title} disabled={reordering||arranged[0].id===item.id} onClick={()=>void reorder(item.id,-1)}>Переместить выше</button>
      <button type="button" title="Ниже" aria-label={'Ниже: '+item.title} disabled={reordering||arranged[arranged.length-1].id===item.id} onClick={()=>void reorder(item.id,1)}>Переместить ниже</button>
      <button type="button" title="Удалить" aria-label={'Удалить: '+item.title} onClick={()=>{if(window.confirm('Удалить это действие?')){addInputRef.current?.focus({preventScroll:true});void deleteWorkflow(item).catch(()=>setWorkflowEditError('Не удалось удалить действие.'))}}}>Удалить действие</button>
     </div></details>}
     </div></WorkflowPresence>)}</AnimatePresence>
   </div></LayoutGroup>
   <form className="os-workflow-add" onSubmit={e=>void addItem(e)}>
    <input ref={addInputRef} placeholder="Новое действие…" aria-label="Новое действие Workflow" value={adding} onChange={e=>{setAdding(e.target.value);setEditError('')}} maxLength={240}/>
    <button className="os-icon" type="submit" disabled={addingBusy} title="Добавить действие · Enter"><Icon name="check" size={17}/></button>
   </form>
   {editError&&<p role="alert" className="os-inline-error">{editError}</p>}
  </div>
 </div>;
}

/** Only the changed row expands/collapses. A server acknowledgement must not
 * re-run an entrance animation or spring the surrounding stage/form. */
function WorkflowPresence({children,reordering}:{children:React.ReactNode;reordering:boolean}){
 const reduced=useReducedMotion(),present=useIsPresent();
 return <m.div className="os-workflow-presence" aria-hidden={!present||undefined}
  layout={!reduced&&reordering?'position':false}
  initial={reduced?false:{height:0,opacity:0,overflow:'hidden'}}
  animate={{height:'auto',opacity:1,overflow:'hidden',transitionEnd:{overflow:'visible'}}}
  exit={{height:0,opacity:0,overflow:'hidden'}}
  style={{pointerEvents:present?undefined:'none'}}
  transition={reduced?{duration:0}:motionTokens.listRow}>
  {children}
 </m.div>;
}
