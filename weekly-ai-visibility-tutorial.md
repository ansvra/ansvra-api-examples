# Build a weekly AI visibility report in Google Sheets with the Ansvra API

A visibility report needs the answer count behind the percentage. The week a brand appeared in 8 of 20 saved AI answers, its visibility was 40%. If it appeared in 3 of 12 the preceding week, visibility was 25%. Before explaining the change to a client, check which prompts and platforms produced those answers.

This walkthrough uses the [Ansvra AI Visibility API](https://ansvra.com/product/ai-visibility-api/) and n8n to bring both weeks, the usable answer counts, and supporting citation URLs into Google Sheets. The numbers above are fictional. The workflow reads saved results from one project on an active paid Ansvra account.

## 1. Choose a project and create a read key

In Ansvra, an account Admin can create a key after a recent sign-in. Open **Settings → Access settings → Customer data**, choose **Read saved information**, and restrict the key to the project you want to report on. Keep the key in an n8n credential or a secret manager.

List accessible projects first. Choose the ID explicitly when configuring the workflow, even if only one project is returned.

```sh
curl --fail-with-body \
  -H "Authorization: Bearer $ANSVRA_ACCESS_KEY" \
  'https://app.ansvra.com/api/customer/v1/projects'
```

When `pagination.hasMore` is true, pass the returned `pagination.nextCursor` as `cursor` to read another page. The [Customer API documentation](https://app.ansvra.com/documentation/customer-api) has examples for permissions, pagination, and errors.

## 2. Compare completed weeks

The workflow finds the current Monday in UTC and reads the two Monday–Sunday periods before it. It passes the same market, language and prompt type to both the overview and the citations report. It uses all tracked prompt types. If you choose specific platforms, use the same list each week.

Each row includes brand and competitor visibility, usable answer counts from both reports, diagnostics, and up to five URLs cited during the week. Up to five makes the Sheet practical to review. To investigate deeper, read subsequent pages from the citations report or open the relevant project in Ansvra.

## 3. Import and run it twice

Download the workflow in the [Ansvra examples repository](https://github.com/ansvra/ansvra-api-examples/tree/main/n8n). Its [README](https://github.com/ansvra/ansvra-api-examples) contains the exact header row to paste into a dedicated worksheet.

In n8n, set the project ID and Google spreadsheet ID in **Set project and sheet**, then confirm the destination tab name. For the three Ansvra requests, select a **Header Auth** credential with the `Authorization` header set to `Bearer` followed by your key. Connect your Google Sheets credential and check that **Append or update weekly rows** matches on `report_key`.

Run it manually. Look for two rows with distinct week-start dates. Run it again during the same week. The workflow should update those rows because the key includes the project, market, language, platforms, prompt type, and week start. Once you have checked both runs, activate the Monday 09:00 UTC schedule. Avoid overlapping runs for the same project and scope.

## 4. Read the coverage before reporting movement

Start with the `coverage` and usable-answer columns. A partial date range, missing visibility, or a week without usable answers needs a blank metric cell. A recorded 0% is a defined measurement. If the two reports show different answer counts, investigate their coverage before comparing. Check prompt and platform coverage across weeks even when the totals match.

That gives reviewers a direct route from a weekly number to a cited page, with enough context to decide whether the change belongs in a client brief. The examples repository includes fictional JSON responses you can inspect before connecting your own project.
