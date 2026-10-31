import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {useApp} from '../AppContext';
import {Icon} from '../components/Icons';
import {WorkspaceDatabase} from '../components/WorkspaceDatabase';
import {SplitPipeline} from '../components/WorkspacePipeline';
import {WPage,WBlock,WSource,WPageResponse,BlockType,workspaceRequest,pageLink,taskPipelineProperties} from '../lib/workspace';
import {request} from '../lib/api';
import type {Task} from '../types';
import {TaskIncomeEditor} from '../components/TaskIncome';
import {TaskPropertyAppearance,DEFAULT_NATIVE_PROPERTIES,type PropertyAppearance} from '../components/TaskPropertyAppearance';
import {TaskCustomProperties} from '../components/TaskCustomProperties';
import {useRegularGoals} from '../components/RegularGoals';
import './workspace.css';

const icons=['📋','📄','📁','🎯','💼','🧠','📝','🚀','🏡','💰','📚','⚡'];
const blockLabels:Record<BlockType,string>={text:'Текст',heading:'Заголовок',checklist:'Чеклист',image:'Изображение',divider:'Разделитель',database:'База данных',pipeline:'Pipeline',page_link:'Ссылка на страницу'};
const uuidRoute=()=>{const match=window.location.hash.match(/^#\/page\/([0-9a-f-]{36})$/i);return match?.[1]||null};
export function WorkspacePage({embedded=false}:{embedded?:boolean}){
 const {demo}=useApp(),[pages,setPages]=useState<WPage[]>([]),[sources,setSources]=useState<WSource[]>([]);
 const [selectedId,setSelectedId]=useState<string|null>(uuidRoute),[details,setDetails]=useState<WPageResponse|null>(null),[loading,setLoading]=useState(true);
 const [error,setError]=useState(''),[recordPageIds,setRecordPageIds]=useState<string[]>([]),[newTitle,setNewTitle]=useState(''),[working,setWorking]=useState(false),[taskData,setTaskData]=useState<Task|null>(null);
 const pageRequest=useRef(0);
 const openPage=useCallback((id:string)=>{window.location.hash=pageLink(id);window.scrollTo({top:0,behavior:'smooth'})},[]);
 const home=()=>{window.location.hash='#/tab/buffer'};
 const loadList=useCallback(async()=>{if(demo){setLoading(false);return}try{const [data,taskPages,archives]=await Promise.all([workspaceRequest<{pages:WPage[];sources:WSource[];recordPageIds:string[]}>('bootstrap'),request<{pageIds:string[]}>('os8','task_page_links'),request<{pageIds:string[]}>('os9','archived_pages').catch((): {pageIds:string[]}=>({pageIds:[]}))]);setPages((data.pages||[]).filter(page=>!archives.pageIds.includes(page.id)));setSources(data.sources||[]);setRecordPageIds([...new Set([...(data.recordPageIds||[]),...(taskPages.pageIds||[])])]);setError('')}catch(e:any){setError(e.message||'Ошибка загрузки страниц')}finally{setLoading(false)}},[demo]);
 const loadPage=useCallback(async(id:string)=>{if(demo)return;const version=++pageRequest.current;setWorking(true);setError('');try{const [data,linked]=await Promise.all([workspaceRequest<WPageResponse>('page_get',{id}),request<{task:Task|null}>('os8','task_page_find',{pageId:id})]);if(version!==pageRequest.current)return;setDetails(data);setTaskData(linked.task||null);setError('')}catch(e:any){if(version!==pageRequest.current)return;setError(e.message||'Страница не загрузилась');setDetails(null);setTaskData(null)}finally{if(version===pageRequest.current)setWorking(false)}},[demo]);
 const refresh=useCallback(async()=>{await loadList();if(selectedId)await loadPage(selectedId)},[loadList,loadPage,selectedId]);
 useEffect(()=>{const change=()=>{pageRequest.current++;setDetails(null);setTaskData(null);setSelectedId(uuidRoute())};window.addEventListener('hashchange',change);return()=>{window.removeEventListener('hashchange',change);pageRequest.current++}},[]);
 useEffect(()=>{void loadList()},[loadList]);
 useEffect(()=>{if(selectedId)void loadPage(selectedId);else setDetails(null)},[selectedId,loadPage]);
 const run=async(action:string,data:Record<string,unknown>)=>{try{
   if(action==='page_save'&&taskData&&data.id===details?.page.id){
     await request('os8','task_page_title',{pageId:data.id,title:data.title});return workspaceRequest<any>(action,data);
   }return await workspaceRequest<any>(action,data);
  }catch(e:any){setError(e.message||'Изменение не сохранилось');throw e}};
 const createPage=async(title:string,parentId:string|null=null)=>{if(!title.trim())return;setWorking(true);try{const res=await run('page_save',{title,parentId});await loadList();openPage(res.id);setNewTitle('');return res.id}finally{setWorking(false)}};
 const deletePage=async(page:WPage)=>{if(taskData&&page.id===details?.page.id){setError('Это страница задачи: удаляй задачу через её меню, чтобы не потерять свойства.');return;}if(!window.confirm(`Удалить страницу «${page.title}» вместе со всеми вложенными блоками?`))return;await run('page_delete',{id:page.id});home();await loadList()};
 const parents=useMemo(()=>{const out:WPage[]=[];let at=details?.page.parent_id||null;for(let i=0;at&&i<50;i++){const p=pages.find(x=>x.id===at);if(!p)break;out.unshift(p);at=p.parent_id}return out},[details,pages]);
 return <div className="os-workspace">
  {error&&<div role="alert" className="os-error-banner">{error}<button onClick={()=>void refresh()}>Повторить</button></div>}
  <div className="os-task-page-only">
   <div className="os-page-editor-navigation"><button className="os-back-to-buffer" type="button" onClick={home}><Icon name="left" size={18}/> Назад в буфер задач</button>
    {selectedId&&<div className="os-breadcrumbs"><span>Буфер задач</span>{parents.map(p=><React.Fragment key={p.id}><span>/</span><button onClick={()=>openPage(p.id)}>{p.title}</button></React.Fragment>)}</div>}
   </div>
   {!selectedId?<p className="os-muted">Эта страница больше не используется. <button type="button" className="os-btn" onClick={home}>Открыть Буфер</button></p>
   :working&&!details?<p className="os-muted" role="status">Открываем задачу…</p>
   :!details?<div className="os-empty" role="status">{error?<>Не удалось загрузить задачу. <button className="os-btn" type="button" onClick={()=>void refresh()}>Повторить</button></>:'Загрузка…'}</div>
   :<div className="os-page-editor" key={details.page.id}><PageContents data={details} taskData={taskData} pages={pages} sources={sources} onOpen={openPage} onAddPage={createPage} onDeletePage={deletePage} write={run} refresh={refresh}/></div>}
  </div>
 </div>;
}
type Contents={data:WPageResponse;taskData:Task|null;pages:WPage[];sources:WSource[];onOpen:(id:string)=>void;onAddPage:(title:string,parentId:string|null)=>Promise<any>;onDeletePage:(p:WPage)=>Promise<void>;write:(action:string,body:Record<string,unknown>)=>Promise<any>;refresh:()=>Promise<void>};
function PageContents({data,taskData,pages,sources,onOpen,onAddPage,onDeletePage,write,refresh}:Contents){
 const {page,blocks}=data,[title,setTitle]=useState(page.title),[icon,setIcon]=useState(page.icon),[type,setType]=useState<BlockType>('text');
 const [sourceId,setSourceId]=useState(sources[0]?.id||''),[sourceName,setSourceName]=useState(''),[linkId,setLinkId]=useState('');
 const [adding,setAdding]=useState(false);const [blockMenu,setBlockMenu]=useState<string|null>(null);const [blockDrag,setBlockDrag]=useState<string|null>(null);
 const blockGesture=useRef<{id:string;startX:number;startY:number;active:boolean;target:string|null;timer:number|null}|null>(null);
 const [blockHover,setBlockHover]=useState<string|null>(null);
 const blockSkipClick=useRef(false);
 const cancelBlockGesture=()=>{const g=blockGesture.current;if(g?.timer)window.clearTimeout(g.timer);blockGesture.current=null;setBlockDrag(null);setBlockHover(null)};
 useEffect(()=>()=>{if(blockGesture.current?.timer)window.clearTimeout(blockGesture.current.timer)},[]);

 const [focusChecklistId,setFocusChecklistId]=useState<string|null>(null);
 useEffect(()=>{if(!focusChecklistId||!blocks.some(b=>b.id===focusChecklistId))return;
   const frame=requestAnimationFrame(()=>{document.querySelector<HTMLInputElement>(`[data-checklist-id="${focusChecklistId}"]`)?.focus();setFocusChecklistId(null)});
   return()=>cancelAnimationFrame(frame);
 },[focusChecklistId,blocks]);
 const appendChecklist=async(afterId:string)=>{
   const created=await write('block_save',{pageId:page.id,type:'checklist',content:{text:'',checked:false}});
   const ids=blocks.map(b=>b.id);const index=ids.indexOf(afterId);ids.splice(index<0?ids.length:index+1,0,created.id);
   try{await write('block_reorder',{pageId:page.id,ids})}finally{setFocusChecklistId(created.id);await refresh()}
 };
 const savePage=async(nextTitle=title,nextIcon=icon)=>{if(!nextTitle.trim())return;await write('page_save',{id:page.id,title:nextTitle,icon:nextIcon,parentId:page.parent_id});await refresh()};
 const addBlock=async(kind:BlockType)=>{
   let content:Record<string,unknown>={};if(kind==='text'||kind==='heading'||kind==='checklist')content={text:'',checked:false};
   if(kind==='pipeline')content={title:'План выполнения'};
   if(kind==='database'){
    let sid=sourceId;if(!sid){if(!sourceName.trim())return;const newSource=await write('source_save',{name:sourceName});sid=newSource.id;}
    content={sourceId:sid};
   }
   if(kind==='page_link'){if(!linkId)return;content={pageId:linkId};}
   await write('block_save',{pageId:page.id,type:kind,content});setAdding(false);await refresh();
 };
 const moveBlock=async(id:string,target:string)=>{if(id===target)return;const ids=blocks.map(x=>x.id);const a=ids.indexOf(id),b=ids.indexOf(target);if(a<0||b<0)return;ids.splice(a,1);ids.splice(b,0,id);await write('block_reorder',{pageId:page.id,ids});await refresh()};
  const blockOrder=async(id:string,delta:number)=>{const ids=blocks.map(x=>x.id),i=ids.indexOf(id),j=i+delta;if(j<0||j>=ids.length)return;[ids[i],ids[j]]=[ids[j],ids[i]];await write('block_reorder',{pageId:page.id,ids});await refresh()};

 const blockPointerDown=(e:React.PointerEvent<HTMLButtonElement>,id:string)=>{
  if(e.pointerType!=='touch')return;
  const g={id,startX:e.clientX,startY:e.clientY,active:false,target:null as string|null,timer:null as number|null};
  g.timer=window.setTimeout(()=>{g.active=true;setBlockDrag(id)},240);
  blockGesture.current=g;
  try{e.currentTarget.setPointerCapture(e.pointerId)}catch{/* browser may deny capture */}
 };
 const blockPointerMove=(e:React.PointerEvent<HTMLButtonElement>)=>{
  const g=blockGesture.current;if(!g)return;
  if(!g.active){if(Math.abs(e.clientY-g.startY)>10||Math.abs(e.clientX-g.startX)>10)cancelBlockGesture();return}
  const el=document.elementFromPoint(e.clientX,e.clientY) as HTMLElement|null;
  g.target=el?.closest<HTMLElement>('[data-block-id]')?.dataset.blockId||null;
  setBlockHover(g.target);
 };
 const blockPointerUp=()=>{
  const g=blockGesture.current;
  if(!g){return}
  const done=g.active,target=g.target,id=g.id;
  if(done){blockSkipClick.current=true;if(target&&target!==id)void moveBlock(id,target)}
  cancelBlockGesture();
 };
 const sub=pages.filter(x=>x.parent_id===page.id);
 return <>
   <div className="os-page-toolbar"><div className="os-icon-pick"><select aria-label="Иконка страницы" value={icon} onChange={e=>{setIcon(e.target.value);void savePage(title,e.target.value)}}>{!icons.includes(icon)&&<option value={icon}>{icon}</option>}{icons.map(i=><option key={i} value={i}>{i}</option>)}</select></div><button className="os-icon os-danger" onClick={()=>void onDeletePage(page)} title="Удалить страницу"><Icon name="trash" size={17}/></button></div>
   <input className="os-page-heading" aria-label="Название страницы" value={title} maxLength={180} onChange={e=>setTitle(e.target.value)} onBlur={()=>{if(title.trim()!==page.title)void savePage()}} onKeyDown={e=>{if(e.key==='Enter')(e.target as HTMLInputElement).blur()}}/>
   {data.record&&<div className="os-info">Это запись базы данных. Редактируй её поля в представлении базы; здесь можно добавлять любые блоки.</div>}
   {taskData&&<><TaskPageProperties key={taskData.id} task={taskData} pageTitle={title} onSaved={refresh} pipelineProperties={taskPipelineProperties(data)}/>{/работ|бизнес|фриланс|клиент|продаж/i.test(taskData.sphere||'')&&<TaskIncomeEditor taskId={taskData.id}/>}</>}
   <div className="os-blocks">{blocks.map(block=><div className={'os-block-shell '+(blockDrag===block.id?'is-block-dragging':'')+(blockHover===block.id&&blockDrag!==block.id?' os-block-hover':'')} key={block.id} data-block-id={block.id} onDragOver={e=>{if(blockDrag)e.preventDefault()}} onDrop={e=>{e.preventDefault();if(blockDrag){void moveBlock(blockDrag,block.id);setBlockDrag(null)}}}>
 <div className="os-block-control"><button type="button" className="os-block-grip" draggable title="Перетащить блок" aria-label="Переместить блок" onDragStart={e=>{e.dataTransfer.effectAllowed='move';setBlockDrag(block.id)}} onDragEnd={()=>setBlockDrag(null)} onPointerDown={e=>blockPointerDown(e,block.id)} onPointerMove={blockPointerMove} onPointerUp={blockPointerUp} onPointerCancel={cancelBlockGesture} onClick={()=>{if(blockSkipClick.current){blockSkipClick.current=false;return}setBlockMenu(v=>v===block.id?null:block.id)}}><span className="os-four-dot-icon" aria-hidden="true"><i/><i/><i/><i/></span></button>
 {blockMenu===block.id&&<div className="os-block-context"><button type="button" onClick={()=>{setBlockMenu(null);void blockOrder(block.id,-1)}}>Выше</button><button type="button" onClick={()=>{setBlockMenu(null);void blockOrder(block.id,1)}}>Ниже</button><button type="button" className="danger" onClick={()=>{setBlockMenu(null);if(window.confirm('Удалить блок?'))void write('block_delete',{id:block.id}).then(refresh)}}>Удалить блок</button></div>}</div>
 <PageBlock block={block} onAppendChecklist={appendChecklist} pages={pages} sources={sources} data={data} openPage={onOpen} write={write} refresh={refresh}/>
 </div>)}</div>
 <div className="os-new-block"><button className="os-add-block-mini" aria-label="Добавить блок" title="Добавить блок" onClick={()=>setAdding(v=>!v)}><Icon name="plus" size={17}/></button>{adding&&<div className="os-block-picker"><div className="os-block-picker-grid">{Object.entries(blockLabels).map(([k,v])=><button key={k} className={type===k?'active':''} onClick={()=>setType(k as BlockType)}>{v}</button>)}</div>
     {type==='database'&&<div className="os-block-options"><label>Существующая база <select value={sourceId} onChange={e=>setSourceId(e.target.value)}><option value="">Создать новую</option>{sources.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>{!sourceId&&<input placeholder="Название новой базы" value={sourceName} onChange={e=>setSourceName(e.target.value)}/>}</div>}
     {type==='page_link'&&<div className="os-block-options"><select value={linkId} onChange={e=>setLinkId(e.target.value)}><option value="">Выбери страницу</option>{pages.filter(p=>p.id!==page.id).map(p=><option key={p.id} value={p.id}>{p.icon} {p.title}</option>)}</select></div>}
     <button className="os-btn os-btn-primary" disabled={(type==='database'&&!sourceId&&!sourceName.trim())||(type==='page_link'&&!linkId)} onClick={()=>void addBlock(type)}>Вставить {blockLabels[type].toLowerCase()}</button>
    </div>}</div>
   <section className="os-children"><div className="os-section-title"><h3>Вложенные страницы</h3><button className="os-btn" onClick={()=>void onAddPage('Новая страница',page.id)}>+ Страница</button></div>{sub.length>0&&<div className="os-children-grid">{sub.map(p=><button key={p.id} onClick={()=>onOpen(p.id)}><span>{p.icon}</span>{p.title}<Icon name="right" size={16}/></button>)}</div>}</section>
 </>;
}
function PageBlock({block,onAppendChecklist,pages,sources,data,openPage,write,refresh}:{block:WBlock;onAppendChecklist:(id:string)=>Promise<void>;pages:WPage[];sources:WSource[];data:WPageResponse;openPage:(id:string)=>void;write:(a:string,b:Record<string,unknown>)=>Promise<any>;refresh:()=>Promise<void>}){
 const [value,setValue]=useState(String(block.content.text||'')),[url,setUrl]=useState(String(block.content.url||''));
 const [saveStatus,setSaveStatus]=useState<'saved'|'typing'|'saving'|'error'>('saved');
 const lastSaved=useRef(String(block.content.text||''));const serial=useRef<Promise<void>>(Promise.resolve());
 const [appending,setAppending]=useState(false);const appendingRef=useRef(false);
 const save=(content:Record<string,unknown>)=>write('block_save',{id:block.id,pageId:block.page_id,type:block.type,content});
 const commit=()=>{const next=value;if(next===lastSaved.current)return;setSaveStatus('saving');
   serial.current=serial.current.then(()=>save({...block.content,text:next}).then(()=>{lastSaved.current=next;setSaveStatus('saved')})).catch(()=>setSaveStatus('error'));
 };
 useEffect(()=>{if(block.type==='divider'||block.type==='database'||block.type==='pipeline'||block.type==='page_link'||block.type==='image')return;
  if(value===lastSaved.current)return;
  setSaveStatus('typing');const timer=window.setTimeout(()=>commit(),900);return()=>window.clearTimeout(timer);
 // The draft is saved 900ms after typing pauses. Explicit blur saves immediately.
 },[value]);
 if(block.type==='divider')return <hr className="os-divider"/>;
 if(block.type==='pipeline')return <SplitPipeline blockId={block.id}initialSplits={data.splits}initialItems={data.items}write={write}reload={refresh}/>;
 if(block.type==='database')return <WorkspaceDatabase sourceId={block.content.sourceId}sources={sources}openPage={openPage}/>;
 if(block.type==='page_link'){const p=pages.find(x=>x.id===block.content.pageId);return <button className="os-page-link" onClick={()=>openPage(block.content.pageId)}>{p?.icon||'📄'} {p?.title||'Страница'} <Icon name="right" size={15}/></button>}
 if(block.type==='image')return <div className="os-image-block"><input className="os-input" placeholder="HTTPS-ссылка на изображение" aria-label="URL изображения" value={url} onChange={e=>setUrl(e.target.value)} onBlur={()=>{if(url!==block.content.url)void save({url,alt:block.content.alt||''})}}/>{/^https:\/\//i.test(url)&&<img loading="lazy" src={url} alt={block.content.alt||'Изображение страницы'}/>}</div>;
 if(block.type==='checklist')return <div className="os-check-block"><input type="checkbox" checked={block.content.checked===true} onChange={e=>void save({...block.content,text:value,checked:e.target.checked}).then(refresh).catch(()=>setSaveStatus('error'))} aria-label="Выполнено"/><input data-checklist-id={block.id} className={block.content.checked?'done':''} placeholder="Пункт чеклиста" aria-label="Пункт чеклиста" value={value} onChange={e=>setValue(e.target.value)} onBlur={()=>{if(value!==lastSaved.current&&!appendingRef.current)commit()}} onKeyDown={e=>{if(e.key!=='Enter'||e.shiftKey||e.nativeEvent.isComposing)return;e.preventDefault();if(!value.trim()||appendingRef.current)return;appendingRef.current=true;setAppending(true);void (async()=>{try{await save({...block.content,text:value});lastSaved.current=value;setSaveStatus('saved');await onAppendChecklist(block.id)}catch{setSaveStatus('error')}finally{appendingRef.current=false;setAppending(false)}})()}}/>{appending&&<span className="os-check-saving" role="status">…</span>}{saveStatus==='error'&&<button type="button" className="os-check-retry" onClick={()=>commit()}>Повторить</button>}</div>;
 return <div className="os-autosave-block"><textarea rows={block.type==='heading'?1:Math.max(2,Math.min(8,value.split('\n').length))} className={'os-block-text '+(block.type==='heading'?'os-block-h':'')} aria-label={block.type==='heading'?'Заголовок':'Текстовый блок'} placeholder={block.type==='heading'?'Заголовок':'Напиши что-нибудь…'} value={value} onChange={e=>setValue(e.target.value)} onBlur={()=>commit()} onKeyDown={e=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){e.preventDefault();commit()}}}/>
  {saveStatus!=='saved'&&<div className={'os-autosave-status '+saveStatus} role={saveStatus==='error'?'alert':'status'}>{saveStatus==='typing'?'Есть изменения…':saveStatus==='saving'?'Сохраняется…':<><span>Не сохранилось</span><button onClick={()=>commit()} type="button">Повторить</button></>}</div>}
 </div>;
}
function TaskPageProperties({task,onSaved,pipelineProperties}:{task:Task;pageTitle:string;onSaved:()=>Promise<void>;pipelineProperties:ReturnType<typeof taskPipelineProperties>}){
 const {categories,saveCategory,goals,os6}=useApp();const {goals:regularGoals}=useRegularGoals();
 const [day,setDay]=useState(task.day||''),[priority,setPriority]=useState<'important'|'extra'>(task.priority);
 const [categoryId,setCategoryId]=useState(task.os61_category_id||categories.find(c=>c.name===task.sphere)?.id||'');
 const [notes,setNotes]=useState(task.notes||''),[categoryOpen,setCategoryOpen]=useState(false),[addingCategory,setAddingCategory]=useState(false),[categoryName,setCategoryName]=useState(''),[categoryBusy,setCategoryBusy]=useState(false);
 const link=os6.links.find(x=>x.task_id===task.id)?.goal_id||'';
 const [goalId,setGoalId]=useState(link?'amb:'+link:'');
 const [appearance,setAppearance]=useState<Record<string,PropertyAppearance>>(DEFAULT_NATIVE_PROPERTIES);
 const [status,setStatus]=useState<'idle'|'saving'|'saved'|'error'>('idle'),[error,setError]=useState('');
 const [lastFailed,setLastFailed]=useState<{key:string;value:any;kind?:string}|null>(null);
 const queue=useRef<Promise<void>>(Promise.resolve()),pending=useRef(0),notesTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const notesCurrent=useRef(notes),notesSent=useRef(task.notes||'');
 const names=(key:string)=>appearance[key]||DEFAULT_NATIVE_PROPERTIES[key];
 useEffect(()=>{let active=true;request<{fields:Record<string,PropertyAppearance>}>('os8','task_native_fields').then(r=>{if(active)setAppearance({...DEFAULT_NATIVE_PROPERTIES,...r.fields})}).catch(e=>{if(active)setError(e.message||'Не удалось загрузить настройки свойств')});return()=>{active=false}},[task.id]);
 useEffect(()=>{let active=true;void request<{goalId:string|null}>('os9','regular_goal_get',{taskId:task.id}).then(r=>{if(active&&r.goalId)setGoalId('reg:'+r.goalId)}).catch(()=>{});return()=>{active=false}},[task.id]);
 const saveField=(key:string,value:any,kind?:string)=>{
  const patch={key,value,kind};pending.current+=1;setStatus('saving');setError('');
  queue.current=queue.current.catch(()=>{}).then(async()=>{
   await request('os8','task_native_patch',{taskId:task.id,...patch});
   if(key==='notes')notesSent.current=String(value);
   if(key==='goal')window.dispatchEvent(new Event('os8:goals-changed'));
   await onSaved();
  }).then(()=>{pending.current=Math.max(0,pending.current-1);if(pending.current===0){setStatus('saved');setLastFailed(null)}})
   .catch((e:any)=>{pending.current=Math.max(0,pending.current-1);setStatus('error');setError(e.message||'Не удалось сохранить изменение');setLastFailed(patch)});
 };
 const flushNotes=()=>{if(notesTimer.current){clearTimeout(notesTimer.current);notesTimer.current=null}if(notesCurrent.current!==notesSent.current)saveField('notes',notesCurrent.current)};
 const onNotesChange=(text:string)=>{setNotes(text);notesCurrent.current=text;if(notesTimer.current)clearTimeout(notesTimer.current);notesTimer.current=setTimeout(flushNotes,750)};
 useEffect(()=>()=>{if(notesTimer.current)clearTimeout(notesTimer.current);if(notesCurrent.current!==notesSent.current){const latest=notesCurrent.current;queue.current=queue.current.catch(()=>{}).then(async()=>{await request('os8','task_native_patch',{taskId:task.id,key:'notes',value:latest})}).catch(()=>{})}},[task.id]);
 const chooseCategory=(id:string)=>{setCategoryId(id);setCategoryOpen(false);setAddingCategory(false);saveField('category',id||null)};
 const createCategory=async(e:React.FormEvent)=>{e.preventDefault();if(!categoryName.trim()||categoryBusy)return;setCategoryBusy(true);setError('');
  try{const res=await saveCategory({name:categoryName.trim(),color:'#8B84ED',icon:'folder'});const id=String((res as any)?.id||'');if(!id)throw new Error('Категория создана, но не получен ID. Открой список повторно.');chooseCategory(id);setCategoryName('')}
  catch(e:any){setError(e.message||'Не удалось добавить категорию')}
  finally{setCategoryBusy(false)}
 };
 const changeAppearance=(key:string,name:string,icon:string)=>setAppearance(old=>({...old,[key]:{name,icon}}));
 return <section className="os-task-properties os-properties-v67" aria-label="Свойства задачи">
  <div className="os-property-head"><h3>Свойства задачи</h3>{status!=='idle'&&<small role={status==='error'?'alert':'status'} className={'os-auto-status '+status}>{status==='saving'?'Сохраняется…':status==='saved'?'Сохранено':'Не удалось сохранить'}</small>}</div>
  <div className="os-property-rows">
   <div className="os-property-row"><TaskPropertyAppearance fieldKey="category" {...names('category')} onChange={(name,icon)=>changeAppearance('category',name,icon)}/>
    <div className="os-category-control" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setCategoryOpen(false)}}>
     <button type="button" className="os-category-trigger" aria-label="Выбрать категорию" aria-expanded={categoryOpen} onClick={()=>setCategoryOpen(v=>!v)}>{categories.find(c=>c.id===categoryId)?.name||'Без категории'} <Icon name="down" size={15}/></button>
     {categoryOpen&&<div className="os-category-menu">
      <button type="button" onClick={()=>chooseCategory('')}>Без категории</button>
      {categories.map(c=><button type="button" key={c.id} onClick={()=>chooseCategory(c.id)}><span className="os-category-swatch" style={{background:c.color}}/>{c.name}</button>)}
      <div className="os-category-menu-divider"/>
      {!addingCategory?<button type="button" className="os-category-add" onClick={()=>setAddingCategory(true)}><Icon name="plus" size={15}/> Добавить категорию</button>
      :<form className="os-category-create" onSubmit={e=>void createCategory(e)}><input autoFocus aria-label="Название новой категории" value={categoryName} maxLength={60} onChange={e=>setCategoryName(e.target.value)} placeholder="Новая категория"/><div><button type="submit" disabled={!categoryName.trim()||categoryBusy}>Создать</button><button type="button" onClick={()=>setAddingCategory(false)}>Отмена</button></div></form>}
     </div>}
    </div>
   </div>
   <div className="os-property-row"><TaskPropertyAppearance fieldKey="priority" {...names('priority')} onChange={(name,icon)=>changeAppearance('priority',name,icon)}/><select aria-label={names('priority').name} value={priority} onChange={e=>{const v=e.target.value as 'important'|'extra';setPriority(v);saveField('priority',v)}}><option value="important">Важная</option><option value="extra">Дополнительная</option></select></div>
   <div className="os-property-row"><TaskPropertyAppearance fieldKey="day" {...names('day')} onChange={(name,icon)=>changeAppearance('day',name,icon)}/><div className="os-property-value"><input aria-label={names('day').name} type="date" value={day} onChange={e=>{const v=e.target.value;setDay(v);saveField('day',v||null)}}/>{day&&<button type="button" className="os-property-clear" onClick={()=>{setDay('');saveField('day',null)}}>В буфер</button>}</div></div>
   <div className="os-property-row"><TaskPropertyAppearance fieldKey="goal" {...names('goal')} onChange={(name,icon)=>changeAppearance('goal',name,icon)}/><select aria-label={names('goal').name} value={goalId} onChange={e=>{const v=e.target.value;setGoalId(v);saveField('goal',v?v.slice(4):null,v.startsWith('amb:')?'strategic':v.startsWith('reg:')?'regular':'none')}}><option value="">Без цели</option><optgroup label="Обычные цели">{regularGoals.map(g=><option key={g.id} value={'reg:'+g.id}>{g.title}</option>)}</optgroup><optgroup label="Амбициозные цели">{goals.map(g=><option key={g.id} value={'amb:'+g.id}>{g.title}</option>)}</optgroup></select></div>
   <div className="os-property-row os-property-row-long"><TaskPropertyAppearance fieldKey="notes" {...names('notes')} onChange={(name,icon)=>changeAppearance('notes',name,icon)}/><textarea aria-label={names('notes').name} value={notes} rows={2} maxLength={6000} onChange={e=>onNotesChange(e.target.value)} onBlur={flushNotes} placeholder="Контекст и ссылки…"/></div>
  </div>
  <TaskCustomProperties taskId={task.id} pipelineProperties={pipelineProperties} progressAppearance={names('progress')} onProgressAppearance={(name,icon)=>changeAppearance('progress',name,icon)}/>
  {error&&<div className="os-inline-error" role="alert">{error}{lastFailed&&<button type="button" onClick={()=>saveField(lastFailed.key,lastFailed.value,lastFailed.kind)}>Повторить</button>}</div>}
 </section>;
}
