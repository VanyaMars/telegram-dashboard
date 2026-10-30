import React,{useEffect,useState} from 'react';
import {useApp} from '../AppContext';
import {getTaskIncome,saveTaskIncome,TaskIncome} from '../lib/earnings';
const defaultIncome:TaskIncome={amount:0,currency:'RUB',confirmed:false,earned_on:null};
export function TaskIncomeEditor({taskId}:{taskId:string}){
 const {today,demo}=useApp();const [form,setForm]=useState<TaskIncome>(defaultIncome);
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 useEffect(()=>{let active=true;if(demo){setLoading(false);return}void getTaskIncome(taskId).then(r=>{if(active)setForm(r.income||defaultIncome)}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[taskId,demo]);
 const save=async(e:React.FormEvent)=>{e.preventDefault();setSaving(true);setError('');setMessage('');try{
   await saveTaskIncome(taskId,{...form,amount:Number(form.amount),earned_on:form.confirmed?(form.earned_on||today):null});setMessage('Доход сохранён');
   window.dispatchEvent(new Event('os9:income-changed'));
  }catch(err:any){setError(err.message||'Доход не сохранён')}finally{setSaving(false)}};
 return <section className="os-income-section"><div><h3>Доход по задаче</h3><p>Запланированная сумма не считается заработанной, пока не отмечена как полученная.</p></div>
  {loading?<p>Загружаем…</p>:<form onSubmit={save} className="os-income-form">
   <label>Сумма<input type="number" min="0" max="999999999" step="0.01" value={form.amount} onChange={e=>setForm(v=>({...v,amount:Number(e.target.value)}))}/></label>
   <label>Валюта<select value={form.currency} onChange={e=>setForm(v=>({...v,currency:e.target.value as TaskIncome['currency']}))}><option value="RUB">RUB</option><option value="USD">USD</option><option value="EUR">EUR</option></select></label>
   <label className="os-income-confirm"><input type="checkbox" checked={form.confirmed} onChange={e=>setForm(v=>({...v,confirmed:e.target.checked,earned_on:e.target.checked?(v.earned_on||today):null}))}/> Деньги получены</label>
   {form.confirmed&&<label>Дата получения<input type="date" required value={form.earned_on||today} onChange={e=>setForm(v=>({...v,earned_on:e.target.value}))}/></label>}
   <button className="os-icon os-save-icon" type="submit" disabled={saving||demo} title="Сохранить доход" aria-label="Сохранить доход">✓</button>
  </form>}
  {error&&<p role="alert" className="os-inline-error">{error}</p>}{message&&<p role="status" className="os-income-saved">{message}</p>}
 </section>;
}
