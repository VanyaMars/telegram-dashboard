import React,{useState} from 'react';
import {useApp} from '../AppContext';
import {Icon} from './Icons';
const palette=['#8B84ED','#50BFA8','#E69D6B','#DB82BC','#63A5DB','#D5AD55'];
export function QuickCategory(){
 const {saveCategory,open}=useApp();
 const [visible,setVisible]=useState(false),[name,setName]=useState(''),[color,setColor]=useState(palette[0]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const submit=async(e:React.FormEvent)=>{e.preventDefault();if(!name.trim())return;setBusy(true);setError('');try{await saveCategory({name:name.trim(),color,icon:'folder'});setName('');setVisible(false)}catch(err:any){setError(err?.message||'Не сохранилось')}finally{setBusy(false)}};
 return <div className="quick-category">{!visible?<button type="button" onClick={()=>setVisible(true)}><Icon name="plus" size={14}/> Категория</button>:
 <form className="quick-category-form" onSubmit={submit}><input autoFocus aria-label="Название новой категории" maxLength={60} placeholder="Название категории" value={name} onChange={e=>setName(e.target.value)}/>
 <input type="color" aria-label="Цвет категории" value={color} onChange={e=>setColor(e.target.value)}/>
 <button type="submit" disabled={busy||!name.trim()} title="Сохранить" aria-label="Сохранить категорию"><Icon name="check" size={15}/></button>
 <button type="button" onClick={()=>setVisible(false)} title="Отмена" aria-label="Отмена"><Icon name="x" size={15}/></button></form>}
 {error&&<span role="alert">{error}</span>}
 <button type="button" onClick={()=>open('categories')} title="Редактировать категории" aria-label="Редактировать категории"><Icon name="settings" size={14}/></button>
 </div>;
}