import React,{useState} from 'react';
import {isQAMode,readQASession,startQASession,clearQASession,resetQAData, type QASession} from './sandbox';
import './qa.css';

/**
 * QA is intentionally not an authentication method.
 * No AppProvider is mounted until a local-only sandbox session is created.
 */
export function QASandboxGate({children}:{children:React.ReactNode}){
 const [session,setSession]=useState<QASession|null>(()=>isQAMode()?readQASession():null);
 const [name,setName]=useState('');
 if(!isQAMode())return <>{children}</>;
 if(!session)return <main className="qa-entry">
   <form className="qa-entry-card" onSubmit={e=>{e.preventDefault();if(name.trim().length<2)return;setSession(startQASession(name.trim()))}}>
     <span className="qa-eyebrow">PERSONAL OS · QA SANDBOX</span>
     <h1>Тестовое пространство</h1>
     <p>Введи имя и исследуй интерфейс без Telegram. Задачи, цели и страницы сохраняются только в этом браузере — рабочая база не используется.</p>
     <label htmlFor="qa-guest-name">Как тебя зовут?</label>
     <input id="qa-guest-name" name="qaName" autoComplete="off" autoFocus maxLength={60} minLength={2} required placeholder="Например, Тестировщик" value={name} onChange={e=>setName(e.target.value)}/>
     <button type="submit" disabled={name.trim().length<2}>Войти в QA Sandbox</button>
     <small>Тестовые данные · Без облачной синхронизации · Не используйте реальные личные сведения</small>
   </form>
 </main>;
 return <div className="qa-root">
  <div className="qa-banner" role="status"><span>🧪 QA Sandbox · {session.name} · только локальные данные</span><div className="qa-banner-actions">
    <button type="button" onClick={()=>{if(window.confirm('Сбросить все тестовые данные в этом браузере?')){resetQAData();window.location.reload()}}}>Сбросить данные</button>
    <button type="button" onClick={()=>{clearQASession();setSession(null);window.location.hash='';window.location.reload()}}>Выйти</button>
   </div></div>
  {children}
 </div>;
}
