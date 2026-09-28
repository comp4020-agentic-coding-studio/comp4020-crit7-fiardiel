import { JSDOM } from "jsdom";
import { describe, expect, inject, it } from "vitest";

// The week's contract: pick many courses, enrol in all of them with one
// request, and they're still enrolled after a reload. Drives the running app
// over HTTP, so it checks what ships, not how it's built.
const baseUrl = inject("baseUrl");

const post = (path: string, body: URLSearchParams) =>
  fetch(new URL(path, baseUrl), {
    method: "POST",
    headers: { origin: baseUrl },
    body,
    redirect: "manual",
  });

const enrolIn = (...codes: string[]) =>
  post("/api/enrol", new URLSearchParams(codes.map((code) => ["code", code])));

async function enrolledCodes(): Promise<string[]> {
  const html = await (await fetch(baseUrl)).text();
  const doc = new JSDOM(html).window.document;
  return [...doc.querySelectorAll("#enrolled [data-code]")].map(
    (el) => el.getAttribute("data-code") ?? "",
  );
}

describe("enrolment", () => {
  it("enrols in several courses with one request, and they survive a reload", async () => {
    const res = await enrolIn("COMP1100", "COMP1600", "MATH1013");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/");
    expect(await enrolledCodes()).toEqual(
      expect.arrayContaining(["COMP1100", "COMP1600", "MATH1013"]),
    );
  });

  it("enrolling again in a course leaves exactly one enrolment", async () => {
    await enrolIn("COMP2100");
    await enrolIn("COMP2100");
    const codes = await enrolledCodes();
    expect(codes.filter((c) => c === "COMP2100")).toHaveLength(1);
  });

  it("drops a course", async () => {
    await enrolIn("COMP2400");
    const res = await post("/api/drop", new URLSearchParams({ code: "COMP2400" }));
    expect(res.status).toBe(303);
    expect(await enrolledCodes()).not.toContain("COMP2400");
  });

  it("an empty submission changes nothing", async () => {
    const before = await enrolledCodes();
    const res = await post("/api/enrol", new URLSearchParams());
    expect(res.status).toBe(303);
    expect(await enrolledCodes()).toEqual(before);
  });

  it("ignores codes that aren't real courses", async () => {
    const res = await enrolIn("FAKE9999");
    expect(res.status).toBe(303);
    expect(await enrolledCodes()).not.toContain("FAKE9999");
  });

  it("the same code twice in one request is one enrolment", async () => {
    await enrolIn("COMP2310", "COMP2310");
    const codes = await enrolledCodes();
    expect(codes.filter((c) => c === "COMP2310")).toHaveLength(1);
  });

  it("normalises messy codes", async () => {
    await enrolIn(" comp3600 ");
    expect(await enrolledCodes()).toContain("COMP3600");
  });

  it("dropping a course you aren't enrolled in is harmless", async () => {
    const res = await post("/api/drop", new URLSearchParams({ code: "COMP4300" }));
    expect(res.status).toBe(303);
  });
});
