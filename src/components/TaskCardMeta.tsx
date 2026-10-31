import React,{useEffect,useState} from 'react';
import {request} from '../lib/api';
export type TaskCardMeta={emoji:string;progress:number|null};
const cache=new Map<string,TaskCardMeta>();
export function useTaskCardMeta(ids:string[]){
 const [data,setData]=useState<Record<string,TaskCardMeta>>({});
 const key=[...ids].sort().join(',');
 useEffect(()=>{let live=true;if(!ids.length)return;request<{cards:Record<string,TaskCardMeta>}>('os8','task_cards_meta',{taskIds:ids}).then(r=>{if(!live)return;Object.entries(r.cards||{}).forEach(([id,x])=>cache.set(id,x));setData(Object.fromEntries(ids.map(id=>[id,cache.get(id)||{emoji:'📋',progress:null}])))}).catch(()=>{if(live)setData(Object.fromEntries(ids.map(id=>[id,cache.get(id)||{emoji:'📋',progress:null}])))});return()=>{live=false}},[key]);
 return data;
}
export const EMOJI_GROUPS:Record<string,string[]>={Действия:['📋','✅','🎯','📌','📝','📅','⏰','🔥','⚡','💡','🚀','⭐','🏆','📈','🔔','🔑'],Работа:['💼','💻','📊','📁','🗂️','🎨','✍️','📷','💰','💳','📞','🌐','🧠','🔧'],Жизнь:['🏠','🛒','🍎','🍽️','🚗','🚲','🏃','🏋️','💪','❤️','📚','🎧','🎮','🎉','☕','🌱'],Люди:['🙂','😀','😎','🤝','👨‍👩‍👧','👤','👥','🙌','💬']};
export function TaskEmojiPicker({value,onSelect,onClose}:{value:string;onSelect:(emoji:string)=>void;onClose:()=>void}){
 const [search,setSearch]=useState('');
 return <div className="task-emoji-picker" onClick={e=>e.stopPropagation()}>
  <div className="task-emoji-search"><input aria-label="Поиск эмодзи" placeholder="Поиск по категории" value={search} onChange={e=>setSearch(e.target.value)}/><button type="button" aria-label="Закрыть выбор эмодзи" onClick={onClose}>×</button></div>
  {Object.entries(EMOJI_GROUPS).filter(([name])=>name.toLowerCase().includes(search.toLowerCase())||!search).map(([name,icons])=><div key={name}><small>{name}</small><div className="task-emoji-grid">{icons.map(emoji=><button type="button" className={emoji===value?'active':''} key={emoji} aria-label={'Выбрать '+emoji} onClick={()=>onSelect(emoji)}>{emoji}</button>)}</div></div>)}
 </div>;
}
