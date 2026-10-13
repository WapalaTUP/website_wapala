import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

export async function nativeHandlerServer(handle: (request: Request) => Promise<Response>) {
  const server = createServer(async (incoming, outgoing) => {
    try {
      const chunks: Buffer[]=[];for await(const chunk of incoming)chunks.push(Buffer.from(chunk));
      const headers=new Headers();for(const [key,value] of Object.entries(incoming.headers))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(", "):value);
      const body=Buffer.concat(chunks),request=new Request("http://127.0.0.1"+incoming.url,{method:incoming.method,headers,...(body.length?{body}: {})});
      const response=await handle(request);outgoing.statusCode=response.status;
      for(const [key,value] of response.headers)if(key!=="set-cookie")outgoing.setHeader(key,value);
      if(response.headers.getSetCookie().length)outgoing.setHeader("set-cookie",response.headers.getSetCookie());
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch {outgoing.statusCode=500;outgoing.end("Test HTTP handler failed");}
  });
  await new Promise<void>((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});
  return {url:"http://127.0.0.1:"+(server.address() as AddressInfo).port,close:()=>new Promise<void>((resolve,reject)=>{server.close(error=>error?reject(error):resolve());server.closeAllConnections();})};
}
