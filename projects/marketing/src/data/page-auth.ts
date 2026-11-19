import 'server-only';
import {redirect} from 'next/navigation';
import {AuthenticationRequiredError,requireUser} from './auth';
import {hasSupabaseEnv} from '@/lib/env';
// Pages redirect before loading private data. APIs keep the typed 401 error.
export async function requirePageUser(){
  if(!hasSupabaseEnv())return;
  try {await requireUser();}
  catch(error){if(error instanceof AuthenticationRequiredError)redirect('/login');throw error;}
}
