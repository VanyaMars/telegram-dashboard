import {initData} from './telegram';
export const SUPABASE_URL='https://lfhqzgmcvfebzcyvdqff.supabase.co';
export type FunctionName='dashboard'|'os6'|'os61'|'os7';
export async function request<T=any>(fn:FunctionName,action:string,fields:Record<string,unknown>={}):Promise<T>{
  const token=initData();if(!token)throw new Error('Открой Personal OS через кнопку Telegram-бота');
  const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),22000);
  try{
    const response=await fetch(`${SUPABASE_URL}/functions/v1/${fn}`,{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,initData:token,...fields}),signal:ctrl.signal
    });
    const body=await response.json().catch(()=>({}));
    if(!response.ok||body.ok!==true)throw new Error(body.error||`Ошибка API ${response.status}`);
    return body as T;
  }catch(e:any){if(e?.name==='AbortError')throw new Error('Сервер не отвечает. Проверь соединение.');throw e;}
  finally{clearTimeout(timer);}
}
