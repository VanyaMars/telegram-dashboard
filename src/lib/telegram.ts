export type TelegramWebApp={initData:string;initDataUnsafe?:{user?:{first_name?:string;id?:number}};ready?:()=>void;expand?:()=>void;setHeaderColor?:(c:string)=>void;setBackgroundColor?:(c:string)=>void;HapticFeedback?:{impactOccurred?:(t:string)=>void;notificationOccurred?:(t:string)=>void};BackButton?:{show?:()=>void;hide?:()=>void;onClick?:(fn:()=>void)=>void;offClick?:(fn:()=>void)=>void}};
declare global{interface Window{Telegram?:{WebApp:TelegramWebApp}}}
export const telegram=():TelegramWebApp|undefined=>window.Telegram?.WebApp;
export const initData=()=>telegram()?.initData||'';
export function setupTelegram(){const app=telegram();try{app?.ready?.();app?.expand?.();app?.setHeaderColor?.('#F7F8FC');app?.setBackgroundColor?.('#F7F8FC');}catch{/* old clients */}}
export function haptic(type:'light'|'medium'='light'){try{telegram()?.HapticFeedback?.impactOccurred?.(type);}catch{/* old clients */}}
