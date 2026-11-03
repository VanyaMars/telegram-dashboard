import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {EditorContent,useEditor,type Editor} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import {Details,DetailsContent,DetailsSummary} from '@tiptap/extension-details';
import {Icon} from './Icons';
import type {WBlock} from '../lib/workspace';

type Change={doc:Record<string,any>;text:string;revision:number};
export function TaskDocument({block,save,onInsertBlock}:{block:WBlock;save:(content:Record<string,unknown>)=>Promise<any>;onInsertBlock?:(type:'pipeline'|'image'|'database'|'page_link')=>void}){
 const draftKey='os-document:'+block.page_id+':'+block.id;
 const initial=()=>{try{const draft=localStorage.getItem(draftKey);if(draft)return JSON.parse(draft)}catch{}return block.content.document||{type:'doc',content:[block.type==='checklist'?{type:'taskList',content:[{type:'taskItem',attrs:{checked:!!block.content.checked},content:[{type:'paragraph',content:block.content.text?[{type:'text',text:block.content.text}]:[]}]}]}:{type:block.type==='heading'?'heading':'paragraph',attrs:block.type==='heading'?{level:2}:undefined,content:block.content.text?[{type:'text',text:block.content.text}]:[]}]}};
 const [status,setStatus]=useState(''),[menu,setMenu]=useState(false),[focused,setFocused]=useState(false),[anchor,setAnchor]=useState({top:0,left:0,width:288});
 const [empty,setEmpty]=useState(false),[link,setLink]=useState<string|null>(null);
 const saveRef=useRef(save);saveRef.current=save;
 const revision=useRef(0),pending=useRef<Change|null>(null),timer=useRef<ReturnType<typeof setTimeout>>(),queue=useRef(Promise.resolve());
 const editorRef=useRef<Editor|null>(null),frame=useRef<number>();
 const flush=()=>{if(timer.current)clearTimeout(timer.current);const change=pending.current;if(!change)return;pending.current=null;setStatus('Сохраняется…');queue.current=queue.current.catch(()=>{}).then(async()=>{try{
  await saveRef.current({...block.content,document:change.doc,text:change.text});
  if(change.revision===revision.current){try{if(localStorage.getItem(draftKey)===JSON.stringify(change.doc))localStorage.removeItem(draftKey)}catch{}setStatus('')}
 }catch{if(change.revision===revision.current){pending.current=change;setStatus('Не сохранено · повторить')}}})};
 const flushRef=useRef(flush);flushRef.current=flush;
 const position=(reveal=false)=>{if(frame.current)cancelAnimationFrame(frame.current);frame.current=requestAnimationFrame(()=>{
  const ed=editorRef.current;if(!ed||ed.isDestroyed)return;
  try{let caret=ed.view.coordsAtPos(ed.state.selection.head);const viewport=window.visualViewport;
   const bottom=(viewport?.height||window.innerHeight)+(viewport?.offsetTop||0);const top=(viewport?.offsetTop||0)+100;
   // Reserve room for the contextual controls above the on-screen keyboard/navigation.
   const nav=document.querySelector('.bottom-nav')?.getBoundingClientRect();const usableBottom=nav&&nav.height&&nav.top>top?Math.min(bottom,nav.top):bottom;
   if(reveal&&ed.isFocused){const delta=caret.bottom>usableBottom-76?caret.bottom-(usableBottom-76):caret.top<top?caret.top-top:0;if(delta){window.scrollBy({top:delta,behavior:'instant'});caret=ed.view.coordsAtPos(ed.state.selection.head)}}
   const width=Math.min(288,(viewport?.width||window.innerWidth)-24);const left=Math.max(12,Math.min(caret.left,(viewport?.width||window.innerWidth)-width-12));
   setAnchor({top:caret.bottom+8,left,width});setEmpty(ed.isEmpty);
  }catch{}
 })};
 const editor=useEditor({extensions:[StarterKit.configure({link:{openOnClick:false,protocols:['https','http','mailto']}}),TaskList,TaskItem.configure({nested:true,HTMLAttributes:{'data-type':'taskItem'},a11y:{checkboxLabel:node=>'Выполнено: '+(node.textContent||'пункт чеклиста')}}),Details.configure({persist:true}),DetailsSummary,DetailsContent],content:initial(),
  editorProps:{attributes:{class:'task-document','aria-label':'Содержимое задачи','aria-multiline':'true',spellcheck:'true'},handleKeyDown:(view,e)=>{if(e.key==='Escape'){setMenu(false);setLink(null);return false}if(e.key==='/'&&!e.isComposing&&!e.ctrlKey&&!e.metaKey&&view.state.selection.$from.parentOffset===0){setMenu(true);position(true);e.preventDefault();return true}return false}},
  onCreate:({editor})=>{editorRef.current=editor;setEmpty(editor.isEmpty)},
  onFocus:()=>{setFocused(true);position(true)},onSelectionUpdate:()=>position(true),
  onUpdate:({editor})=>{const doc=editor.getJSON();pending.current={doc,text:editor.getText(),revision:++revision.current};try{localStorage.setItem(draftKey,JSON.stringify(doc))}catch{}setStatus('Черновик');if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>flushRef.current(),700);position(true)},
  onBlur:({event})=>{flushRef.current();const target=event.relatedTarget as Element|null;if(!target?.closest?.('[data-editor-owner="'+block.id+'"]')){setFocused(false);setMenu(false);setLink(null)}}
 });
 editorRef.current=editor;
 useEffect(()=>{const leave=()=>flushRef.current();const visibility=()=>{if(document.visibilityState==='hidden')leave()};window.addEventListener('pagehide',leave);window.addEventListener('online',leave);document.addEventListener('visibilitychange',visibility);return()=>{leave();if(frame.current)cancelAnimationFrame(frame.current);window.removeEventListener('pagehide',leave);window.removeEventListener('online',leave);document.removeEventListener('visibilitychange',visibility)}},[]);
 useEffect(()=>{if(!focused)return;const track=()=>position(),reveal=()=>position(true);window.addEventListener('scroll',track,true);window.addEventListener('resize',reveal);window.visualViewport?.addEventListener('resize',reveal);window.visualViewport?.addEventListener('scroll',track);return()=>{window.removeEventListener('scroll',track,true);window.removeEventListener('resize',reveal);window.visualViewport?.removeEventListener('resize',reveal);window.visualViewport?.removeEventListener('scroll',track)}},[focused]);
 useEffect(()=>{if(!editor||revision.current)return;try{if(localStorage.getItem(draftKey)){pending.current={doc:editor.getJSON(),text:editor.getText(),revision:++revision.current};flushRef.current()}}catch{}},[editor]);
 if(!editor)return null;
 const command=(fn:()=>unknown)=>{fn();setMenu(false);position()};
 const commands:Array<[string,string,()=>unknown]>=[['Текст','type',()=>editor.chain().focus().setParagraph().run()],['Заголовок','hash',()=>editor.chain().focus().toggleHeading({level:2}).run()],['Список','list',()=>editor.chain().focus().toggleBulletList().run()],['Нумерация','list',()=>editor.chain().focus().toggleOrderedList().run()],['Чеклист','check-square',()=>editor.chain().focus().toggleTaskList().run()],['Раскрывающийся список','down',()=>editor.chain().focus().setDetails().run()],['Цитата','book-open',()=>editor.chain().focus().toggleBlockquote().run()],['Разделитель','more',()=>editor.chain().focus().setHorizontalRule().run()]];
 const viewportBottom=(window.visualViewport?.height||window.innerHeight)+(window.visualViewport?.offsetTop||0);
 const controls=focused&&anchor.top>0&&anchor.top<viewportBottom-12&&<div data-editor-owner={block.id} className="editor-controls" style={{position:'fixed',top:anchor.top,left:anchor.left,width:anchor.width}} onMouseDown={e=>{if(!(e.target instanceof HTMLInputElement))e.preventDefault()}} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();setMenu(false);setLink(null);editor.commands.focus()}}}>
  <div className="editor-insert-bar" role="toolbar" aria-label="Формат текущей строки">
   <button type="button" aria-label="Вставить в текущую строку" title="Добавить блок · /" aria-expanded={menu} onClick={()=>{setMenu(v=>!v);position(true)}}><Icon name="plus" size={17}/><span>Блок</span><kbd>/</kbd></button>
   <span className="editor-tool-divider"/>
   <button type="button" aria-label="Жирный" aria-pressed={editor.isActive('bold')} onClick={()=>command(()=>editor.chain().focus().toggleBold().run())}><b>B</b></button>
   <button type="button" aria-label="Курсив" aria-pressed={editor.isActive('italic')} onClick={()=>command(()=>editor.chain().focus().toggleItalic().run())}><i>I</i></button>
   <button type="button" aria-label="Ссылка" onClick={()=>setLink(editor.getAttributes('link').href||'')}><Icon name="arrow-up-right" size={17}/></button>
  </div>
  {menu&&<div className="editor-block-menu" role="group" aria-label="Выбор блока" style={{maxHeight:Math.max(100,Math.min(320,viewportBottom-anchor.top-60))}}>{commands.map(([label,icon,fn])=><button type="button" key={label} onClick={()=>command(fn)}><Icon name={icon} size={17}/>{label}</button>)}{onInsertBlock&&<><div className="editor-menu-label">Инструменты задачи</div>{([['pipeline','Pipeline'],['image','Изображение'],['database','База данных'],['page_link','Ссылка на страницу']] as const).map(([type,label])=><button type="button" key={type} onClick={async()=>{flushRef.current();setMenu(false);await queue.current;if(!pending.current)onInsertBlock(type)}}><Icon name={type==='pipeline'?'list':type==='database'?'dashboard':'plus'} size={17}/>{label}</button>)}</>}</div>}
  {link!==null&&<form className="editor-link-form" onSubmit={e=>{e.preventDefault();if(/^(https?:\/\/|mailto:)/i.test(link)){editor.chain().focus().setLink({href:link}).run();setLink(null)}}}><input autoFocus aria-label="Адрес ссылки" placeholder="https://…" value={link} onChange={e=>setLink(e.target.value)}/><button type="submit" disabled={!/^(https?:\/\/|mailto:)/i.test(link)}>Добавить</button></form>}
 </div>;
 return <div className={'task-document-wrap '+(empty?'is-empty ':'')+(focused?'is-editing':'')} onClick={e=>{if(e.target===e.currentTarget)editor.commands.focus('end')}}>
  {empty&&<span className="task-document-placeholder" aria-hidden="true">Напиши текст или нажми / для выбора блока</span>}
  <EditorContent editor={editor}/>
  {status.startsWith('Не сохранено')&&<button className="task-save-status" type="button" onClick={flush} role="alert">{status}</button>}
  {focused&&<span className="editor-save-hint" role="status">{status||'Сохранено'}</span>}
  {controls&&createPortal(controls,document.body)}
 </div>;
}
