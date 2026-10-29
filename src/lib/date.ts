export const initialTimezone=()=>{
  try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'Europe/Moscow';}catch{return 'Europe/Moscow';}
};
export const dateInZone=(date:Date,tz:string):string=>{
  try{
    const parts=new Intl.DateTimeFormat('en-GB',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
    const get=(k:string)=>parts.find(p=>p.type===k)?.value||'';
    return `${get('year')}-${get('month')}-${get('day')}`;
  }catch{return date.toISOString().slice(0,10);}
};
export const dateAdd=(s:string,n:number):string=>new Date(Date.parse(`${s}T12:00:00Z`)+n*86400000).toISOString().slice(0,10);
export const mondayOf=(s:string)=>dateAdd(s,-((new Date(s+'T12:00:00Z').getUTCDay()+6)%7));
export const monthStart=(s:string)=>s.slice(0,7)+'-01';
export const monthDays=(s:string)=>new Date(Date.UTC(+s.slice(0,4),+s.slice(5,7),0)).getUTCDate();
export const shortDay=(s:string)=>new Date(s+'T12:00:00Z').toLocaleDateString('ru-RU',{day:'numeric',month:'short',timeZone:'UTC'});
export const prettyDay=(s:string)=>new Date(s+'T12:00:00Z').toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long',timeZone:'UTC'});
export const weekDates=(monday:string)=>Array.from({length:7},(_,i)=>dateAdd(monday,i));
export const score=(important:number,doneImportant:number,extras:number,doneExtras:number)=>
  (important?Math.round(doneImportant*100/important):0)+(extras?Math.round(doneExtras*100/extras):0);
export const progress=(done:number,total:number)=>total?Math.min(100,Math.round(done/total*100)):0;
export const goalProgress=(goal:{start_value:number;target_value:number;current_value:number})=>{
  const range=Number(goal.target_value)-Number(goal.start_value);
  if(!range)return 0;
  return Math.min(100,Math.max(0,Math.round((Number(goal.current_value)-Number(goal.start_value))/range*100)));
};
export const metricRange=(monday:string)=>({start:dateAdd(monday,-7),end:dateAdd(monday,6)});
export const money=(n:number,c='RUB')=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n)+' '+c;
