import { writeFileSync } from "node:fs";
import { completedWeeks, reportQuery, sheetRow } from "./examples/reporting.mjs";

const write = (path, value) =>
  writeFileSync(new URL(path, import.meta.url), JSON.stringify(value, null, 2) + "\n");
const base = "https://app.ansvra.com/api/customer/v1";
const docs = "https://app.ansvra.com/documentation/customer-api";
const landing = "https://ansvra.com/product/ai-visibility-api/";
const article = "https://ansvra.com/articles/what-you-can-build-with-ai-visibility-api/";
const config = { projectId: "project_example", market: "US", language: "en", platforms: "" };
const [prior, current] = completedWeeks(new Date("2026-11-19T12:00:00Z"));
const project = {
  id: config.projectId, workspaceId: "workspace_example", name: "Northwind Lanterns",
  domain: "northwind.example", websiteUrl: "https://northwind.example/",
  market: config.market, targetState: null, language: config.language,
  brandAliases: ["Northwind Lanterns"], domainAliases: [], includeSubdomains: true,
  archived: false, createdAt: "2026-10-01T09:00:00.000Z",
};
const saved = (data, extras = {}) => ({
  data, ...extras, meta: { requestId: "request_example", resultScope: "saved" },
});
const projectList = saved([project], { pagination: { hasMore: false, nextCursor: null } });
const common = { market: "US", language: "en", timezone: "UTC", promptType: "all", platforms: [] };
const overview = (period, usable, visibility) => saved({
  scope: { ...common, projectId: project.id, start: period.from, end: period.to, days: 7 },
  usable, diagnostics: 0, promptCount: 3,
  brands: [
    { id: "own", own: true, name: project.name, usable, visibility },
    { id: "competitor_example", own: false, name: "Trailhead Lamps", usable, visibility: 25 },
  ],
});
const citations = saved({
  scope: { ...common, ...current, view: "pages", page: 1 },
  summary: { usable: 20, occurrences: 3, urls: 1, domains: 1 },
  total: 1, page: 1, pageSize: 50,
  rows: [
    { key: "guide.example/lanterns", url: "https://guide.example/lanterns",
      domain: "guide.example", title: "Choosing a lantern", count: 3, ownership: "other" },
  ],
});
const currentOverview = overview(current, 20, 40);
const priorOverview = overview(prior, 12, 25);
write("./fixtures/reporting.json", {
  projectList, project: saved(project), currentOverview, priorOverview, citations,
  priorCitations: saved({ ...citations.data, scope: { ...citations.data.scope, ...prior },
    summary: { usable: 12, occurrences: 0, urls: 0, domains: 0 }, total: 0, rows: [] }),
});

function postmanItem(name, path, docsId, description, data, query = []) {
  const raw = "{{baseUrl}}/" + path + (query.length
    ? "?" + query.filter((item) => !item.disabled).map(({key, value}) => `${key}=${value}`).join("&")
    : "");
  const request = {
    method: "GET",
    url: { raw, host: ["{{baseUrl}}"], path: path.split("/"), query },
    description: description + `\n\n[Endpoint reference](${docs}/${docsId}).`,
  };
  return {
    name, request,
    response: [{
      name: "200 OK · Fictional saved response (selected fields)",
      originalRequest: request, status: "OK", code: 200, _postman_previewlanguage: "json",
      header: [{ key: "Content-Type", value: "application/json" }],
      body: JSON.stringify(data, null, 2),
    }],
  };
}
function dates(prefix) {
  return [
    { key: "from", value: `{{${prefix}From}}` }, { key: "to", value: `{{${prefix}To}}` },
    { key: "market", value: "{{market}}" }, { key: "language", value: "{{language}}" },
    { key: "promptType", value: "all" },
  ];
}
write("./postman/ansvra-ai-visibility.postman_collection.json", {
  info: {
    name: "Ansvra AI Visibility API",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    description: `Bring saved AI visibility, competitor results and citation evidence into recurring reports. Requires an active paid Ansvra account.

1. In Ansvra, open Settings → Access settings → Customer data. An account Admin can create an access key with Read saved information after a recent sign-in. Restrict it to the project you need.
2. Fork this collection. Create an unshared Postman environment, add ansvraAccessKey and set its local secret value. Keep the collection's key variable empty.
3. List accessible projects. Set projectId to an ID you selected and use the selected project's market and language.
4. Set all four week date variables to two complete Monday–Sunday periods in UTC. Leave them empty to use the last two completed weeks.
5. Read both overview results and the latest week's citations. Check both periods' usable answer counts, diagnostics and resolved scope before comparing percentages. The example uses all prompt types. Null or unavailable measurements should stay blank.

[AI Visibility API](${landing}) · [Customer API reference](${docs}) · [What you can build](${article})`,
  },
  auth: { type: "bearer", bearer: [{ key: "token", value: "{{ansvraAccessKey}}", type: "string" }] },
  event: [{
    listen: "prerequest", script: { type: "text/javascript", exec: [
      completedWeeks.toString(),
      "const [prior, current] = completedWeeks();",
      "for (const [key, value] of Object.entries({ priorFrom: prior.from, priorTo: prior.to, currentFrom: current.from, currentTo: current.to })) {",
      "  if (!pm.variables.get(key)) pm.variables.set(key, value);",
      "}",
    ] },
  }],
  variable: Object.entries({
    baseUrl: base, ansvraAccessKey: "", projectId: "", market: "US", language: "en",
    priorFrom: "", priorTo: "", currentFrom: "", currentTo: "",
  }).map(([key, value]) => ({ key, value, type: "string" })),
  item: [
    postmanItem("1. List accessible projects", "projects", "projects",
      "Choose a project ID from data. If pagination.hasMore is true, enable cursor and paste pagination.nextCursor for the next page.",
      projectList, [{ key: "cursor", value: "", disabled: true }]),
    postmanItem("2. Read the selected project", "projects/{{projectId}}", "project",
      "Copy this project's market and language into the collection variables.", saved(project)),
    postmanItem("3. Read the latest completed week", "projects/{{projectId}}/reports/overview",
      "report-overview", "Read saved brand and competitor visibility alongside the usable answer count.",
      currentOverview, dates("current")),
    postmanItem("4. Read cited pages for the latest week", "projects/{{projectId}}/reports/citations",
      "report-citations", "Inspect the cited page URLs and response counts. Use the page number for subsequent pages.",
      citations, [...dates("current"), { key: "view", value: "pages" }, { key: "page", value: "1" }]),
    postmanItem("5. Read the previous completed week", "projects/{{projectId}}/reports/overview",
      "report-overview", "Compare the two periods only after checking the resolved reporting scope and usable answers.",
      priorOverview, dates("prior")),
  ],
});

const nodes = [];
const connections = {};
function node(name, type, typeVersion, position, parameters) {
  nodes.push({ id: `00000000-0000-4000-8000-${String(nodes.length + 1).padStart(12, "0")}`,
    name, type: "n8n-nodes-base." + type, typeVersion, position, parameters });
}
function link(source, target) {
  connections[source] = { main: [[{ node: target, type: "main", index: 0 }]] };
}
function read(name, x, path) {
  node(name, "httpRequest", 4.2, [x, 80], {
    url: `={{ '${base}' + ${path} }}`,
    authentication: "genericCredentialType", genericAuthType: "httpHeaderAuth",
    options: { redirect: { redirect: { followRedirects: false } }, timeout: 30000 },
  });
}
node("Manual run", "manualTrigger", 1, [0, 0], {});
node("Monday schedule", "scheduleTrigger", 1.2, [0, 160], {
  rule: { interval: [{ field: "weeks", weeksInterval: 1, triggerAtDay: [1], triggerAtHour: 9 }] },
});
node("Set project and sheet", "code", 2, [220, 80], { jsCode: `const config = {
  projectId: "",
  spreadsheetId: "",
  sheetName: "AI visibility",
  platforms: "",
};
if (!config.projectId.trim() || !config.spreadsheetId.trim()) {
  throw new Error("Set your Ansvra project ID and Google spreadsheet ID.");
}
return [{ json: config }];` });
read("Read Ansvra project", 440, "'/projects/' + encodeURIComponent($json.projectId)");
node("Prepare two completed weeks", "code", 2, [660, 80], { jsCode: `
${completedWeeks.toString()}
${reportQuery.toString()}
const project = $input.first().json;
const settings = $("Set project and sheet").first().json;
if (project.meta?.resultScope !== "saved" || project.data?.id !== settings.projectId) {
  throw new Error("The API did not return the selected saved project.");
}
const config = { ...settings, market: project.data.market, language: project.data.language };
return completedWeeks().map((period) => ({
  json: {
    config, period, path: "/projects/" + encodeURIComponent(config.projectId),
    overviewQuery: reportQuery(config, period, "overview"),
    citationQuery: reportQuery(config, period, "citations"),
  }, pairedItem: { item: 0 },
}));` });
read("Read visibility overview", 880, "$json.path + '/reports/overview?' + $json.overviewQuery");
read("Read cited pages", 1100,
  "$('Prepare two completed weeks').item.json.path + '/reports/citations?' + $('Prepare two completed weeks').item.json.citationQuery");
node("Format weekly rows", "code", 2, [1320, 80], { jsCode: `
${sheetRow.toString()}
return $input.all().map(({ json: citations }, index) => {
  const { config, period } = $("Prepare two completed weeks").itemMatching(index).json;
  const overview = $("Read visibility overview").itemMatching(index).json;
  if ([overview, citations].some((result) => result.meta?.resultScope !== "saved")) {
    throw new Error("The API did not return saved results.");
  }
  return { json: sheetRow(config, period, overview.data, citations.data), pairedItem: { item: index } };
});` });
node("Append or update weekly rows", "googleSheets", 4.7, [1540, 80], {
  operation: "appendOrUpdate",
  documentId: { __rl: true, value: '={{ $("Set project and sheet").first().json.spreadsheetId }}', mode: "id" },
  sheetName: { __rl: true, value: '={{ $("Set project and sheet").first().json.sheetName }}', mode: "name" },
  columns: { mappingMode: "autoMapInputData", value: {}, matchingColumns: ["report_key"], schema: [], attemptToConvertTypes: false, convertFieldsToString: false },
  options: { cellFormat: "RAW", handlingExtraData: "error" },
});
node("Setup", "stickyNote", 1, [160, -300], {
  width: 780, height: 300,
  content: `## Weekly AI visibility reporting
1. Set the project ID, spreadsheet ID and tab name. Create the header row from the examples README.
2. Select the same HTTP Header Auth credential on the three Ansvra nodes. Name: Authorization. Value: Bearer followed by your own project-scoped access key.
3. Connect Google Sheets and run manually once. Check both date ranges, coverage and cited URLs. Run again to verify the same keys update.
4. Enable the Monday schedule after setup. It runs at 09:00 UTC.

[Ansvra API documentation](${docs}) · [AI Visibility API](${landing})`,
});
node("Reporting scope", "stickyNote", 1, [405, 280], {
  width: 660, height: 220, color: 5,
  content: `## Read two completed weeks
The project supplies the market and language. Both weeks use matching filters, Monday–Sunday dates in UTC, and all prompt types. The token only needs access to saved information in the selected project.

The two reports have separate usable answer counts. The workflow flags a mismatch so you can inspect coverage before comparing weeks.`,
});
node("Coverage and row updates", "stickyNote", 1, [1100, 280], {
  width: 650, height: 220, color: 4,
  content: `## Check coverage and update the sheet
Check the coverage label and usable answer counts before reporting a change. An unavailable value stays blank and a measured zero stays zero. The first citation page supplies up to five supporting URLs.

The report key includes project, filters, and week start. A run for the same week and reporting scope updates its existing row.`,
});
link("Manual run", "Set project and sheet");
link("Monday schedule", "Set project and sheet");
for (let index = 2; index < 8; index++) link(nodes[index].name, nodes[index + 1].name);
write("./n8n/weekly-ai-visibility-google-sheets.json", {
  name: "Create a weekly AI visibility report in Google Sheets with Ansvra",
  nodes, connections, active: false, settings: { executionOrder: "v1", timezone: "Etc/UTC" },
});
write("./fixtures/sheet-row.json", sheetRow(config, current, currentOverview.data, citations.data));
