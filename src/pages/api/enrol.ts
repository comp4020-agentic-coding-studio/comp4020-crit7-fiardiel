import type { APIRoute } from "astro";
import { enrol } from "../../lib/db";

// The whole point of the app: every ticked course arrives in one request as
// repeated `code` fields and is enrolled in one go. The 303 re-renders the
// page from SQLite, so it works with no client-side JavaScript.
export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  enrol(form.getAll("code").map(String));
  return redirect("/", 303);
};
