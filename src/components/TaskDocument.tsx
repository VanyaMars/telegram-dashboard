import React,{useEffect,useRef,useState} from 'react';
import {EditorContent,useEditor} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import {Details,DetailsContent,DetailsSummary} from '@tiptap/extension-details';
import type {WBlock} from '../lib/workspace';

export function TaskDocument({block,save}:{block:WBlock;save:(content:Record<string,unknown>)=>Promise<any>}){
 const draftKey='os-document:'+block.page_id+':'+block.id;
 const initial=()=>{try{const draft=localStorage.getItem(draftKey);if(draft)return JSON.parse(draft)}catch{}return block.content.document||{type:'doc',content:[block.type==='checklist'?{type:'taskList',content:[{type:'taskItem',attrs:{checked:!!block.content.checked},content:[{type:'paragraph',content:block.content.text?[{type:'text',text:block.content.text}]:[]}]}]}:{type:block.type==='heading'?'heading':'paragraph',attrs:block.type==='heading'?{level:2}:undefined,content:block.content.text?[{type:'text',text:block.content.text}]:[]}]}};
 const [status,setStatus]=useState(''),[menu,setMenu]=useState(false);
 const saveRef=useRef(save);saveRef.current=save;
 const revision=useRef(0);
 const pending=useRef<{doc:any;text:string;revision:number}|null>(null),timer=useRef<ReturnType<typeof setTimeout>>(),queue=useRef(Promise.resolve());
 const flush=()=>{if(timer.current)clearTimeout(timer.current);const change=pending.current;if(!change)return;pending.current=null;setStatus('Сохраняется…');queue.current=queue.current.catch(()=>{}).then(async()=>{try{
   await saveRef.current({...block.content,document:change.doc,text:change.text});
   if(change.revision===revision.current){try{if(localStorage.getItem(draftKey)===JSON.stringify(change.doc))localStorage.removeItem(draftKey)}catch{}setStatus('')}
  }catch{if(change.revision===revision.current){pending.current=change;setStatus('Не сохранено · повторить')}}})};
 const flushRef=useRef(flush);flushRef.current=flush;
 const editor=useEditor({extensions:[StarterKit.configure({link:{openOnClick:false,protocols:['https','http','mailto']}}),TaskList,TaskItem.configure({nested:true,HTMLAttributes:{'data-type':'taskItem'},a11y:{checkboxLabel:node=>'Выполнено: '+(node.textContent||'пункт чеклиста')}}),Details.configure({persist:true}),DetailsSummary,DetailsContent],content:initial(),editorProps:{attributes:{class:'task-document','aria-label':'Содержимое задачи','data-placeholder':'Напиши детали или нажми / для выбора блока…'},handleKeyDown:(view,e)=>{if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&view.state.selection.$from.parentOffset===0){setMenu(true);e.preventDefault();return true}return false}},onUpdate:({editor})=>{const doc=editor.getJSON();pending.current={doc,text:editor.getText(),revision:++revision.current};try{localStorage.setItem(draftKey,JSON.stringify(doc))}catch{}setStatus('Черновик');if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>flushRef.current(),700)},onBlur:()=>flushRef.current()});
 useEffect(()=>{const leave=()=>flushRef.current();const visibility=()=>{if(document.visibilityState==='hidden')leave()};window.addEventListener('pagehide',leave);window.addEventListener('online',leave);document.addEventListener('visibilitychange',visibility);return()=>{leave();window.removeEventListener('pagehide',leave);window.removeEventListener('online',leave);document.removeEventListener('visibilitychange',visibility)}},[]);
 useEffect(()=>{if(!editor||revision.current)return;try{if(localStorage.getItem(draftKey)){pending.current={doc:editor.getJSON(),text:editor.getText(),revision:++revision.current};flushRef.current()}}catch{}},[editor]);
 if(!editor)return null;
 const command=(fn:()=>void)=>{fn();setMenu(false)};
 return <div className="task-document-wrap"><div className="task-document-toolbar" onMouseDown={e=>e.preventDefault()}>
 <button type="button" onClick={()=>setMenu(!menu)} aria-label="Формат текста">＋</button><button type="button" aria-label="Жирный" onClick={()=>editor.chain().focus().toggleBold().run()}><b>B</b></button><button type="button" aria-label="Курсив" onClick={()=>editor.chain().focus().toggleItalic().run()}><i>I</i></button><button type="button" aria-label="Зачёркнутый" onClick={()=>editor.chain().focus().toggleStrike().run()}>S̶</button><button type="button" onClick={()=>{const href=prompt('Адрес ссылки');if(href&&/^(https?:\/\/|mailto:)/i.test(href))editor.chain().focus().setLink({href}).run()}}>Ссылка</button>
 </div>{menu&&<div className="task-document-menu">{[['Текст',()=>editor.chain().focus().setParagraph().run()],['Заголовок',()=>editor.chain().focus().toggleHeading({level:2}).run()],['Список',()=>editor.chain().focus().toggleBulletList().run()],['Нумерация',()=>editor.chain().focus().toggleOrderedList().run()],['Чеклист',()=>editor.chain().focus().toggleTaskList().run()],['Раскрывающийся список',()=>editor.chain().focus().setDetails().run()],['Цитата',()=>editor.chain().focus().toggleBlockquote().run()],['Разделитель',()=>editor.chain().focus().setHorizontalRule().run()]].map(([label,fn])=><button type="button" key={String(label)} onClick={()=>command(fn as ()=>void)}>{String(label)}</button>)}</div>}<EditorContent editor={editor}/>{status&&<button className="task-save-status" type="button" onClick={flush}>{status}</button>}</div>;
}
