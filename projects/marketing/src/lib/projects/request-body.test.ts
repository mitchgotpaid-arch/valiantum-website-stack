import {describe,it,expect} from 'vitest';
import {readBriefJson,RequestBodyTooLarge} from './request-body';
describe('bounded request bodies',()=>{
 it('parses valid UTF-8 JSON',async()=>{expect(await readBriefJson(new Request('https://example.test',{method:'POST',body:'{"body":"hello ☀"}'}))).toEqual({body:'hello ☀'});});
 it('rejects declared oversized and malformed bodies',async()=>{
  await expect(readBriefJson(new Request('https://example.test',{method:'POST',headers:{'content-length':'100001'},body:'{}'}))).rejects.toBeInstanceOf(RequestBodyTooLarge);
  await expect(readBriefJson(new Request('https://example.test',{method:'POST',body:'not json'}))).rejects.toBeInstanceOf(SyntaxError);
 });
 it('counts streamed bytes and cancels even when content length is missing or false',async()=>{
  let cancelled=false;
  const stream=new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('☀'.repeat(40000)));},cancel(){cancelled=true;}});
  const request=new Request('https://example.test',{method:'POST',headers:{'content-length':'2'},body:stream,duplex:'half'} as RequestInit);
  await expect(readBriefJson(request)).rejects.toBeInstanceOf(RequestBodyTooLarge);expect(cancelled).toBe(true);
 });
});
