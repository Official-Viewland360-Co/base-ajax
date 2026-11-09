# Examples

Build the bundles first, then serve the repository root (the page loads the
single combined `../dist/baseAjax.all.umd.min.js` file, which exposes the core
and every plugin on `window.BaseAjax`):

```bash
npm run build
npm run serve:examples      # http://localhost:5173/examples/
```

The demo runs twice — once against a `mock()` transport (fully offline) and once
against `jsonplaceholder.typicode.com`. Both wrap the client with
`queue → dedupe → cache → circuitBreaker → trace`, so two identical calls
resolve from a single request.

Buttons:

| Button | What it proves |
| --- | --- |
| **Run request** | `dedupe` collapses two identical GETs into one transport call and `cache` stores the result (both calls resolve to the same reference). |
| **Run unmatched route (404)** | An unmatched `mock()` route resolves `404` at the transport level and the core converts it into an `ApiError` with `code`, `status` and `data`; also exercises `fullResponse`. |
| **Run with bustCache** | `bustCache: true` bypasses the cache for a single request without polluting it. |
| **Reset plugins** | Rebuilds the composed client, clearing cache, breaker state and the last `traceparent`. |

The stats panel below the buttons reads the plugin handles directly:
`client.cache.size()`, `client.inflightSize` (dedupe), `client.queue.active` /
`client.queue.pending`, `client.circuitBreaker.getState()`, plus the
`traceparent` value captured by the `trace` plugin's `onTrace` hook and
`BaseAjax.VERSION`.
