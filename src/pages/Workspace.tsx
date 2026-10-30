import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {useApp} from '../AppContext';
import {Icon} from '../components/Icons';
import {WorkspaceDatabase} from '../components/WorkspaceDatabase';
import {SplitPipeline} from '../components/WorkspacePipeline';
import {WPage,WBlock,WSource,WPageResponse,BlockType,workspaceRequest,pageLink} from '../lib/workspace';
import {request} from '../lib/api';
import type {Task} from '../types';
import {TaskIncomeEditor} from '../components/TaskIncome';
import {QuickCategory} from '../components/QuickCategory';
import {useRegularGoals} from '../components/RegularGoals';
import './workspace.css';

const icons=['📄','📁','🎯','💼','🧠','📝','🚀','🏡','💰','📚','⚡'];
const blockLabels:Record<BlockType,string>={text:'Текст',heading:'Заголовок',checklist:'Чеклист',image:'Изображение',divider:'Разделитель',database:'База данных',pipeline:'Pipeline',page_link:'Ссылка на страницу'};
const uuidRoute=()=>{const match=window.location.hash.match(/^#\/page\/([0-9a-f-]{36})$/i);return match?.[1]||null};
export function WorkspacePage({embedded=false}:{embedded?:boolean}){
 const {demo}=useApp(),[pages,setPages]=useState<WPage[]>([]),[sources,setSources]=useState<WSource[]>([]);
 const [selectedId,setSelectedId]=useState<string|null>(uuidRoute),[details,setDetails]=useState<WPageResponse|null>(null),[loading,setLoading]=useState(true);
 const [error,setError]=useState(''),[recordPageIds,setRecordPageIds]=useState<string[]>([]),[newTitle,setNewTitle]=useState(''),[working,setWorking]=useState(false),[taskData,setTaskData]=useState<Task|null>(null);
 const openPage=useCallback((id:string)=>{setDetails(null);window.location.hash=pageLink(id);setSelectedId(id);window.scrollTo({top:0,behavior:'smooth'})},[]);
 const home=()=>{window.location.hash='#/workspace';setSelectedId(null)};
 const loadList=useCallback(async()=>{if(demo){setLoading(false);return}try{const [data,taskPages,archives]=await Promise.all([workspaceRequest<{pages:WPage[];sources:WSource[];recordPageIds:string[]}>('bootstrap'),request<{pageIds:string[]}>('os8','task_page_links'),request<{pageIds:string[]}>('os9','archived_pages').catch((): {pageIds:string[]}=>({pageIds:[]}))]);setPages((data.pages||[]).filter(page=>!archives.pageIds.includes(page.id)));setSources(data.sources||[]);setRecordPageIds([...new Set([...(data.recordPageIds||[]),...(taskPages.pageIds||[])])]);setError('')}catch(e:any){setError(e.message||'Ошибка загрузки страниц')}finally{setLoading(false)}},[demo]);
 const loadPage=useCallback(async(id:string)=>{if(demo)return;setWorking(true);try{const [data,linked]=await Promise.all([workspaceRequest<WPageResponse>('page_get',{id}),request<{task:Task|null}>('os8','task_page_find',{pageId:id})]);setDetails(data);setTaskData(linked.task||null);setError('')}catch(e:any){setError(e.message||'Страница не загрузилась');setDetails(null);setTaskData(null)}finally{setWorking(false)}},[demo]);
 const refresh=useCallback(async()=>{await loadList();if(selectedId)await loadPage(selectedId)},[loadList,loadPage,selectedId]);
 useEffect(()=>{const change=()=>{setDetails(null);setSelectedId(uuidRoute())};window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change)},[]);
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
  <div className="os-workspace-top" style={selectedId?{display:"none"}:undefined}><div><span className="os-kicker">{embedded?'ПРОЕКТЫ И СТРАНИЦЫ':'PERSONAL OS · ПРОСТРАНСТВО'}</span><h1>{embedded?'Пространство':'Страницы'}</h1><p>Документы, базы и Pipeline внутри задач или отдельных страниц.</p></div><button className="os-btn os-btn-primary" onClick={()=>void createPage('Новая страница')} disabled={working||demo}><Icon name="plus" size={17}/> Страница</button></div>
  {error&&<div role="alert" className="os-error-banner">{error}<button onClick={()=>void refresh()}>Повторить</button></div>}
  {demo&&<div className="os-info">В демо-режиме создание и облачное сохранение страниц недоступны. Открой Mini App через Telegram, чтобы работать с настоящими данными.</div>}
  <div className={"os-workspace-layout "+(selectedId?"os-page-focused":"")}><aside className="os-page-rail" aria-label="Дерево страниц"><button className={!selectedId?'active':''} onClick={home}><Icon name="folder" size={17}/> Все страницы</button>{pages.filter(p=>!p.parent_id&&!recordPageIds.includes(p.id)).map(p=><PageTree key={p.id} page={p}all={pages}selected={selectedId}onOpen={openPage}level={0}/>)}</aside>
   <div className="os-workspace-main">
   {!selectedId?<div className="os-page-directory"><div className="os-surface"><h2>Мои страницы</h2><p className="os-muted">Создай страницу для проекта, направления или цели. Внутри можно собирать блоки, чеклисты и Pipeline.</p>
      <form className="os-add-form" onSubmit={e=>{e.preventDefault();void createPage(newTitle)}}><input value={newTitle} onChange={e=>setNewTitle(e.target.value)} maxLength={180} placeholder="Название новой страницы"/><button className="os-btn os-btn-primary" type="submit" disabled={!newTitle.trim()||working||demo}>Создать</button></form>
      {loading?<p className="os-muted">Загружаем…</p>:pages.length===0?<div className="os-empty">Здесь пока нет страниц. Создай первую.</div>:<div className="os-page-gallery">{pages.filter(p=>!p.parent_id&&!recordPageIds.includes(p.id)).map(p=><button key={p.id} onClick={()=>openPage(p.id)}><span className="os-page-emoji">{p.icon}</span><strong>{p.title}</strong><small>Открыть страницу</small></button>)}</div>}
     </div><div className="os-surface"><h3>Как устроено</h3><p>Страница содержит блоки. Блок «База данных» показывает одну коллекцию в таблице, доске, списке или календаре. Pipeline показывает этапы и чеклисты выполнения.</p></div></div>
   :working&&!details?<p className="os-muted">Открываем страницу…</p>
   :details&&<div className="os-page-editor" key={details.page.id}><button className="os-back-to-buffer" onClick={home}><Icon name="left" size={18}/> Назад в буфер задач</button><div className="os-breadcrumbs"><button onClick={home}>Страницы</button>{parents.map(p=><React.Fragment key={p.id}><span>/</span><button onClick={()=>openPage(p.id)}>{p.title}</button></React.Fragment>)}</div>
      <PageContents data={details}taskData={taskData}pages={pages}sources={sources}onOpen={openPage}onAddPage={createPage}onDeletePage={deletePage}write={run}refresh={refresh}/>
    </div>}
   </div></div>
 </div>;
}
function PageTree({page,all,selected,onOpen,level}:{page:WPage;all:WPage[];selected:string|null;onOpen:(id:string)=>void;level:number}){
 return <div><button style={{paddingLeft:`${10+Math.min(level,6)*13}px`}} className={selected===page.id?'active':''} onClick={()=>onOpen(page.id)}><span>{page.icon}</span><span className="os-ellipsis">{page.title}</span></button>{level<8&&all.filter(x=>x.parent_id===page.id).map(p=><PageTree key={p.id} page={p}all={all}selected={selected}onOpen={onOpen}level={level+1}/>)}</div>;
}
type Contents={data:WPageResponse;taskData:Task|null;pages:WPage[];sources:WSource[];onOpen:(id:string)=>void;onAddPage:(title:string,parentId:string|null)=>Promise<any>;onDeletePage:(p:WPage)=>Promise<void>;write:(action:string,body:Record<string,unknown>)=>Promise<any>;refresh:()=>Promise<void>};
function PageContents({data,taskData,pages,sources,onOpen,onAddPage,onDeletePage,write,refresh}:Contents){
 const {page,blocks}=data,[title,setTitle]=useState(page.title),[icon,setIcon]=useState(page.icon),[type,setType]=useState<BlockType>('text');
 const [sourceId,setSourceId]=useState(sources[0]?.id||''),[sourceName,setSourceName]=useState(''),[linkId,setLinkId]=useState('');
 const [adding,setAdding]=useState(false);
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
 const blockOrder=async(id:string,delta:number)=>{const ids=blocks.map(x=>x.id),i=ids.indexOf(id),j=i+delta;if(j<0||j>=ids.length)return;[ids[i],ids[j]]=[ids[j],ids[i]];await write('block_reorder',{pageId:page.id,ids});await refresh()};
 const sub=pages.filter(x=>x.parent_id===page.id);
 return <>
   <div className="os-page-toolbar"><div className="os-icon-pick"><select aria-label="Иконка страницы" value={icon} onChange={e=>{setIcon(e.target.value);void savePage(title,e.target.value)}}>{icons.map(i=><option key={i} value={i}>{i}</option>)}</select></div><button className="os-icon os-danger" onClick={()=>void onDeletePage(page)} title="Удалить страницу"><Icon name="trash" size={17}/></button></div>
   <input className="os-page-heading" aria-label="Название страницы" value={title} maxLength={180} onChange={e=>setTitle(e.target.value)} onBlur={()=>{if(title.trim()!==page.title)void savePage()}} onKeyDown={e=>{if(e.key==='Enter')(e.target as HTMLInputElement).blur()}}/>
   {data.record&&<div className="os-info">Это запись базы данных. Редактируй её поля в представлении базы; здесь можно добавлять любые блоки.</div>}
   {taskData&&<><TaskPageProperties key={taskData.id} task={taskData} pageTitle={title} onSaved={refresh}/>{/работ|бизнес|фриланс|клиент|продаж/i.test(taskData.sphere||'')&&<TaskIncomeEditor taskId={taskData.id}/>}</>}
   <div className="os-blocks">{blocks.map((block,index)=><div className="os-block-shell" key={block.id}><div className="os-block-handles"><button title="Поднять блок" disabled={!index} onClick={()=>void blockOrder(block.id,-1)}>↑</button><button title="Опустить блок" disabled={index===blocks.length-1} onClick={()=>void blockOrder(block.id,1)}>↓</button><button title="Удалить блок" onClick={()=>{if(window.confirm('Удалить блок?'))void write('block_delete',{id:block.id}).then(refresh)}}>×</button></div><PageBlock block={block}onAppendChecklist={appendChecklist}pages={pages}sources={sources}data={data}openPage={onOpen}write={write}refresh={refresh}/></div>)}</div>
   <div className="os-new-block"><button className="os-btn" onClick={()=>setAdding(v=>!v)}><Icon name="plus" size={17}/> Добавить блок</button>{adding&&<div className="os-block-picker"><div className="os-block-picker-grid">{Object.entries(blockLabels).map(([k,v])=><button key={k} className={type===k?'active':''} onClick={()=>setType(k as BlockType)}>{v}</button>)}</div>
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
function TaskPageProperties({task,pageTitle,onSaved}:{task:Task;pageTitle:string;onSaved:()=>Promise<void>}){
 const {categories,saveTask,goals,os6,mutate,open}=useApp();const {goals:regularGoals}=useRegularGoals();
 const [day,setDay]=useState(task.day||''),[priority,setPriority]=useState<'important'|'extra'>(task.priority),[categoryId,setCategory]=useState(task.os61_category_id||categories.find(c=>c.name===task.sphere)?.id||''),[notes,setNotes]=useState(task.notes||''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const link=os6.links.find(x=>x.task_id===task.id)?.goal_id||'';
 const [goalId,setGoalId]=useState(link?'amb:'+link:'');
 useEffect(()=>{let active=true;void request<{goalId:string|null}>('os9','regular_goal_get',{taskId:task.id}).then(r=>{
   if(active&&r.goalId)setGoalId('reg:'+r.goalId);
 }).catch(()=>{});return()=>{active=false}},[task.id]);

 const save=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setError('');try{await saveTask({id:task.id,title:pageTitle.trim()||task.title,notes,day:day||null,priority,categoryId,sphere:categories.find(c=>c.id===categoryId)?.name||task.sphere,goalId:goalId.startsWith('amb:')?goalId.slice(4):''});
 await request('os9','regular_goal_set',{taskId:task.id,goalId:goalId.startsWith('reg:')?goalId.slice(4):null});await onSaved();}catch(err:any){setError(err.message||'Не удалось сохранить свойства')}finally{setBusy(false)}};
 return <form className="os-task-properties os-properties-v67" onSubmit={save} onKeyDown={e=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){e.preventDefault();e.currentTarget.requestSubmit()}}}>
  <div className="os-property-head"><h3>Свойства задачи</h3><span>Изменения применяются после сохранения</span></div>
  <div className="os-property-rows">
   <div className="os-property-row"><label htmlFor="os-prop-category"><Icon name="folder" size={16}/>Категория</label><div className="os-property-value"><select id="os-prop-category" value={categoryId} onChange={e=>setCategory(e.target.value)}><option value="">Без категории</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><QuickCategory/></div></div>
   <div className="os-property-row"><label htmlFor="os-prop-priority"><Icon name="flag" size={16}/>Приоритет</label><select id="os-prop-priority" value={priority} onChange={e=>setPriority(e.target.value as 'important'|'extra')}><option value="important">Важная</option><option value="extra">Дополнительная</option></select></div>
   <div className="os-property-row"><label htmlFor="os-prop-day"><Icon name="calendar" size={16}/>Дата</label><div className="os-property-value"><input id="os-prop-day" type="date" value={day} onChange={e=>setDay(e.target.value)}/>{day&&<button type="button" className="os-property-clear" onClick={()=>setDay('')}>В буфер</button>}</div></div>
   <div className="os-property-row"><label htmlFor="os-prop-goal"><Icon name="target" size={16}/>Связь с целью</label><select id="os-prop-goal" value={goalId} onChange={e=>setGoalId(e.target.value)}><option value="">Без цели</option><optgroup label="Обычные цели">{regularGoals.map(g=><option key={g.id} value={'reg:'+g.id}>{g.title}</option>)}</optgroup><optgroup label="Амбициозные цели">{goals.map(g=><option key={g.id} value={'amb:'+g.id}>{g.title}</option>)}</optgroup></select></div>
   <div className="os-property-row os-property-row-long"><label htmlFor="os-prop-notes"><Icon name="list" size={16}/>Заметки</label><textarea id="os-prop-notes" value={notes} rows={2} maxLength={6000} onChange={e=>setNotes(e.target.value)} placeholder="Контекст и ссылки…"/></div>
  </div>
  {error&&<p className="os-error-banner" role="alert">{error} — часть полей могла сохраниться. Обнови страницу перед повтором.</p>}
  <div className="os-property-actions"><button type="button" className="os-btn" onClick={()=>void mutate("os6","focus",{command:"start",title:task.title,task_id:task.id}).then(()=>open("focus")).catch(()=>{})}><Icon name="play" size={16}/> Фокус</button><span>⌘ / Ctrl + Enter</span><button disabled={busy} className="os-btn os-btn-primary os-property-submit" type="submit"><Icon name={busy?'refresh':'check'} size={17}/>{busy?'Сохраняем…':'Сохранить'}</button></div>
 </form>;
}
