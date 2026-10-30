import {request} from './api';
export type TaskIncome={amount:number;currency:'RUB'|'USD'|'EUR';confirmed:boolean;earned_on:string|null};
export type IncomeSummary={totals:Record<string,number>;daily:Record<string,Record<string,number>>;count:number};
export const getTaskIncome=(taskId:string)=>request<{income:TaskIncome|null}>('os9','income_get',{taskId});
export const saveTaskIncome=(taskId:string,income:TaskIncome)=>request('os9','income_save',{taskId,...income});
export const getIncomeSummary=(start:string,end:string)=>request<IncomeSummary>('os9','income_summary',{start,end});
