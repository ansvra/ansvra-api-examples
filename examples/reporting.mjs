export function completedWeeks(now = new Date()) {
  const day = 86_400_000;
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const monday = midnight - ((now.getUTCDay() + 6) % 7) * day;
  const date = (offset) => new Date(monday + offset * day).toISOString().slice(0, 10);
  return [
    { from: date(-14), to: date(-8) },
    { from: date(-7), to: date(-1) },
  ];
}

export function reportQuery(config, period, kind) {
  const query = Object.entries({ ...period, market: config.market, language: config.language, promptType: "all" });
  const platforms = [...new Set(config.platforms.split(",").map((value) => value.trim()).filter(Boolean))].sort();
  if (kind === "citations") {
    for (const platform of platforms) query.push(["platform", platform]);
    query.push(["view", "pages"]);
  } else if (platforms.length) {
    query.push(["platforms", platforms.join(",")]);
  }
  return query.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&");
}

export function sheetRow(config, period, overview, citations) {
  const scope = overview.scope;
  const citationScope = citations.scope;
  if (!scope || !citationScope) throw new Error("A report is missing its resolved scope.");
  const platforms = [...new Set(config.platforms.split(",").map((value) => value.trim()).filter(Boolean))].sort();
  const samePlatforms = (value) => Array.isArray(value) &&
    JSON.stringify([...value].sort()) === JSON.stringify(platforms);
  if ([scope, citationScope].some((value) => value.market !== config.market ||
    value.language !== config.language || value.timezone !== "UTC" ||
    value.promptType !== "all" || !samePlatforms(value.platforms))) {
    throw new Error("Resolved filters differ from the requested reporting scope.");
  }
  const fullPeriod = !scope.historyUnavailable && !citationScope.historyUnavailable &&
    scope.start === period.from && scope.end === period.to &&
    citationScope.from === period.from && citationScope.to === period.to;
  const own = overview.brands?.find((brand) => brand.own);
  const status = !fullPeriod ? "Partial or unavailable date range"
    : !overview.usable ? "No usable answers"
    : overview.usable !== citations.summary?.usable ? "Report answer counts differ"
    : (overview.diagnostics ?? 0) > 0 ? "Usable answers with diagnostics"
    : "Usable answers available";
  return {
    report_key: JSON.stringify([config.projectId, config.market, config.language, platforms, "all", period.from]),
    project_id: config.projectId,
    week_from_utc: period.from,
    week_to_utc: period.to,
    market: config.market,
    language: config.language,
    platforms: platforms.join(",") || "all",
    coverage: status,
    overview_usable_answers: overview.usable ?? "",
    citation_usable_answers: citations.summary?.usable ?? "",
    diagnostics: overview.diagnostics ?? "",
    brand_visibility_pct: fullPeriod && overview.usable ? own?.visibility ?? "" : "",
    competitor_visibility_pct: fullPeriod && overview.usable
      ? JSON.stringify((overview.brands ?? []).filter((brand) => !brand.own)
        .map(({ name, visibility }) => ({ name, visibility })))
      : "",
    citation_urls: fullPeriod && citations.summary?.usable
      ? (citations.rows ?? []).map(({ url }) => url).filter((url) => /^https?:\/\//i.test(url)).slice(0, 5).join("\n")
      : "",
  };
}
