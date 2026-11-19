export class RequestBodyTooLarge extends Error {}
export async function readBriefJson(request: Request, maxBytes = 100000): Promise<unknown> {
  const declared = Number(request.headers.get('content-length') || '0');
  if (!Number.isFinite(declared) || declared < 0 || declared > maxBytes) throw new RequestBodyTooLarge();
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError('Missing JSON body');
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const {done,value} = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {await reader.cancel(); throw new RequestBodyTooLarge();}
      chunks.push(value);
    }
  } finally {reader.releaseLock();}
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {bytes.set(chunk,offset);offset += chunk.byteLength;}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
