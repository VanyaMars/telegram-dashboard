/** Shared, UI-only saving indicators. Never stores document content or credentials. */
export type SavePhase='saving'|'saved'|'error';
const active=new Map<string,Exclude<SavePhase,'saved'>>();
export function reportSaveState(key:string,phase:SavePhase){
 if(phase==='saved')active.delete(key);
 else active.set(key,phase);
 if(typeof window!=='undefined')window.dispatchEvent(new Event('prodesk:save-state'));
}
export function readSaveState():SavePhase{
 if([...active.values()].includes('error'))return 'error';
 if(active.size)return 'saving';
 return 'saved';
}
export const retrySaveEvent='prodesk:retry-save';
