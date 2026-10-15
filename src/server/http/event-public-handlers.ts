import "server-only";
import { z } from "zod";
import { route, jsonResponse } from "./auth-handler";
import { readJson } from "./body";
import { readMultipart } from "./multipart";
import { assertOrigin } from "../security/csrf";
import { verifyEventFormToken } from "../security/event-form-token";
import { registrationSchema, submitEventRegistration } from "../domains/event-registrations";
import { takeThrottle } from "../security/throttle";
import { registerEventUpload } from "../media/event-upload";
import { DomainError } from "../errors";
const schema = registrationSchema.extend({website:z.string().max(200).default("")});
type Context = {params:Promise<{id:string}>};
export function handleEventRegistration(request:Request,context:Context,_obsoleteVerifier?:unknown) {
  return route(request,async ctx=>{
    assertOrigin(request);
    const {id}=await context.params,t=verifyEventFormToken(request.headers.get("x-event-token")||"");
    const {website,...v}=await readJson(request,schema,1048576);
    if(website || id!==t.eventId || v.eventId!==id || v.revisionId!==t.revisionId)throw new DomainError("INVALID_INPUT",400);
    await takeThrottle("event-submit:"+ctx.ipDigest,100,3600000);
    await takeThrottle("event-submit-owner:"+t.ownerDigest,20,3600000);
    return jsonResponse(await submitEventRegistration(v,t.ownerDigest,ctx),201);
  });
}
export function handleEventUpload(request:Request,context:Context,_obsoleteVerifier?:unknown) {
  return route(request,async ctx=>{
    assertOrigin(request);
    const token=request.headers.get("x-event-token")||"",t=verifyEventFormToken(token),{id}=await context.params;
    if(id!==t.eventId)throw new DomainError("INVALID_INPUT",400);
    await takeThrottle("event-upload:"+ctx.ipDigest,40,3600000);
    await takeThrottle("event-upload-owner:"+t.ownerDigest,20,3600000);
    const form=await readMultipart(request,5*1024*1024+65536),file=form.get("file"),questionId=form.get("questionId");
    if(!(file instanceof File) || typeof questionId!=="string" || form.getAll("file").length!==1 || form.getAll("questionId").length!==1 || [...form.keys()].some(k=>!["file","questionId"].includes(k)))throw new DomainError("INVALID_INPUT",400);
    return jsonResponse(await registerEventUpload({token,questionId,bytes:Buffer.from(await file.arrayBuffer()),mime:file.type},ctx),201);
  });
}
