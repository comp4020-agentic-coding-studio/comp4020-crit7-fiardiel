import type { APIRoute } from "astro";
import { enrol } from "../../lib/db";

// The whole point of the app: every ticked course arrives in one request as
// repeated `code` fields and is enrolled in one go. The 303 re-renders the
// page from SQLite, so it works with no client-side JavaScript. A refused
// batch comes back with why, so the page can say so. Permission codes arrive
// as `permit_<COURSE>` fields.
export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const permits: Record<string, string> = {};
  for (const [key, value] of form) {
    if (key.startsWith("permit_")) permits[key.slice("permit_".length)] = String(value);
  }
  const result = enrol(form.getAll("code").map(String), permits);
  if (result.ok) return redirect("/", 303);
  return redirect(
    result.reason === "permission" ? `/?permit=${result.course}` : `/?over=${result.wouldHave}`,
    303,
  );
};
