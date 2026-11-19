import {verifyWorker} from '@/lib/agent/worker-auth.cjs';
import {runDraftAgentTick} from '@/lib/agent/runner';
export const runtime='nodejs';
export async function POST(request:Request){if(!verifyWorker(Object.fromEntries(request.headers),process.env))return Response.json({error:'Worker authentication required.'},{status:401});try{return Response.json(await runDraftAgentTick(),{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Worker unavailable.'},{status:503});}}
