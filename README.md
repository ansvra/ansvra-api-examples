# Ansvra AI Visibility API examples

Use saved brand mentions, competitor results, and citation evidence from Ansvra in a recurring report. The Customer API requires an active paid Ansvra account. These examples only read data. The API also supports selected configuration changes.

- [Ansvra AI Visibility API](https://ansvra.com/product/ai-visibility-api/)
- [Customer API authentication and endpoint reference](https://app.ansvra.com/documentation/customer-api)
- [What you can build with the API](https://ansvra.com/articles/what-you-can-build-with-ai-visibility-api/)
- [Connect saved reports to an assistant with MCP](https://app.ansvra.com/documentation/mcp)

## First request

An Ansvra account Admin can create a key after a recent sign-in under **Settings → Access settings → Customer data**. Choose **Read saved information** and restrict the key to the project you need. Store it as `ANSVRA_ACCESS_KEY` in your environment or secret manager.

Import the [Postman collection](postman/ansvra-ai-visibility.postman_collection.json) and set its `ansvraAccessKey` in your local, unshared environment. Use **List accessible projects** to get an ID, then follow the first-week and previous-week requests. Saved examples show fictional responses with selected fields.

The examples below require Python 3.10+ or Node.js 22.18+ with built-in TypeScript support. Run without a project ID to list all accessible projects. Pass an ID explicitly to print the two most recent completed Monday–Sunday weeks in UTC.

```sh
python3 examples/weekly.py
python3 examples/weekly.py YOUR_PROJECT_ID

node examples/weekly.mts
node examples/weekly.mts YOUR_PROJECT_ID
```

The examples use the selected project's market and language and include all prompt types. Set `ANSVRA_PLATFORMS` to a comma-separated list of documented platform identifiers if you want a narrower scope. The overview accepts a comma-separated `platforms` value. The cited-pages example uses repeated `platform` query parameters. The scripts follow the project list cursor and use the first citation page for up to five supporting URLs. Use the report's `page` parameter to retrieve more citations.

## Run the weekly report in n8n

1. Import the [workflow JSON](n8n/weekly-ai-visibility-google-sheets.json) and keep it inactive during setup. In **Set project and sheet**, enter the chosen project ID, the spreadsheet ID from its Google Sheets URL, and the exact destination tab name. The workflow uses the project’s market and language. The optional `platforms` setting follows the same format as the scripts.
2. Put the following header in row 1 of a dedicated worksheet. Paste it as tab-separated text or use **Data → Split text to columns** if it lands in one cell.

```tsv
report_key	project_id	week_from_utc	week_to_utc	market	language	platforms	coverage	overview_usable_answers	citation_usable_answers	diagnostics	brand_visibility_pct	competitor_visibility_pct	citation_urls
```

3. Create a **Header Auth** credential in n8n named for your Ansvra project. Use header name `Authorization` and value `Bearer YOUR_ACCESS_KEY` with your key in place of the placeholder. Assign it to **Read Ansvra project**, **Read visibility overview**, and **Read cited pages**. Connect Google Sheets credentials to **Append or update weekly rows** and confirm `report_key` is the matching column.
4. Run manually and inspect both rows. Run again and confirm the same two keys are updated. Enable the weekly schedule after verification. It runs Mondays at 09:00 UTC. Use one workflow per project and reporting scope and avoid overlapping manual runs for the same scope.

The workflow uses each period's resolved scope and usable answer counts. If a range is incomplete or has no usable answers, it leaves the visibility and citation evidence cells blank where unavailable. A numeric zero remains zero. If answer counts differ between the overview and citations, check both scopes before drawing a conclusion. Even matching counts do not establish that the same prompts were answered. Confirm comparable prompt and platform coverage before treating a change as meaningful. The citation links are cited pages from saved answers.

Run `node --test` to check the fictional examples and workflow transformations. Run `node build-exports.mjs` to regenerate the exports from source.
