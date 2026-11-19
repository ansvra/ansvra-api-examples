"""List Ansvra projects or print two completed weeks of saved reporting data."""

import argparse
import json
import os
from datetime import datetime, timedelta, timezone
from urllib.error import HTTPError
from urllib.parse import quote, urlencode
from urllib.request import HTTPRedirectHandler, Request, build_opener

BASE_URL = "https://app.ansvra.com/api/customer/v1"


class RejectRedirects(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, new_url):
        return None


def client(key):
    opener = build_opener(RejectRedirects())

    def read(path, query=()):
        url = BASE_URL + path
        if query:
            url += "?" + urlencode(query)
        request = Request(url, headers={"Authorization": f"Bearer {key}"})
        try:
            with opener.open(request, timeout=30) as response:
                result = json.load(response)
        except HTTPError as error:
            raise SystemExit(f"Ansvra returned HTTP {error.code}.") from None
        if result.get("meta", {}).get("resultScope") != "saved":
            raise SystemExit("Expected saved Ansvra results.")
        return result

    return read


def list_projects(read):
    query = ()
    seen = set()
    while True:
        result = read("/projects", query)
        for project in result["data"]:
            print(json.dumps({"id": project["id"], "name": project["name"]}))
        if not result["pagination"]["hasMore"]:
            return
        cursor = result["pagination"].get("nextCursor")
        if not cursor or cursor in seen:
            raise SystemExit("The project list returned an invalid next cursor.")
        seen.add(cursor)
        query = [("cursor", cursor)]


def report_weeks(read, project_id):
    path = "/projects/" + quote(project_id, safe="")
    project = read(path)["data"]
    today = datetime.now(timezone.utc).date()
    monday = today - timedelta(days=today.weekday())
    platforms = sorted({p.strip() for p in os.getenv("ANSVRA_PLATFORMS", "").split(",") if p.strip()})
    for start in (-14, -7):
        first = (monday + timedelta(days=start)).isoformat()
        last = (monday + timedelta(days=start + 6)).isoformat()
        scope = [("from", first), ("to", last), ("market", project["market"]),
                 ("language", project["language"]), ("promptType", "all")]
        overview_query = scope + ([("platforms", ",".join(platforms))] if platforms else [])
        citation_query = scope + [("view", "pages")] + [("platform", value) for value in platforms]
        overview = read(path + "/reports/overview", overview_query)["data"]
        citations = read(path + "/reports/citations", citation_query)["data"]
        overview_scope = overview["scope"]
        citation_scope = citations["scope"]
        if any(s["market"] != project["market"] or s["language"] != project["language"]
               or s["timezone"] != "UTC" or s["promptType"] != "all"
               or sorted(s["platforms"]) != platforms for s in (overview_scope, citation_scope)):
            raise SystemExit("Resolved filters differ from the requested reporting scope.")
        full_period = (
            not overview_scope.get("historyUnavailable")
            and not citation_scope.get("historyUnavailable")
            and (overview_scope["start"], overview_scope["end"]) == (first, last)
            and (citation_scope["from"], citation_scope["to"]) == (first, last)
        )
        print(json.dumps({
            "from": first, "to": last, "fullPeriod": full_period,
            "overviewUsableAnswers": overview["usable"],
            "citationUsableAnswers": citations["summary"]["usable"],
            "diagnostics": overview["diagnostics"],
            "brands": [{"name": b["name"], "visibility": b["visibility"]} for b in overview["brands"]]
                      if full_period and overview["usable"] else [],
            "citationUrls": [row["url"] for row in citations["rows"][:5]]
                            if full_period and citations["summary"]["usable"] else [],
        }))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("project_id", nargs="?")
    args = parser.parse_args()
    key = os.getenv("ANSVRA_ACCESS_KEY")
    if not key:
        parser.error("Set ANSVRA_ACCESS_KEY to your project-scoped read key.")
    read = client(key)
    if args.project_id:
        report_weeks(read, args.project_id)
    else:
        list_projects(read)


if __name__ == "__main__":
    main()
