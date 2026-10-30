import type {Tab} from '../types';
const allowed:readonly Tab[]=['home','today','goals','analytics','income','buffer','calendar','tomorrow','finance','sport','focus','challenges','repeats','review','discipline','settings','categories','help'];
/** Pages retain their existing hash URL, top-level screens use #/tab/{tab}. */
export function tabFromHash(hash:string):Tab{
 if(hash.startsWith('#/page/')||hash==='#/workspace')return 'buffer';
 const match=/^#\/tab\/([a-z]+)$/.exec(hash);
 return match&&allowed.includes(match[1] as Tab)?match[1] as Tab:'home';
}
export function hashForTab(tab:Tab){return tab==='workspace'?'#/workspace':`#/tab/${tab}`;}
const selectedDayKey=()=>new URLSearchParams(location.search).get('qa')==='1'?'personal-os:qa:selected-day:v1':'personal-os:selected-day:v1';
const pattern=/^\d{4}-\d{2}-\d{2}$/;
export function loadSelectedDay(today:string){
 try{const stored=sessionStorage.getItem(selectedDayKey());if(stored&&pattern.test(stored)&&!Number.isNaN(Date.parse(stored+'T12:00:00Z')))return stored}catch{/* storage unavailable */}
 return today;
}
export function rememberSelectedDay(day:string){try{if(pattern.test(day))sessionStorage.setItem(selectedDayKey(),day)}catch{/* storage unavailable */}}
