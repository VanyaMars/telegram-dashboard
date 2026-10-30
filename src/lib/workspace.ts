import {request} from './api';
export type BlockType='text'|'heading'|'checklist'|'image'|'divider'|'database'|'pipeline'|'page_link';
export type FieldType='text'|'number'|'status'|'date'|'checkbox'|'select'|'relation';
export type ViewType='table'|'board'|'list'|'calendar';
export type WPage={id:string;parent_id:string|null;title:string;icon:string;created_at?:string;updated_at:string};
export type WBlock={id:string;page_id:string;type:BlockType;position:number;content:Record<string,any>};
export type WSource={id:string;name:string;updated_at:string};
export type WField={id:string;source_id:string;name:string;field_type:FieldType;options:Record<string,any>;position:number};
export type WRecord={id:string;source_id:string;page_id:string;title:string;properties:Record<string,any>;created_at:string};
export type WView={id:string;source_id:string;name:string;view_type:ViewType;config:Record<string,any>;position:number};
export type WSplit={id:string;block_id:string;title:string;position:number};
export type WItem={id:string;split_id:string;title:string;completed:boolean;position:number};
export type WPageResponse={page:WPage;blocks:WBlock[];splits:WSplit[];items:WItem[];record:WRecord|null};
export type WSourceResponse={source:WSource;fields:WField[];views:WView[];records:WRecord[];offset:number;hasMore:boolean};
export type WBoot={pages:WPage[];sources:WSource[]};
export const workspaceRequest = <T=Record<string,unknown>>(action:string,fields:Record<string,unknown>={})=>request<T>('os7',action,fields);
export const pageLink=(id:string)=>`#/page/${id}`;
export const uniqueIds=(list:string[])=>Array.from(new Set(list));
export const splitProgress=(items:Pick<WItem,'completed'>[])=>items.length?Math.round(items.filter(i=>i.completed).length/items.length*100):0;
export const pipelineProgress=(splits:WSplit[],items:WItem[])=>{
  const ids=new Set(splits.map(s=>s.id));const rows=items.filter(i=>ids.has(i.split_id));return splitProgress(rows);
};
export const localDate=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export function calendarDays(year:number,month:number):Array<string|null>{
  const first=(new Date(year,month,1).getDay()+6)%7;const days=new Date(year,month+1,0).getDate();
  return [...Array(first).fill(null),...Array.from({length:days},(_,i)=>localDate(new Date(year,month,i+1)))];
}