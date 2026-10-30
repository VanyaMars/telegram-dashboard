import React,{useEffect,useState} from 'react';
import {BufferPage} from './CorePages';
import {WorkspacePage} from './Workspace';

/** Keep a single WorkspacePage instance mounted while its hash route changes.
 * The former conditional rendering remounted the editor on every parent/child
 * transition, dropping its in-flight selected-page state.
 */
export function BufferWorkspacePage(){
  const [editingPage,setEditingPage]=useState(()=>window.location.hash.startsWith('#/page/'));
  useEffect(()=>{
    const sync=()=>setEditingPage(window.location.hash.startsWith('#/page/'));
    window.addEventListener('hashchange',sync);
    return()=>window.removeEventListener('hashchange',sync);
  },[]);
  return <div className="unified-buffer">
    {!editingPage&&<BufferPage/>}
    <details className="mvp-advanced-pages" open={editingPage ? true : undefined}>
      {!editingPage&&<summary>Дополнительные страницы и базы</summary>}
      <WorkspacePage embedded/>
    </details>
  </div>;
}
