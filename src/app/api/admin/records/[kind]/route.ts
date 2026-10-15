import { z } from "zod";
import { route, authenticated, jsonResponse } from "@/server/http/auth-handler";
import { readJson } from "@/server/http/body";
import {
  listMembers,
  saveMember,
  memberSchema,
  contentFields,
  listContent,
  saveContent,
} from "@/server/domains/records";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ kind: string }> };
const kinds = z.enum(["anggota", "konten", "galeri", "buku"]);
export function GET(request: Request, { params }: Context) {
  return route(request, async () => {
    const kind = kinds.parse((await params).kind);
    const { principal } = await authenticated(
      request,
      kind === "anggota" ? "members:read" : "content:write",
    );
    return jsonResponse({
      records:
        kind === "anggota"
          ? await listMembers(principal)
          : await listContent(principal, kind),
    });
  });
}
export function POST(request: Request, { params }: Context) {
  return route(request, async (ctx) => {
    const kind = kinds.parse((await params).kind);
    const { principal } = await authenticated(
      request,
      kind === "anggota" ? "members:write" : "content:write",
    );
    if (kind === "anggota")
      return jsonResponse(
        await saveMember(principal, await readJson(request, memberSchema), ctx),
      );
    const schema = z
      .object({
        id: z.uuid().optional(),
        version: z.number().int().positive().optional(),
        fields: contentFields[kind],
        archived: z.boolean().optional(),
      })
      .strict();
    return jsonResponse(
      await saveContent(
        principal,
        kind,
        await readJson(request, schema, 262144),
        ctx,
      ),
    );
  });
}
