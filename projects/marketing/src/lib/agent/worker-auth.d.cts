export function workerKey(env?:Record<string,string|undefined>):string|null;
export function workerHash(env?:Record<string,string|undefined>):string|null;
export function workerHeaders(env?:Record<string,string|undefined>,now?:number):Record<string,string>;
export function verifyWorker(headers:Record<string,string|string[]|undefined>,env?:Record<string,string|undefined>,now?:number):boolean;
