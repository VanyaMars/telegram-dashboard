/**
 * Personal OS goal document v1.
 * Existing server stores descriptions/notes but has no typed goal-property
 * columns. This versioned suffix persists user-defined fields using existing
 * ownership-protected os8/dashboard writes, without SQL migrations.
 * Invalid/legacy descriptions are always returned verbatim, never discarded.
 */
import {dateInZone} from './date';
export type GoalFieldType='number'|'percent'|'text'|'checkbox'|'date'|'select';
export type GoalField={
 id:string;label:string;type:GoalFieldType;value:string;
 start?:string;target?:string;unit?:string;options?:string[];featured?:boolean;
};
export type GoalDocument={body:string;closedAt:string|null;previousProgress?:number;fields:GoalField[]};
const MARKER='\n\n[PERSONAL_OS_GOAL_DOCUMENT_V1]\n';
const types:GoalFieldType[]=['number','percent','text','checkbox','date','select'];
export const emptyGoalDocument=():GoalDocument=>({body:'',closedAt:null,fields:[]});
export function readGoalDocument(raw:string|undefined|null):GoalDocument{
 const input=raw||'',at=input.lastIndexOf(MARKER);
 if(at<0)return {...emptyGoalDocument(),body:input};
 try{
  const parsed=JSON.parse(input.slice(at+MARKER.length));
  if(parsed?.version!==1||!Array.isArray(parsed.fields)||parsed.fields.length>24)throw Error('Not our document');
  const fields:GoalField[]=parsed.fields.filter((f:any)=>f&&typeof f.id==='string'&&typeof f.label==='string'&&types.includes(f.type)).map((f:any)=>({
   id:f.id.slice(0,80),label:f.label.slice(0,100),type:f.type,
   value:typeof f.value==='string'?f.value.slice(0,400):'',
   start:typeof f.start==='string'?f.start.slice(0,60):'',
   target:typeof f.target==='string'?f.target.slice(0,60):'',
   unit:typeof f.unit==='string'?f.unit.slice(0,30):'',
   options:Array.isArray(f.options)?f.options.filter((x:any)=>typeof x==='string').slice(0,12).map((x:string)=>x.slice(0,80)):[],
   featured:f.featured===true
  }));
  return {body:input.slice(0,at),closedAt:typeof parsed.closedAt==='string'&&!Number.isNaN(Date.parse(parsed.closedAt))?parsed.closedAt:null,
   previousProgress:Number.isFinite(parsed.previousProgress)?Math.max(0,Math.min(100,parsed.previousProgress)):undefined,
   fields:fields.map((f,i)=>({...f,featured:i<24&&f.featured})).map((f,i,a)=>({...f,featured:f.featured&&a.slice(0,i).filter(v=>v.featured).length<2}))};
 }catch{return {...emptyGoalDocument(),body:input}}
}
export function writeGoalDocument(doc:GoalDocument){
 const body=doc.body||'';
 if(!doc.closedAt&&!doc.fields.length&&doc.previousProgress===undefined)return body;
 const featured=doc.fields.filter(f=>f.featured);
 if(featured.length>2)throw new Error('На карточке можно показать не больше двух показателей.');
 if(doc.fields.length>24)throw new Error('Допустимо не больше 24 показателей для одной цели.');
 const result=body+MARKER+JSON.stringify({
  version:1,closedAt:doc.closedAt,previousProgress:doc.previousProgress,fields:doc.fields
 });
 if(result.length>5900)throw new Error('Слишком много текста в показателях. Укороти названия или описание.');
 return result;
}
export function goalFieldProgress(field:GoalField):number|null{
 if(field.type==='checkbox')return field.value==='true'?100:0;
 if(field.type==='percent'){
  const n=Number(field.value);
  return field.value.trim()!==''&&Number.isFinite(n)?Math.max(0,Math.min(100,n)):null;
 }
 if(field.type!=='number'||!field.target?.trim()||!field.start?.trim()||!field.value.trim())return null;
 const start=Number(field.start),target=Number(field.target),current=Number(field.value);
 if(![start,target,current].every(Number.isFinite)||start===target)return null;
 return Math.max(0,Math.min(100,Math.round((current-start)/(target-start)*100)));
}
export const metricAverage=(fields:GoalField[])=>{
 const values=fields.map(goalFieldProgress).filter((x):x is number=>x!==null);
 return values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length):null;
};
export function combinedGoalProgress(parts:Array<number|null|undefined>,fallback=0){
 const usable=parts.filter((n):n is number=>typeof n==='number'&&Number.isFinite(n));
 return usable.length?Math.round(usable.reduce((a,b)=>a+b,0)/usable.length):Math.round(fallback);
}
export function goalAgeDays(createdAt:string|undefined,endedAt:string|null,today:string,tz:string){
 if(!createdAt)return null;
 const local=(value:string)=>{try{
  return dateInZone(new Date(value),tz);
 }catch{return value.slice(0,10)}};
 const first=local(createdAt),last=endedAt?local(endedAt):today;
 const start=Date.parse(first+'T12:00:00Z'),end=Date.parse(last+'T12:00:00Z');
 if(!Number.isFinite(start)||!Number.isFinite(end))return null;
 return Math.max(1,Math.floor((end-start)/86400000)+1);
}
export const formatGoalField=(f:GoalField)=>{
 if(f.type==='checkbox')return f.value==='true'?'Да':'Нет';
 if(!f.value.trim())return '—';
 if(f.type==='number'||f.type==='percent'){
  const n=Number(f.value);
  return Number.isFinite(n)?new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n)+(f.type==='percent'?'%':f.unit?' '+f.unit:''):'—';
 }
 if(f.type==='date'){const d=Date.parse(f.value+'T12:00:00Z');return Number.isFinite(d)?new Date(d).toLocaleDateString('ru-RU',{timeZone:'UTC'}):'—'}
 return f.value;
};
