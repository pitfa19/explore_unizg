# Usage

Two separate counts. Neither one stores a person, an IP address, or a search query.

## Page views

The site is static HTML, so the page includes the Web Analytics snippet:

```html
<script>
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
</script>
<script defer src="/_vercel/insights/script.js"></script>
```

Vercel serves `/_vercel/insights/script.js` only after Web Analytics is turned on for the project. A local server will 404 that path; the count appears on a Vercel deployment.

Custom events are not sent. On the [Web Analytics pricing](https://vercel.com/docs/analytics/limits-and-pricing) table, Hobby has no custom events and Pro includes them (two properties each). Copying the MCP URL, switching a client tab, loading a programme, and submitting feedback are therefore not tracked. Page views still count on Hobby, inside the included 50,000 events a month.

### What to click

1. Open the project [horizontal-mobility](https://vercel.com/pitfa19s-projects/horizontal-mobility).
2. Open the [Analytics](https://vercel.com/pitfa19s-projects/horizontal-mobility/analytics) tab.
3. Click **Enable**. Accept the Web Analytics terms if the dialog asks.
4. After this change is on production, open [explore-unizg.vercel.app](https://explore-unizg.vercel.app/) once. Visitors show up on that same Analytics tab. The reporting window on Hobby is one month.

No environment variable is required for page views.

## MCP calls

`POST /api/mcp` writes one JSON object per JSON-RPC call to stdout. A batch is one line per call. `GET` and `OPTIONS` get a line too, with `method` set to the HTTP verb. The fields are only:

```json
{"event":"mcp_call","method":"tools/call","tool":"unizg_courses","client":"Claude Desktop","ok":true,"ms":840}
```

`client` is `clientInfo.name` from the latest `initialize` on that function instance, when the client sent one. It is the product name, not an account. Arguments, course queries, addresses, and emails are not written. There is no database.

### Where to look

1. Open [Logs](https://vercel.com/pitfa19s-projects/horizontal-mobility/logs) for horizontal-mobility.
2. Leave the source on runtime logs for the production deployment.
3. Paste this into the search box:

```text
"event":"mcp_call"
```

Narrower filters, still pasted as text:

```text
"event":"mcp_call" "method":"tools/call"
"event":"mcp_call" "tool":"unizg_courses"
"event":"mcp_call" "ok":false
```

The same text works in the Observability log search. How long a line stays depends on the team's log retention. Nothing else has to be enabled for these lines to appear.
