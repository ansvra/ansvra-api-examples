import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { completedWeeks, reportQuery, sheetRow } from "./examples/reporting.mjs";

const load = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const fixtures = load("./fixtures/reporting.json");
const workflow = load("./n8n/weekly-ai-visibility-google-sheets.json");
const collection = load("./postman/ansvra-ai-visibility.postman_collection.json");
const config = { projectId: "project_example", market: "US", language: "en", platforms: "" };
const now = new Date("2026-11-16T00:01:00Z");
const [prior, current] = completedWeeks(now);

test("completed UTC weeks work on the Monday boundary and across year boundaries", () => {
  assert.deepEqual([prior, current], [
    { from: "2026-11-02", to: "2026-11-08" },
    { from: "2026-11-09", to: "2026-11-15" },
  ]);
  assert.deepEqual(completedWeeks(new Date("2027-01-04T00:00:00Z"))[1], {
    from: "2026-12-28", to: "2027-01-03",
  });
});

test("report filters match, including differently encoded platform parameters", () => {
  const selected = { ...config, platforms: "perplexity,openai,openai" };
  const overview = new URLSearchParams(reportQuery(selected, current, "overview"));
  const citations = new URLSearchParams(reportQuery(selected, current, "citations"));
  for (const key of ["market", "language", "promptType", "from", "to"]) {
    assert.equal(overview.get(key), citations.get(key));
  }
  assert.equal(overview.get("platforms"), "openai,perplexity");
  assert.deepEqual(citations.getAll("platform"), ["openai", "perplexity"]);
});

test("a recorded zero is kept and unavailable measurements stay blank", () => {
  const overview = structuredClone(fixtures.currentOverview.data);
  const citations = fixtures.citations.data;
  overview.brands[0].visibility = 0;
  assert.equal(sheetRow(config, current, overview, citations).brand_visibility_pct, 0);
  overview.usable = 0;
  assert.equal(sheetRow(config, current, overview, citations).brand_visibility_pct, "");
  overview.scope.start = current.to;
  const partial = sheetRow(config, current, overview, citations);
  assert.equal(partial.coverage, "Partial or unavailable date range");
  assert.equal(partial.citation_urls, "");
  assert.throws(() => sheetRow({ ...config, language: "fr" }, current, overview, citations),
    /Resolved filters differ/);
});

test("exported n8n code produces repeatable upsert rows with fictional responses", () => {
  const code = (name) => workflow.nodes.find((node) => node.name === name).parameters.jsCode;
  const match = (items) => ({ itemMatching: (index) => items[index] });
  const FakeDate = class extends Date {
    constructor(...args) { super(...(args.length ? args : [now.getTime()])); }
  };
  const prepare = new Function("$input", "$", "Date", code("Prepare two completed weeks"));
  const weeks = prepare({ first: () => ({ json: fixtures.project }) },
    () => ({ first: () => ({ json: config }) }), FakeDate);
  assert.deepEqual(weeks.map(({ json }) => json.period), [prior, current]);
  const overview = [fixtures.priorOverview, fixtures.currentOverview].map((json) => ({ json }));
  const citations = [fixtures.priorCitations, fixtures.citations].map((json) => ({ json }));
  const format = new Function("$input", "$", code("Format weekly rows"));
  const runs = new Map();
  const sheet = workflow.nodes.find((node) => node.type === "n8n-nodes-base.googleSheets");
  const [key] = sheet.parameters.columns.matchingColumns;
  for (let run = 0; run < 2; run++) {
    const rows = format({ all: () => citations },
      (name) => match(name === "Prepare two completed weeks" ? weeks : overview));
    for (const { json } of rows) runs.set(json[key], json);
  }
  assert.equal(runs.size, 2);
  assert.deepEqual([...runs.values()][1], load("./fixtures/sheet-row.json"));
  assert.equal(sheet.parameters.operation, "appendOrUpdate");
  assert.equal(sheet.parameters.options.cellFormat, "RAW");
  assert.equal(workflow.active, false);
  assert.ok(workflow.nodes.every((node) => !node.credentials));
});

test("Postman examples use only report reads, empty access values, and UTC dates", () => {
  assert.equal(collection.variable.find(({ key }) => key === "ansvraAccessKey").value, "");
  assert.equal(collection.variable.find(({ key }) => key === "projectId").value, "");
  assert.equal(collection.item.length, 5);
  for (const { request, response } of collection.item) {
    assert.equal(request.method, "GET");
    assert.equal(JSON.parse(response[0].body).meta.resultScope, "saved");
  }
  const values = new Map();
  const script = new Function("pm", collection.event[0].script.exec.join("\n"));
  script({ variables: { set: (key, value) => values.set(key, value), get: (key) => values.get(key) } });
  assert.equal(values.size, 4);
  assert.ok([...values.values()].every((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)));
});
