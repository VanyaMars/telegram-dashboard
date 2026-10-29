import type {Task,Goal,Category,OS6Data,GoalPoint} from '../types';
import {dateInZone,dateAdd,initialTimezone} from './date';
export const demoToday=dateInZone(new Date(),initialTimezone());
export const demoCategories:Category[]=[
{id:'cat-work',name:'Работа',color:'#8B84ED',icon:'briefcase',sort_order:100},
{id:'cat-health',name:'Здоровье',color:'#69BFA7',icon:'heart-pulse',sort_order:200},
{id:'cat-life',name:'Быт',color:'#75B9EC',icon:'house',sort_order:300},
{id:'cat-money',name:'Финансы',color:'#E8A277',icon:'wallet',sort_order:400}];
export const demoTasks:Task[]=[
{id:'task-1',title:'Подготовить коммерческое предложение',sphere:'Работа',priority:'important',notes:'',day:demoToday,completed:true,os61_position:1024,os61_category_id:'cat-work'},
{id:'task-2',title:'Закрыть дизайн обложки',sphere:'Работа',priority:'extra',notes:'',day:demoToday,completed:true,os61_position:1024,os61_category_id:'cat-work'},
{id:'task-3',title:'Отправить три предложения клиентам',sphere:'Работа',priority:'extra',notes:'',day:demoToday,completed:true,os61_position:2048,os61_category_id:'cat-work'},
{id:'task-4',title:'Силовая тренировка',sphere:'Здоровье',priority:'extra',notes:'',day:demoToday,completed:true,os61_position:3072,os61_category_id:'cat-health'},
{id:'task-5',title:'Записаться на ТО',sphere:'Быт',priority:'extra',notes:'',day:demoToday,completed:false,os61_position:4096,os61_category_id:'cat-life'},
{id:'task-6',title:'Подвести итоги недели',sphere:'Работа',priority:'extra',notes:'',day:demoToday,completed:false,os61_position:5120,os61_category_id:'cat-work'},
{id:'task-7',title:'Идеи для автомобильного блога',sphere:'Работа',priority:'extra',notes:'Черновик идей и сценариев',day:null,completed:false,os61_position:1024,os61_category_id:'cat-work'},
{id:'task-8',title:'Обновить страховку',sphere:'Быт',priority:'extra',notes:'',day:null,completed:false,os61_position:2048,os61_category_id:'cat-life'}
];
export const demoGoals:Goal[]=[
{id:'goal1',title:'Доход $3 000',sphere:'Финансы',start_value:1500,current_value:2400,target_value:3000,unit:'$',notes:'',deadline:null},
{id:'goal2',title:'Вес 90 кг',sphere:'Здоровье',start_value:107,current_value:100,target_value:90,unit:'кг',notes:'',deadline:null},
{id:'goal3',title:'50 отжиманий',sphere:'Здоровье',start_value:15,current_value:32,target_value:50,unit:'раз',notes:'',deadline:null}];
export const demoGoalHistory:GoalPoint[]=[{id:1,goal_id:'goal1',value:1500,recorded_at:dateAdd(demoToday,-22)},{id:2,goal_id:'goal1',value:2100,recorded_at:dateAdd(demoToday,-12)},{id:3,goal_id:'goal1',value:2400,recorded_at:demoToday}];
export const demoOS6:OS6Data={settings:{tz:initialTimezone(),kpi_cutover:dateAdd(demoToday,-7),target_task:15,target_sale:3,target_sport:3,morning_time:'09:00',evening_time:'21:30',weekly_time:'20:00',reminders_enabled:false},links:[{task_id:'task-3',goal_id:'goal1'}],finance:[{id:'f1',day:demoToday,direction:'income',amount:1200,currency:'USD',category:'Дизайн',note:'',is_sale:true},{id:'f2',day:demoToday,direction:'expense',amount:270,currency:'USD',category:'Подписки',note:'',is_sale:false}],workouts:[{id:'w1',day:demoToday,title:'Силовая тренировка',duration_min:60,notes:''}],weight:[{id:'m1',day:dateAdd(demoToday,-5),kg:101,note:''},{id:'m2',day:demoToday,kg:100,note:''}],repeats:[],challenges:[{id:'ch1',title:'7 дней дисциплины',starts_on:dateAdd(demoToday,-2),ends_on:dateAdd(demoToday,4),target_days:7,note:''}],challengeDays:[{challenge_id:'ch1',day:demoToday}],reviews:[],focus:[],exercises:[],kpiHistory:[]};
