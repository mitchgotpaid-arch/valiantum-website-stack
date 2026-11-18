import {randomBytes} from 'node:crypto';
import type {SocialToken,SocialAccount} from './oauth';
import type {SocialProvider} from './catalog';
import type {MetaPage,MetaToken} from '@/lib/publishing/meta-client';
export type PendingConnection={userId:string;brandId:string;issuedAt:number;busy?:boolean}&({provider:SocialProvider;token:SocialToken;accounts:SocialAccount[]}|{provider:'META';token:MetaToken;accounts:MetaPage[]});
const globalPending=globalThis as typeof globalThis&{__valiantumPendingSocial?:Map<string,PendingConnection>;__valiantumPendingPurge?:ReturnType<typeof setInterval>};
const pending=globalPending.__valiantumPendingSocial??=new Map<string,PendingConnection>();
function purge(){for(const [key,item] of pending)if(Date.now()-item.issuedAt>600000)pending.delete(key);}
export function createPendingConnection(input:Omit<Extract<PendingConnection,{provider:SocialProvider}>, 'issuedAt'>|Omit<Extract<PendingConnection,{provider:'META'}>,'issuedAt'>){purge();if(pending.size>=30)throw Error('Too many pending connections.');const ticket=randomBytes(32).toString('base64url');pending.set(ticket,{...input,issuedAt:Date.now()} as PendingConnection);return ticket;}
export function getPendingConnection(ticket:string,userId:string){purge();const value=pending.get(ticket);return value?.userId===userId?value:null;}
export function claimPendingConnection(ticket:string,userId:string){const value=getPendingConnection(ticket,userId);if(!value||value.busy)return null;value.busy=true;return value;}
export function releasePendingConnection(ticket:string){const value=pending.get(ticket);if(value)value.busy=false;}
export function deletePendingConnection(ticket:string){pending.delete(ticket);}

if(!globalPending.__valiantumPendingPurge){globalPending.__valiantumPendingPurge=setInterval(purge,30000);globalPending.__valiantumPendingPurge.unref();}
