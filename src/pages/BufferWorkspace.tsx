import React,{useEffect,useState} from 'react';
import {BufferPage} from './CorePages';
import {WorkspacePage} from './Workspace';

/** Keep one mounted WorkspacePage while switching between directory and page route. */
export function BufferWorkspacePage(){
 const [editingPage,setEditingPage]=useState(()=>window.location.hash.startsWith('#/page/'));
 const [showPages,setShowPages]=useState(()=>window.location.hash.startsWith('#/page/')||window.location.hash==='#/workspace');
 useEffect(()=>{
  const sync=()=>{const hash=window.location.hash;setEditingPage(hash.startsWith('#/page/'));if(hash.startsWith('#/page/')||hash==='#/workspace')setShowPages(true)};
  window.addEventListener('hashchange',sync);return()=>window.removeEventListener('hashchange',sync);
 },[]);
 return <div className="unified-buffer">
  {!editingPage&&<BufferPage/>}
  {!editingPage&&<button type="button" className="mvp-pages-toggle" aria-controls="os-workspace-panel" aria-expanded={showPages} onClick={()=>setShowPages(value=>!value)}>
   {showPages?'Скрыть дополнительные страницы и базы':'Дополнительные страницы и базы'}
  </button>}
  <section id="os-workspace-panel" className="mvp-advanced-pages" hidden={!editingPage&&!showPages}>
   <WorkspacePage embedded/>
  </section>
 </div>;
}
