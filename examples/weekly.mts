import { completedWeeks, reportQuery, sheetRow } from "./reporting.mjs";

const baseUrl = "https://app.ansvra.com/api/customer/v1";
const token = process.env.ANSVRA_ACCESS_KEY;
const projectId = process.argv[2];
if (!token) throw new Error("Set ANSVRA_ACCESS_KEY to your project-scoped read key.");

async function read(path: string) {
  const response = await fetch(baseUrl + path, {
    headers: { Authorization: `Bearer ${token}` },
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Ansvra returned HTTP ${response.status}.`);
  const result = await response.json();
  if (result.meta?.resultScope !== "saved") throw new Error("Expected saved Ansvra results.");
  return result;
}

if (!projectId) {
  const seen = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await read("/projects" + (cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""));
    for (const { id, name } of page.data) console.log(JSON.stringify({ id, name }));
    cursor = page.pagination?.hasMore ? page.pagination.nextCursor : undefined;
    if (page.pagination?.hasMore && (!cursor || seen.has(cursor))) {
      throw new Error("The project list returned an invalid next cursor.");
    }
    if (cursor) seen.add(cursor);
  } while (cursor);
} else {
  const path = `/projects/${encodeURIComponent(projectId)}`;
  const { data: project } = await read(path);
  const config = {
    projectId,
    market: project.market,
    language: project.language,
    platforms: process.env.ANSVRA_PLATFORMS ?? "",
  };
  for (const period of completedWeeks()) {
    const overview = await read(`${path}/reports/overview?${reportQuery(config, period, "overview")}`);
    const citations = await read(`${path}/reports/citations?${reportQuery(config, period, "citations")}`);
    console.log(JSON.stringify(sheetRow(config, period, overview.data, citations.data)));
  }
}
