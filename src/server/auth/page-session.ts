import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveSession } from "./sessions";
export async function pageSession(allowPasswordChange = false) {
  const token =
    (await cookies()).get(
      (process.env.NODE_ENV === "production" ? "__Host-" : "") +
        "wapala.session",
    )?.value || "";
  const principal = await resolveSession(token);
  if (!principal) redirect("/wapala");
  if (principal.mustChangePassword && !allowPasswordChange)
    redirect("/wapala/password");
  return { principal, token };
}
