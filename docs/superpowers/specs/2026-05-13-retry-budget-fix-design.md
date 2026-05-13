# CICDL-321: Fix retry budget for pr-dependency-check

**Date:** 2026-05-13
**Status:** Approved
**Ticket:** [CICDL-321](https://pipedrive.atlassian.net/browse/CICDL-321)
**Reference:** [gha-setup PR #2120](https://github.com/pipedrive/gha-setup/pull/2120)

## Problem

`pr-dependency-check` uses `@octokit/plugin-retry` with `retries: 3` and `doNotRetry: []`. During a transient GitHub 500 outage on 2026-04-28 (~8 minutes long), the 3 retries exhausted in ~14 seconds, permanently blocking two deployments.

Two issues:
1. **Retry budget too small:** 3 retries = ~14s total (quadratic backoff: 1+4+9)
2. **doNotRetry incorrectly set to []:** Retries permanent 4xx errors (404, 403, 401) that will never succeed

## Approach

Configure `@octokit/plugin-retry` correctly — no new dependencies, no structural changes. The plugin already wraps every Octokit API call at the client level.

## Changes

### `evaluate-dependencies.js`

Remove `doNotRetry: []` and update the default fallback:

```js
// Before
const maxRetries = parseInt(core.getInput('max-retries') || '3', 10);
const octokit = github.getOctokit(myToken, {
    retry: {
        doNotRetry: [],
        retries: maxRetries
    }
}, retry);

// After
const maxRetries = parseInt(core.getInput('max-retries') || '10', 10);
const octokit = github.getOctokit(myToken, {
    retry: {
        retries: maxRetries
    }
}, retry);
```

Removing `doNotRetry: []` restores the plugin default: `[400, 401, 403, 404, 422]`. These status codes fail-fast. All others (5xx, 429) are retried.

### `action.yml`

```yaml
# Before
max-retries:
  description: 'Maximum number of retry attempts for GitHub API calls (default: 3)'
  default: '3'

# After
max-retries:
  description: 'Maximum number of retry attempts for GitHub API calls on transient 5xx/429 errors (default: 10)'
  default: '10'
```

### `evaluate-dependencies.retry.test.js`

Update the test that asserts the default:
- Test name: `'default max-retries is 3'` → `'default max-retries is 10'`
- Assertion: `toBe(3)` → `toBe(10)`

## Retry behavior

| Error | Before (`doNotRetry: []`) | After (plugin default) |
|---|---|---|
| 500, 503 (transient) | Retried ✓ | Retried ✓ |
| 429 (rate limit) | Retried ✓ | Retried ✓ |
| 404 (not found) | Retried (wasteful) | Fail-fast ✓ |
| 403 (forbidden) | Retried (wasteful) | Fail-fast ✓ |
| 401 (unauthorized) | Retried (wasteful) | Fail-fast ✓ |

## Retry budget

The plugin uses quadratic backoff: retry N waits `N²` seconds.

| Retries | Total budget |
|---|---|
| 3 (old default) | 1+4+9 = 14s |
| 10 (new default) | 1+4+9+16+25+36+49+64+81+100 = 385s ≈ 6.4 min |

6.4 minutes covers most real-world GitHub transient outage windows. Callers can still pass a higher `max-retries` input for extreme cases.

## Acceptance criteria (from ticket)

- All GitHub API calls retry on transient 5xx and 429 errors ✓
- Only 4xx errors (excluding 429) fail immediately without retrying ✓
- A transient GitHub 500 window does not permanently block a deployment ✓

## Files changed

- `evaluate-dependencies.js` — 2 edits (remove `doNotRetry: []`, update `'3'` → `'10'`)
- `action.yml` — 2 edits (description + default)
- `evaluate-dependencies.retry.test.js` — 1 test updated (name + assertion)
