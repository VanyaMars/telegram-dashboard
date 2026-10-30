import React,{useEffect,useMemo,useState,useRef} from 'react';
import {Icon} from './Icons';
import {pipelineProgress,splitProgress,WSplit,WItem} from '../lib/workspace';

type Props={blockId:string;initialSplits:WSplit[];initialItems:WItem[];write:(action:string,body:Record<string,unknown>)=>Promise<any>;reload:()=>Promise<void>};
export function SplitPipeline({blockId,initialSplits,initialItems,write,reload}:Props){
 const splits=useMemo(()=>initialSplits.filter(s=>s.block_id===blockId).sort((a,b)=>a.position-b.position),[initialSplits,blockId]);
 const items=useMemo(()=>initialItems.filter(t=>splits.some(s=>s.id===t.split_id)).sort((a,b)=>a.position-b.position),[initialItems,splits]);
 const [active,setActive]=useState<string>('');const [newSplit,setNewSplit]=useState('');
 const [newSplitError,setNewSplitError]=useState('');const [pending,setPending]=useState(false);const splitRef=useRef<HTMLInputElement>(null);
 useEffect(()=>{if(!splits.some(s=>s.id===active))setActive(splits[0]?.id||'')},[splits,active]);
 const total=items.length,done=items.filter(x=>x.completed).length;
 const action=async(name:string,body:Record<string,unknown>)=>{await write(name,body);await reload()};
 const move=async(splitId:string,direction:number)=>{const ids=splits.map(x=>x.id);const i=ids.indexOf(splitId),j=i+direction;if(i<0||j<0||j>=ids.length)return;[ids[i],ids[j]]=[ids[j],ids[i]];await action('split_reorder',{blockId,ids})};
 return <section className="os-pipeline" aria-label="Pipeline">
   <div className="os-pipe-summary"><div><strong>Pipeline</strong><span>{total?`${done} из ${total} действий`:'Нет задач'}</span></div><b>{pipelineProgress(splits,items)}%</b></div>
   <div className="os-progress" role="progressbar" aria-valuenow={pipelineProgress(splits,items)} aria-valuemin={0} aria-valuemax={100}><span style={{width:`${pipelineProgress(splits,items)}%`}}/></div>
   <div className="os-pipe-tabs" role="tablist" aria-label="Этапы Pipeline">{splits.map((s,i)=><button role="tab" key={s.id} aria-selected={active===s.id} className={active===s.id?'active':''} onClick={()=>setActive(s.id)}><small>Этап {i+1}</small>{s.title}</button>)}</div>
   <div className="os-pipe-columns">{splits.map((s,i)=><div className={'os-split '+(active===s.id?'active':'')} key={s.id}><SplitColumn split={s}index={i}items={items.filter(x=>x.split_id===s.id)}move={move}action={action}allSplits={splits}/></div>)}</div>
   <form className="os-add-split" onSubmit={async e=>{e.preventDefault();if(!newSplit.trim()){setNewSplitError('Сначала введи название этапа');splitRef.current?.focus();return;}
     setPending(true);setNewSplitError('');try{await action('split_save',{blockId,title:newSplit.trim()});setNewSplit('');splitRef.current?.focus();}catch{setNewSplitError('Не удалось сохранить этап. Повтори попытку.')}finally{setPending(false)}}}>
    <input ref={splitRef} value={newSplit} onChange={e=>{setNewSplit(e.target.value);if(newSplitError)setNewSplitError('')}} placeholder="Например, Планирование" aria-label="Название этапа" aria-invalid={!!newSplitError} aria-describedby={newSplitError?'split-name-error':undefined} maxLength={120}/><button className="os-icon os-save-icon" type="submit" disabled={pending} title="Добавить этап · Enter" aria-label="Добавить этап"><Icon name="check" size={18}/></button>
   </form>{newSplitError?<p className="os-inline-error" id="split-name-error" role="alert">{newSplitError}</p>:<p className="os-inline-hint">Введи название и нажми Enter ↵ или галочку</p>}
 </section>
}
function SplitColumn({split,index,items,move,action,allSplits}:{split:WSplit;index:number;items:WItem[];move:(id:string,step:number)=>Promise<void>;action:(action:string,body:Record<string,unknown>)=>Promise<void>;allSplits:WSplit[]}){
 const [title,setTitle]=useState(split.title),[adding,setAdding]=useState(''),[editError,setEditError]=useState(''),[editing,setEditing]=useState<string|null>(null),[editText,setEditText]=useState('');
 useEffect(()=>setTitle(split.title),[split.id,split.title]);
 const done=items.filter(t=>t.completed).length,progress=splitProgress(items);

 const reorder=async(id:string,delta:number)=>{const ids=items.map(t=>t.id),a=ids.indexOf(id),b=a+delta;if(b<0||b>=ids.length)return;[ids[a],ids[b]]=[ids[b],ids[a]];await action('workflow_reorder',{splitId:split.id,ids})};
 return <div className="os-split-card">
  <div className="os-split-top"><span className="os-kicker">ЭТАП {index+1}</span><details className="os-split-menu"><summary aria-label={`Действия с этапом ${split.title}`} title="Действия с этапом"><Icon name="more" size={17}/></summary><div className="os-split-actions">
    <button className="os-icon" disabled={index===0} title="Этап левее" onClick={()=>void move(split.id,-1)}><Icon name="left" size={16}/></button>
    <button className="os-icon" disabled={index===allSplits.length-1} title="Этап правее" onClick={()=>void move(split.id,1)}><Icon name="right" size={16}/></button>
    <button className="os-icon os-danger" title="Удалить этап" onClick={()=>{if(window.confirm('Удалить этап и все его пункты?'))void action('split_delete',{id:split.id})}}><Icon name="trash" size={15}/></button></div></details></div>
  <input className="os-split-title" value={title} onChange={e=>setTitle(e.target.value)} maxLength={120} aria-label="Название этапа" onBlur={()=>{if(title.trim()&&title.trim()!==split.title)void action('split_save',{id:split.id,blockId:split.block_id,title:title.trim()})}} onKeyDown={e=>{if(e.key==='Enter')(e.target as HTMLInputElement).blur()}}/>
  <div className="os-split-metrics"><span>{done} / {items.length} выполнено</span><b>{progress}%</b></div>
  <div className="os-progress"><span style={{width:`${progress}%`}}/></div>
  <div className="os-workflow-list">{items.map(item=><div className="os-workflow-row" key={item.id}>
   <input type="checkbox" checked={item.completed} aria-label={`Выполнено: ${item.title}`} onChange={e=>void action('workflow_save',{id:item.id,splitId:split.id,completed:e.target.checked})}/>
   {editing===item.id?<input className="os-inline-input" autoFocus value={editText} onChange={e=>setEditText(e.target.value)} maxLength={240} onBlur={()=>{if(editText.trim()&&editText!==item.title)void action('workflow_save',{id:item.id,splitId:split.id,title:editText.trim()});setEditing(null)}} onKeyDown={e=>{if(e.key==='Enter')(e.target as HTMLInputElement).blur()}}/>:<span className={item.completed?'completed':''} onClick={()=>{setEditing(item.id);setEditText(item.title)}}>{item.title}</span>}
   <div className="os-task-mini-controls"><button title="Выше" disabled={items[0].id===item.id} onClick={()=>void reorder(item.id,-1)}>↑</button><button title="Ниже" disabled={items[items.length-1].id===item.id} onClick={()=>void reorder(item.id,1)}>↓</button><button title="Удалить" onClick={()=>void action('workflow_delete',{id:item.id})}>×</button></div>
  </div>)}</div>
  <form className="os-workflow-add" onSubmit={async e=>{e.preventDefault();if(!adding.trim()){setEditError('Напиши действие перед добавлением');return;}setEditError('');try{await action('workflow_save',{splitId:split.id,title:adding.trim()});setAdding('')}catch{setEditError('Не удалось сохранить действие')}}}>
   <input placeholder="Новое действие…" aria-label="Новое действие Workflow" value={adding} onChange={e=>{setAdding(e.target.value);setEditError('')}} maxLength={240}/><button className="os-icon" type="submit" title="Добавить действие · Enter"><Icon name="check" size={17}/></button>
  </form>{editError&&<p role="alert" className="os-inline-error">{editError}</p>}
 </div>
}