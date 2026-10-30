export function planDisplay(important:number,doneImportant:number,extra:number,doneExtra:number){
 const mainPercent=important>0?Math.round(Math.min(1,Math.max(0,doneImportant/important))*100):0;
 const extraPercent=extra>0?Math.round(Math.min(1,Math.max(0,doneExtra/extra))*100):0;
 const score=mainPercent+extraPercent;
 // Only completed *important* tasks fill the full bar. Extra tasks recolor it, without growing beyond 100%.
 const phase=mainPercent===100&&extraPercent===100?'pro':mainPercent===100&&extraPercent>0?'boost':'base';
 return {mainPercent,extraPercent,score,phase};
}
