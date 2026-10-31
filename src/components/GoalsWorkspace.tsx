import React,{useEffect,useMemo,useRef,useState} from 'react';
import {useReducedMotion} from 'motion/react';
import * as m from 'motion/react-m';
import {useApp} from '../AppContext';
import {useRegularGoals,RegularGoalEditor,goalEvidence,type RegularGoal,type GoalTaskStats} from './RegularGoals';
import {Icon} from './Icons';
import {Card,Empty,ProgressBar,SectionHead,Sparkline} from './UI';
import {request} from '../lib/api';
import {dateAdd,goalProgress} from '../lib/date';
import {readGoalDocument,goalAgeDays,goalFieldProgress,metricAverage,combinedGoalProgress,formatGoalField,
 type GoalDocument,type GoalField,type GoalFieldType} from '../lib/goalDocument';
import type {Goal,GoalPoint,Task} from '../types';

type GoalKind='regular'|'strategic';
type Selected={kind:GoalKind;id:string};
const kindLabel=(kind:GoalKind)=>kind==='regular'?'Цель':'Стратегическая цель';
const newField=():GoalField=>({id:crypto.randomUUID(),label:'',type:'number',value:'',start:'0',target:'',unit:'',featured:false});
const fromHash=():Selected|null=>{
 const match=window.location.hash.match(/^#\/goal\/(regular|strategic)\/([0-9a-f-]{36})$/i);
 return match?{kind:match[1] as GoalKind,id:match[2]}:null;
};
const toList=()=>{window.location.hash='#/tab/goals'};
const toGoal=(kind:GoalKind,id:string)=>{window.location.hash='#/goal/'+kind+'/'+id};
type GoalLike=RegularGoal|Goal;
function isRegular(goal:GoalLike):goal is RegularGoal{return 'period' in goal}
function goalRaw(goal:GoalLike){return isRegular(goal)?goal.description:goal.notes}
function statusOf(goal:GoalLike,kind:GoalKind,doc:GoalDocument=readGoalDocument(goalRaw(goal))){
 return !!doc.closedAt||(kind==='regular'&&isRegular(goal)&&goal.completed);
}
function goalProgressParts(kind:GoalKind,goal:GoalLike,stats:GoalTaskStats,linked:{total:number;done:number}|null,doc:GoalDocument=readGoalDocument(goalRaw(goal))){
 const metric=metricAverage(doc.fields);
 const task=linked&&linked.total>0?Math.round(linked.done/linked.total*100):null;
 const original=kind==='strategic'?goalProgress(goal as Goal):null;
 return {percent:combinedGoalProgress([original,task,metric]),task,metric,doc};
}
function Duration({goal,closed,today,tz,doc}:{goal:GoalLike;closed:boolean;today:string;tz:string;doc:GoalDocument}){
 const age=goalAgeDays(goal.created_at,doc.closedAt,today,tz);
 if(closed&&!doc.closedAt)return <span className="goal-card-age">Закрыта · дата неизвестна</span>;
 if(age===null)return <span className="goal-card-age">Дата создания неизвестна</span>;
 return <span className="goal-card-age">{closed?'Выполнена за ':'Активна '}{age} {age===1?'день':age<5?'дня':'дней'}</span>;
}
function GoalCard({goal,kind,stats,linked,today,tz,doc,onOpen}:{goal:GoalLike;kind:GoalKind;stats:GoalTaskStats;linked:{total:number;done:number}|null;today:string;tz:string;doc:GoalDocument;onOpen:()=>void}){
 const reduced=useReducedMotion(),closed=statusOf(goal,kind,doc),{percent}=goalProgressParts(kind,goal,stats,linked,doc);
 const featured=doc.fields.filter(f=>f.featured).slice(0,2);
 return <m.button className={'goal-work-card '+(closed?'goal-work-card--done':'')} type="button" onClick={onOpen}
  whileTap={reduced?undefined:{scale:.985}} whileHover={reduced?undefined:{y:-2}}
  transition={reduced?{duration:0}:{duration:.2,ease:'easeOut'}}>
  <div className="goal-work-card-top"><h3>{goal.title}</h3><Duration goal={goal} closed={closed} today={today} tz={tz} doc={doc}/></div>
  <div className="goal-work-card-middle">
   <span><Icon name="list-checks" size={15}/>{linked?linked.done:0}/{linked?linked.total:0} задач</span>
   <span className="goal-work-card-percent">{percent}%</span>
  </div>
  <div className="goal-work-card-bottom"><div className="goal-work-card-bar"><ProgressBar value={percent}/></div>
   <div className="goal-work-kpis">{featured.length?featured.map(f=><span key={f.id} className="goal-work-kpi"><small>{f.label}</small><strong>{formatGoalField(f)}</strong></span>):<span className="goal-work-no-kpi">Открыть цель <Icon name="arrow-up-right" size={15}/></span>}</div>
  </div>
 </m.button>;
}
export function GoalsWorkspace(){
 const app=useApp(),{goals:regular,goalStats,loading,error,reload}=useRegularGoals();
 const [selected,setSelected]=useState<Selected|null>(fromHash);
 const [view,setView]=useState<'active'|'closed'>('active');
 const [regularEdit,setRegularEdit]=useState<RegularGoal|null|undefined>(undefined);
 const [documents,setDocuments]=useState<Record<string,{fields:GoalField[];closedAt:string|null}>>({});
 const [documentsError,setDocumentsError]=useState('');
 const loadDocuments=async()=>{
  try{
   const r=await request<{documents:Array<{goal_kind:GoalKind;goal_id:string;fields:GoalField[];closed_at:string|null}>}>('os8','goal_documents_list');
   setDocuments(Object.fromEntries((r.documents||[]).map(d=>[d.goal_kind+':'+d.goal_id,{fields:d.fields,closedAt:d.closed_at}])));
   setDocumentsError('');
  }catch(e:any){setDocumentsError('Хранилище показателей ещё недоступно. Для сохранения требуется обновление сервера.');}
 };
 useEffect(()=>{void loadDocuments()},[]);
 const documentFor=(g:GoalLike,kind:GoalKind):GoalDocument=>{
  const legacy=readGoalDocument(goalRaw(g));
  const current=documents[kind+':'+g.id];
  return current?{...legacy,fields:current.fields,closedAt:current.closedAt}:legacy;
 };

 useEffect(()=>{const sync=()=>setSelected(fromHash());window.addEventListener('hashchange',sync);return()=>window.removeEventListener('hashchange',sync)},[]);
 const afterSave=()=>{window.dispatchEvent(new Event('os8:goals-changed'));void reload();void loadDocuments()};
 const strategic=app.goals;
 const allRegular=(view==='active'?regular.filter(g=>!statusOf(g,'regular',documentFor(g,'regular'))):regular.filter(g=>statusOf(g,'regular',documentFor(g,'regular'))));
 const allStrategic=(view==='active'?strategic.filter(g=>!statusOf(g,'strategic',documentFor(g,'strategic'))):strategic.filter(g=>statusOf(g,'strategic',documentFor(g,'strategic'))));
 const open=(kind:GoalKind,id:string)=>toGoal(kind,id);
 if(selected){
  const goal=selected.kind==='regular'?regular.find(g=>g.id===selected.id):strategic.find(g=>g.id===selected.id);
  if(!goal)return <div className="page-stack goals-workspace"><button className="goal-back" onClick={toList}><Icon name="arrow-left" size={17}/> Ко всем целям</button><Card>{loading?<p>Загружаем цель…</p>:<Empty title="Цель не найдена" description="Возможно, её уже удалили."/>}</Card></div>;
  return <GoalDetail key={selected.kind+selected.id} kind={selected.kind} goal={goal} stats={goalStats} storedDocument={documentFor(goal,selected.kind)}
   onBack={toList} onEdit={()=>selected.kind==='regular'?setRegularEdit(goal as RegularGoal):app.setEditor({type:'goal',item:goal})} onUpdated={afterSave}
   editOverlay={regularEdit!==undefined&&selected.kind==='regular'?<RegularGoalEditor item={regularEdit} onClose={()=>setRegularEdit(undefined)} onSaved={afterSave}/>:null}/>;
 }
 const cards=(kind:GoalKind,goals:GoalLike[])=><div className="goal-work-grid">{goals.map(goal=>{
  const linked=kind==='regular'?goalStats[goal.id]||{total:0,done:0}:(()=>{
   const ids=new Set(app.os6.links.filter(x=>x.goal_id===goal.id).map(x=>x.task_id));
   const visible=[...app.tasks,...app.buffer].filter(x=>ids.has(x.id));
   return {total:ids.size,done:visible.filter(x=>x.completed).length};
  })();
  return <GoalCard key={goal.id} goal={goal} kind={kind} stats={goalStats} linked={linked} today={app.today} tz={app.tz} doc={documentFor(goal,kind)} onOpen={()=>open(kind,goal.id)}/>;
 })}{!goals.length&&<div className="goal-work-empty">{view==='closed'?'Нет закрытых целей':'Здесь пока нет целей'}.</div>}</div>;
 return <div className="page-stack goals-workspace">
  <div className="page-heading goals-work-header"><div><span className="eyebrow">ОРИЕНТИРЫ И ДЕЙСТВИЯ</span><h1>Цели</h1><p>От намерения к измеримому результату.</p></div></div>
  <div className="goal-work-tabs" role="tablist" aria-label="Статус целей">
   <button type="button" role="tab" aria-selected={view==='active'} className={view==='active'?'active':''} onClick={()=>setView('active')}>Активные</button>
   <button type="button" role="tab" aria-selected={view==='closed'} className={view==='closed'?'active':''} onClick={()=>setView('closed')}>Закрытые цели</button>
  </div>
  {error&&<p className="os-error-banner" role="alert">{error}<button onClick={()=>void reload()}>Повторить</button></p>}
  {documentsError&&<p className="goal-doc-warning" role="status">{documentsError}</p>}
  <section className="goal-work-section"><SectionHead title="Цели" caption="Повседневные и проектные"
   action={<button className="btn small accent" onClick={()=>setRegularEdit(null)}><Icon name="plus" size={15}/> Цель</button>}/>
   {loading?<p className="tiny-note">Загрузка…</p>:cards('regular',allRegular)}
  </section>
  <section className="goal-work-section"><SectionHead title="Стратегические цели" caption="Крупные ориентиры на долгий срок"
   action={<button className="btn small outline" onClick={()=>app.setEditor({type:'goal'})}><Icon name="plus" size={15}/> Стратегическая</button>}/>
   {cards('strategic',allStrategic)}
  </section>
  {regularEdit!==undefined&&<RegularGoalEditor item={regularEdit} onClose={()=>setRegularEdit(undefined)} onSaved={afterSave}/>}
 </div>;
}
type DetailProps={kind:GoalKind;goal:GoalLike;stats:GoalTaskStats;storedDocument:GoalDocument;onBack:()=>void;onEdit:()=>void;onUpdated:()=>void;editOverlay:React.ReactNode};
function GoalDetail({kind,goal,stats,storedDocument,onBack,onEdit,onUpdated,editOverlay}:DetailProps){
 const app=useApp(),regular=isRegular(goal);
 const [tab,setTab]=useState<'overview'|'tasks'|'analytics'>('overview');
 const [doc,setDoc]=useState<GoalDocument>(storedDocument);
 const [localClosed,setLocalClosed]=useState<boolean|null>(null);
 const [editingFields,setEditingFields]=useState(false),[draftBaseline,setDraftBaseline]=useState<GoalDocument|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState('');
 const [allTasks,setAllTasks]=useState<Task[]>([]),[linkedIds,setLinkedIds]=useState<string[]>([]),[linkLoading,setLinkLoading]=useState(false),[linkError,setLinkError]=useState('');
 const [freshStats,setFreshStats]=useState<{total:number;done:number}|null>(null);
 const [taskDraft,setTaskDraft]=useState(''),[draftId,setDraftId]=useState<string|null>(null),[linkExisting,setLinkExisting]=useState(''),[taskSaving,setTaskSaving]=useState(false);
 const saveLock=useRef(false),taskLock=useRef(false);
 const storedRaw=goalRaw(goal);
 useEffect(()=>{setDoc(storedDocument);},[goal.id,storedRaw,JSON.stringify(storedDocument.fields),storedDocument.closedAt]);
 const loadTasks=async()=>{
  setLinkLoading(true);setLinkError('');
  const periods=[[dateAdd(app.today,-60),app.today],[dateAdd(app.today,1),dateAdd(app.today,61)]];
  const results=await Promise.allSettled([
   request<{daily:Task[];buffer:Task[]}>('dashboard','tasks_list',{day:app.today}),
   ...periods.map(([start,end])=>request<{tasks:Task[]}>('os6','calendar',{start,end})),
   ...(kind==='regular'?[request<{stats:GoalTaskStats}>('os9','regular_goal_stats')]:[])
  ]);
  const list=results[0].status==='fulfilled'?results[0].value:null;
  const calendar=results.slice(1,3).flatMap(item=>item.status==='fulfilled'?item.value.tasks||[]:[]);
  // Network snapshots win over outdated AppContext data after a write.
  const unique=[...new Map([...app.buffer,...app.tasks,...calendar,...(list?.buffer||[]),...(list?.daily||[])].map(t=>[t.id,t])).values()];
  setAllTasks(unique);
  if(kind==='regular'){
   const res=results[3];if(res?.status==='fulfilled')setFreshStats(res.value.stats?.[goal.id]||{total:0,done:0});
   const related:string[]=[];
   for(let i=0;i<unique.length;i+=12){
    const responses=await Promise.allSettled(unique.slice(i,i+12).map(task=>request<{goalId:string|null}>('os9','regular_goal_get',{taskId:task.id})));
    responses.forEach((response,j)=>{if(response.status==='fulfilled'&&response.value.goalId===goal.id)related.push(unique[i+j].id)});
   }
   setLinkedIds(related);
  }else{
   setLinkedIds(app.os6.links.filter(l=>l.goal_id===goal.id).map(l=>l.task_id));
  }
  if(results.slice(0,3).every(item=>item.status==='rejected'))
   setLinkError('Не удалось обновить список задач. Проверь соединение и попробуй ещё раз.');
  setLinkLoading(false);
 };
 useEffect(()=>{void loadTasks()},[goal.id,kind,app.today]);
 const linked=allTasks.filter(t=>linkedIds.includes(t.id));
 const missing=kind==='strategic'?Math.max(0,linkedIds.length-linked.length):Math.max(0,(stats[goal.id]?.total||0)-linked.length);
 const counts=kind==='regular'?freshStats||stats[goal.id]||{total:0,done:0}:{total:linkedIds.length,done:linked.filter(t=>t.completed).length};
 const {percent,metric,task}=goalProgressParts(kind,goal,stats,counts,doc);
 const closed=localClosed??statusOf(goal,kind,doc);
 const measured=doc.fields.map(goalFieldProgress).filter((x):x is number=>x!==null);
 const featured=doc.fields.filter(f=>f.featured);
 const updateField=(id:string,patch:Partial<GoalField>)=>setDoc(old=>({...old,fields:old.fields.map(f=>f.id===id?{...f,...patch}:f)}));
 const saveDoc=async(nextDoc:GoalDocument,statusChange?:'close'|'reopen')=>{
  if(saveLock.current)return;
  try{
   saveLock.current=true;setBusy(true);setError('');setSaved('');
   const r=await request<{document:{closed_at:string|null;fields:GoalField[]}}>('os8','goal_document_save',{
    kind,goalId:goal.id,fields:nextDoc.fields,closedAt:nextDoc.closedAt,notesBody:nextDoc.body,statusChange
   });
   setDoc({...nextDoc,fields:r.document.fields,closedAt:r.document.closed_at});
   setEditingFields(false);setDraftBaseline(null);
   if(statusChange)setLocalClosed(statusChange==='close');
   setSaved(statusChange==='close'?'Цель закрыта':statusChange==='reopen'?'Цель снова активна':'Показатели и заметки сохранены');
   onUpdated();if(kind==='strategic')void app.refresh();
  }catch(e:any){setError((e?.message||'Не удалось сохранить цель')+'. Введённые значения остались на экране.')}
  finally{saveLock.current=false;setBusy(false)}
 };
 const complete=()=>{void saveDoc({...doc,closedAt:closed?null:new Date().toISOString()},closed?'reopen':'close')};
 const startEditing=(add=false)=>{
  setDraftBaseline({...doc,fields:doc.fields.map(f=>({...f}))});
  if(add)setDoc(previous=>({...previous,fields:[...previous.fields,newField()]}));
  setEditingFields(true);setError('');setSaved('');
 };
 const cancelEditing=()=>{if(busy)return;if(draftBaseline)setDoc(draftBaseline);setEditingFields(false);setDraftBaseline(null)};

 const createTask=async(e:React.FormEvent)=>{
  e.preventDefault();if(taskLock.current||!taskDraft.trim())return;
  taskLock.current=true;setTaskSaving(true);setLinkError('');setSaved('');
  let createdId=draftId,creationConfirmed=!!draftId;
  const title=taskDraft.trim();
  try{
   if(!createdId){
    const result=await request<{id:string}>('os6','task_save_and_link',{id:null,task:{
     title,notes:'',sphere:'Личное',day:null,priority:'extra'
    },goal_id:kind==='strategic'?goal.id:null});
    createdId=result.id;creationConfirmed=true;setDraftId(createdId);
   }
   if(kind==='regular')await request('os9','regular_goal_set',{taskId:createdId,goalId:goal.id});
   const created:Task={id:createdId!,title,notes:'',sphere:'Личное',day:null,priority:'extra',completed:false};
   setAllTasks(rows=>[created,...rows.filter(t=>t.id!==created.id)]);
   setLinkedIds(ids=>[...new Set([...ids,created.id])]);
   setFreshStats(prev=>kind==='regular'?{total:(prev?.total??counts.total)+1,done:prev?.done??counts.done}:prev);
   setTaskDraft('');setDraftId(null);setSaved('Задача создана и привязана к цели. Она находится в Буфере.');
   try{await app.refresh();onUpdated();}catch{
    setLinkError('Задача сохранена. Обновление общего списка не удалось — повтори позже.');
   }
  }catch(e:any){
   if(creationConfirmed&&createdId)setDraftId(createdId);
   setLinkError((creationConfirmed?'Задача уже создана, но привязка не завершена. Повтори попытку: ':'Не удалось создать задачу: ')+(e?.message||'Ошибка соединения'));
  }finally{taskLock.current=false;setTaskSaving(false)}
 };
 const linkTask=async(task:Task,unlink=false)=>{
  if(taskLock.current)return;taskLock.current=true;setTaskSaving(true);setLinkError('');
  try{
   if(kind==='regular')await request('os9','regular_goal_set',{taskId:task.id,goalId:unlink?null:goal.id});
   else await request('os6','task_save_and_link',{id:task.id,task:{title:task.title,notes:task.notes,sphere:task.sphere,day:task.day,priority:task.priority},goal_id:unlink?null:goal.id});
   setLinkedIds(ids=>unlink?ids.filter(id=>id!==task.id):[...new Set([...ids,task.id])]);
   setLinkExisting('');
   await app.refresh();onUpdated();setSaved(unlink?'Связь с задачей удалена':'Задача привязана');
  }catch(e:any){setLinkError(e?.message||'Связь не сохранена')}
  finally{taskLock.current=false;setTaskSaving(false)}
 };
 const toggleDone=async(taskItem:Task)=>{
  if(taskLock.current)return;taskLock.current=true;setTaskSaving(true);setLinkError('');setSaved('');
  let rescheduled=false,committed=false;
  try{
   // The deployed dashboard.task_toggle only accepts daily tasks, not Buffer tasks.
   // Explicit completion of a Buffer task moves the SAME task ID into Today first.
   if(!taskItem.day){
    await request('os6','task_reschedule',{id:taskItem.id,day:app.today});
    rescheduled=true;
   }
   await request('dashboard','task_toggle',{id:taskItem.id,completed:!taskItem.completed});
   committed=true;
   setAllTasks(rows=>rows.map(t=>t.id===taskItem.id?{...t,day:t.day||app.today,completed:!t.completed}:t));
   if(kind==='regular')setFreshStats(prev=>({...prev||counts,done:Math.max(0,(prev?.done??counts.done)+(taskItem.completed?-1:1))}));
   setSaved(rescheduled?'Задача выполнена и перенесена в Сегодня':'Статус задачи сохранён');
   try{await app.refresh();onUpdated();}catch{setLinkError('Отметка сохранена, но обновить общий список не удалось.')}
  }catch(e:any){
   const lead=committed?'Статус сохранён. ':rescheduled?'Задача перенесена в Сегодня, но не отмечена выполненной. ':'';
   setLinkError(lead+(e?.message||'Не удалось отметить задачу'));
  }finally{taskLock.current=false;setTaskSaving(false)}
 };
 const duration=goalAgeDays(goal.created_at,doc.closedAt,app.today,app.tz);
 const options:GoalFieldType[]=['number','percent','text','checkbox','date','select'];
 const typeLabels:Record<GoalFieldType,string>={number:'Число',percent:'Проценты',text:'Текст',checkbox:'Флажок',date:'Дата',select:'Выбор'};
 const unfound=allTasks.filter(t=>!linkedIds.includes(t.id));
 return <div className="page-stack goal-detail">
  <div className="goal-detail-top"><button className="goal-back" type="button" onClick={onBack}><Icon name="arrow-left" size={18}/> Все цели</button>
   <span className={'goal-detail-state '+(closed?'closed':'')}>{closed?'Закрыта':'Активна'}</span>
  </div>
  <div className="goal-detail-hero"><span className="eyebrow">{kindLabel(kind)}</span>
   <div className="goal-detail-title-row"><h1>{goal.title}</h1><button className="btn outline" onClick={onEdit}><Icon name="edit" size={16}/> Свойства</button></div>
   <div className="goal-detail-meta"><Duration goal={goal} closed={closed} today={app.today} tz={app.tz} doc={doc}/><span>{counts.done}/{counts.total} связанных задач</span>
    {duration!==null&&<span>{closed?'На выполнение':'В работе'}: {duration} дн.</span>}
   </div>
   <div className="goal-detail-progress"><ProgressBar value={percent}/><strong>{percent}%</strong></div>
   <p className="goal-progress-explainer">Автоматический прогресс по задачам и измеримым показателям{kind==='strategic'?', включая основное значение цели':''}.</p>
   {featured.length>0&&<div className="goal-featured-overview" aria-label="Ключевые показатели">{featured.map(f=><div className="goal-featured-tile" key={f.id}><span>{f.label||'Показатель'}</span><strong>{formatGoalField(f)}</strong></div>)}</div>}
  </div>
  <div className="goal-detail-nav" role="tablist" aria-label="Разделы цели">
   {[['overview','Обзор'],['tasks','Задачи'],['analytics','Аналитика']].map(([id,label])=><button key={id} role="tab" aria-selected={tab===id} className={tab===id?'active':''} onClick={()=>setTab(id as typeof tab)}>{label}</button>)}
  </div>
  {error&&<p className="os-error-banner" role="alert">{error}</p>}
  {saved&&<p className="goal-save-status" role="status"><Icon name="check-circle" size={16}/>{saved}</p>}
  {tab==='overview'&&<div className="goal-detail-panels">
   <Card className="goal-editor-panel">
    <SectionHead title="Показатели" caption="Все свойства цели — независимо от выбранных ключевых показателей."
     action={!editingFields?<button type="button" className="btn outline goal-edit-metrics" onClick={()=>startEditing()}><Icon name="edit" size={16}/> Настроить</button>:undefined}/>
    {!editingFields&&<div className="goal-metrics-overview">
     {doc.fields.length?doc.fields.map(f=><div key={f.id} className="goal-metric-preview">
      <div className="goal-metric-title"><span>{f.label||'Новый показатель'}</span>{f.featured&&<small className="goal-metric-featured">Ключевой</small>}</div>
      <strong>{formatGoalField(f)}</strong>
      {goalFieldProgress(f)!==null&&<div className="goal-metric-mini-progress"><ProgressBar value={goalFieldProgress(f)||0}/></div>}
     </div>):<div className="goal-metric-empty"><Icon name="sliders-horizontal" size={22}/><strong>Добавь первый показатель</strong><span>Доход, вес, количество действий, статус — всё в одном месте.</span></div>}
     <button type="button" className="goal-add-metric" onClick={()=>startEditing(true)}><Icon name="plus" size={16}/> Добавить показатель</button>
    </div>}
    {editingFields&&<>
     <p className="goal-edit-help">Выбери тип, укажи значение. До двух показателей можно закрепить на карточке цели.</p>
    <div className="goal-field-grid">{doc.fields.map((field,i)=><div className="goal-field-editor" key={field.id}>
     <div className="goal-field-line"><label className="goal-field-title">Название<input value={field.label} maxLength={100} placeholder="Например, Выручка" onChange={e=>updateField(field.id,{label:e.target.value})}/></label>
      <label>Тип<select value={field.type} onChange={e=>updateField(field.id,{type:e.target.value as GoalFieldType,value:'',start:'0',target:''})}>
       {options.map(t=><option key={t} value={t}>{typeLabels[t]}</option>)}</select></label>
      <button className="goal-field-remove" type="button" aria-label={'Удалить показатель '+(i+1)} onClick={()=>setDoc(d=>({...d,fields:d.fields.filter(f=>f.id!==field.id)}))}><Icon name="trash" size={17}/></button>
     </div>
     <div className="goal-field-line goal-field-line--values">
      {field.type==='checkbox'?<label className="goal-checkbox-label"><input type="checkbox" checked={field.value==='true'} onChange={e=>updateField(field.id,{value:String(e.target.checked)})}/> Выполнено</label>
      :field.type==='select'?<><label>Варианты (через запятую)<input value={(field.options||[]).join(', ')} maxLength={240} onChange={e=>updateField(field.id,{options:e.target.value.split(',').map(s=>s.trim()).filter(Boolean).slice(0,12)})}/></label>
       <label>Выбор<select value={field.value} onChange={e=>updateField(field.id,{value:e.target.value})}><option value="">—</option>{(field.options||[]).map(s=><option key={s} value={s}>{s}</option>)}</select></label></>
      :<label>Значение<input type={field.type==='number'||field.type==='percent'?'number':field.type==='date'?'date':'text'} step="any" maxLength={400} value={field.value} onChange={e=>updateField(field.id,{value:e.target.value})}/></label>}
      {field.type==='number'&&<><label>Старт<input type="number" step="any" value={field.start||''} onChange={e=>updateField(field.id,{start:e.target.value})}/></label>
       <label>Цель<input type="number" step="any" value={field.target||''} onChange={e=>updateField(field.id,{target:e.target.value})}/></label><label>Ед.<input maxLength={30} value={field.unit||''} placeholder="₽, кг, км" onChange={e=>updateField(field.id,{unit:e.target.value})}/></label></>}
     </div>
     <div className="goal-field-footer"><span>{goalFieldProgress(field)===null?'Без расчёта прогресса':'Прогресс: '+goalFieldProgress(field)+'%'}</span>
      <label className="goal-feature-label"><input type="checkbox" checked={!!field.featured} disabled={!field.featured&&featured.length>=2} onChange={e=>updateField(field.id,{featured:e.target.checked})}/> Показывать на карточке</label>
     </div>
    </div>)}</div>
    <div className="goal-fields-actions"><button type="button" className="btn outline" disabled={doc.fields.length>=24} onClick={()=>setDoc(d=>({...d,fields:[...d.fields,newField()]}))}><Icon name="plus" size={16}/> Добавить показатель</button>
     <span className="tiny-note">{featured.length} из 2 ключевых показателей</span></div>
    <label className="goal-notes-label">Описание и заметки<textarea rows={4} value={doc.body} maxLength={3500} onChange={e=>setDoc(d=>({...d,body:e.target.value}))} placeholder="Зачем нужна эта цель? Какой результат будет считаться успехом?"/></label>

     <label className="goal-notes-label">Описание и заметки<textarea rows={4} value={doc.body} maxLength={3500} onChange={e=>setDoc(d=>({...d,body:e.target.value}))} placeholder="Зачем нужна эта цель? Как понять, что результат достигнут?"/></label>
     <div className="goal-panel-actions"><button className="btn accent" disabled={busy} onClick={()=>void saveDoc(doc)}>{busy?'Сохраняем…':'Сохранить изменения'}</button>
      <button type="button" className="btn outline" disabled={busy} onClick={cancelEditing}>Отмена</button></div>
    </>}
    {!editingFields&&<div className="goal-description-preview"><span className="eyebrow">ЗАМЕТКИ</span><p>{doc.body||'Здесь можно записать смысл цели и важный контекст.'}</p>
      <button type="button" onClick={()=>startEditing()} className="goal-note-edit"><Icon name="edit" size={15}/> Изменить заметки</button></div>}
    {!editingFields&&<div className="goal-panel-actions goal-panel-actions--close"><button className={'btn '+(closed?'outline':'subtle')} disabled={busy} onClick={complete}>{closed?'Вернуть в активные':'Закрыть цель'}</button></div>}
   </Card>
  </div>}
  {tab==='tasks'&&<div className="goal-detail-panels">
   <Card className="goal-tasks-panel">
    <SectionHead title="Задачи цели" caption="Добавляй и выполняй задачи, не создавая отдельный список-копию"/>
    <div className="goal-task-summary"><strong>{counts.done} / {counts.total}</strong><span>выполнено</span><ProgressBar value={counts.total?Math.round(counts.done/counts.total*100):0}/></div>
    {linkError&&<p role="alert" className="os-error-banner">{linkError}</p>}
    {linkLoading&&<p className="tiny-note" role="status">Загружаем связи задач…</p>}
    <p className="goal-task-hint">Отметка выполнения задачи из Буфера автоматически переносит её в «Сегодня», сохраняя цель, категорию и заметки.</p>
    <div className="goal-task-rows">{linked.length?linked.map(t=><div key={t.id} className="goal-task-row">
     <input type="checkbox" aria-label={'Выполнить: '+t.title} checked={t.completed} disabled={taskSaving} onChange={()=>void toggleDone(t)}/>
     <button className={'goal-task-open '+(t.completed?'completed':'')} onClick={()=>void app.openTaskPage(t)}>{t.title}</button>
     <button className="goal-task-unlink" title="Отвязать от цели" aria-label={'Отвязать '+t.title} disabled={taskSaving} onClick={()=>void linkTask(t,true)}><Icon name="x" size={16}/></button>
    </div>):<p className="tiny-note">Пока нет задач. Добавь первое действие ниже.</p>}</div>
    {missing>0&&<p className="tiny-note">Ещё {missing} задач вне отображаемого периода. Полный счётчик учитывает связи на сервере.</p>}
    <form className="goal-task-create" onSubmit={e=>void createTask(e)}><label>Новая задача в Буфере<input value={taskDraft} onChange={e=>setTaskDraft(e.target.value)} placeholder="Что нужно сделать для цели?" maxLength={180}/></label>
     <button className="btn accent" type="submit" disabled={!taskDraft.trim()||taskSaving}><Icon name="plus" size={16}/>{draftId?'Повторить привязку':'Создать и привязать'}</button></form>
    <div className="goal-task-link"><label>Или привязать существующую задачу<select value={linkExisting} onChange={e=>setLinkExisting(e.target.value)}><option value="">Выбери задачу…</option>{unfound.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
     <button className="btn outline" type="button" disabled={!linkExisting||taskSaving} onClick={()=>{const t=allTasks.find(x=>x.id===linkExisting);if(t)void linkTask(t)}}>Привязать</button></div>
   </Card>
  </div>}
  {tab==='analytics'&&<div className="goal-analytics-grid">
    <Card><span className="eyebrow">ВРЕМЯ</span><h2>{duration!==null?duration+' дней':'Нет данных'}</h2><p className="tiny-note">{closed?'До закрытия цели':'Прошло с создания'}</p></Card>
    <Card><span className="eyebrow">ЗАДАЧИ</span><h2>{counts.done} / {counts.total}</h2><ProgressBar value={counts.total?Math.round(counts.done/counts.total*100):0}/><p className="tiny-note">{missing?'Часть связанных задач вне загруженного периода':'Выполнение связанных задач'}</p></Card>
    <Card><span className="eyebrow">ПОКАЗАТЕЛИ</span><h2>{measured.length} измеримых</h2><p className="tiny-note">{metric===null?'Ещё нет измеримого показателя':'Средний прогресс: '+metric+'%'}</p></Card>
    <Card className="goal-analytics-details"><SectionHead title="Аналитика показателей" caption="Только реальные текущие данные, без выдуманной истории"/>
     {doc.fields.length?doc.fields.map(f=><div className="goal-analysis-field" key={f.id}><span>{f.label||'Без названия'}</span><strong>{formatGoalField(f)}</strong>{goalFieldProgress(f)!==null&&<ProgressBar value={goalFieldProgress(f)||0}/>}</div>):<p className="tiny-note">Добавь показатели на вкладке «Обзор».</p>}
     {kind==='strategic'?(()=>{
      const history=app.goalHistory.filter(x=>x.goal_id===goal.id).sort((a,b)=>a.recorded_at.localeCompare(b.recorded_at));
      return history.length>=2?<div className="goal-analysis-history"><SectionHead title="История основной величины" caption={history.length+' реальных записей'}/><Sparkline values={history.map(x=>Number(x.value))}/></div>
       :<p className="tiny-note">История изменения основного показателя появится после нескольких сохранений.</p>;
     })():<p className="tiny-note">Для этой цели исторические замеры пока не записываются. Доступен текущий снимок.</p>}
    </Card>
  </div>}
  {editOverlay}
 </div>;
}
