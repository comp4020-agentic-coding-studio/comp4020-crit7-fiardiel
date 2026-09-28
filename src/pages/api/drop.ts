import type { APIRoute } from "astro";
import { drop } from "../../lib/db";

export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  drop(String(form.get("code") ?? ""));
  return redirect("/", 303);
};
