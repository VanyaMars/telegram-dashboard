import {restoreBrowserSession} from './browserLogin';
import {SUPABASE_URL} from './supabase';
import {initData} from './telegram';
import {endBrowserSession,readBrowserSession} from './browserSession';
import {isQAMode,qaRequest} from '../qa/sandbox';
export type FunctionName='dashboard'|'os6'|'os61'|'os7'|'os8'|'os9';
export async function request<T=any>(fn:FunctionName,action:string,fields:Record<string,unknown>={}):Promise<T>{
  if(isQAMode())return qaRequest<T>(fn,action,fields);
  const token=initData();
  const browserSession=token?null:(readBrowserSession()??await restoreBrowserSession())?.token;
  if(!token&&!browserSession)throw new Error('Войди в ProDesk через Telegram.');
  const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),22000);
  try{
    const response=await fetch(`${SUPABASE_URL}/functions/v1/${fn}`,{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...fields,action,initData:token||undefined,browserSession}),signal:ctrl.signal
    });
    const body=await response.json().catch(()=>({}));
    if(response.status===401&&browserSession===readBrowserSession()?.token)endBrowserSession(true);
    if(!response.ok||body.ok!==true)throw new Error(body.error||`Ошибка API ${response.status}`);
    return body as T;
  }catch(e:any){if(e?.name==='AbortError')throw new Error('Сервер не отвечает. Проверь соединение.');throw e;}
  finally{clearTimeout(timer);}
}
