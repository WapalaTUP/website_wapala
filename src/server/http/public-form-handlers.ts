import "server-only";
import { route, jsonResponse } from "./auth-handler";
import { readJson } from "./body";
import { readMultipart } from "./multipart";
import { publicFormRequest, publicSubmitSchema, submitPublicForm, publicLookupSchema, lookupPublicForm } from "../domains/public-forms";
import { publicUploadPurposeSchema, registerPublicUpload } from "../media/public-upload";
import { DomainError } from "../errors";
export function handlePublicSubmit(request: Request, _obsoleteVerifier?: unknown) {
  return route(request, async ctx => {
    const owner = await publicFormRequest(request, ctx, "submit");
    return jsonResponse(await submitPublicForm(await readJson(request, publicSubmitSchema, 65536), owner, ctx));
  });
}
export function handlePublicLookup(request: Request, _obsoleteVerifier?: unknown) {
  return route(request, async ctx => {
    const owner = await publicFormRequest(request, ctx, "lookup");
    return jsonResponse(await lookupPublicForm(await readJson(request, publicLookupSchema), owner, ctx));
  });
}
export function handlePublicUpload(request: Request, _obsoleteVerifier?: unknown) {
  return route(request, async ctx => {
    const owner = await publicFormRequest(request, ctx, "uploads");
    const data = await readMultipart(request, 5 * 1024 * 1024 + 65536);
    for (const key of data.keys()) if (!["file","purpose","scope"].includes(key) || data.getAll(key).length !== 1) throw new DomainError("INVALID_INPUT",400);
    const file = data.get("file");
    if (!(file instanceof File)) throw new DomainError("INVALID_INPUT", 400);
    const purpose = publicUploadPurposeSchema.parse(data.get("purpose")), scope = data.get("scope");
    if (typeof scope !== "string") throw new DomainError("INVALID_INPUT",400);
    return jsonResponse(await registerPublicUpload({purpose,scope,owner,bytes:Buffer.from(await file.arrayBuffer()),mime:file.type}),201);
  });
}
