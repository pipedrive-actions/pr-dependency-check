# PR Dependency Check Action

This GitHub Action enforces PR dependencies as stated in a PR's opening comment.

The bot parses the first comment of a PR looking for the key phrases "depends on" or "blocked by" followed by an issue number specified by `#` and the issue or PR number (e.g. `#5`).

## Supported link styles

The action can detect links in the following styles:

- Quick Link: `#5`
- Partial Link: `gregsdennis/dependencies-action#5`
- Partial URL: `gregsdennis/dependencies-action/pull/5`
- Full URL: `https://github.com/gregsdennis/dependencies-action/pull/5`
- Markdown: `[markdown link](https://github.com/gregsdennis/dependencies-action/pull/5)`

Works for both issues and PRs!

Also supports custom domains for use with GitHub Enterprise!

## See it in action:

- [PR to be landed first](http://github.com/gregsdennis/dependencies-action/pull/4)
- [PR to be landed second](http://github.com/gregsdennis/dependencies-action/pull/5)

## Example usage

Just add the following to a `.yml` file in your `.github/workflows/` folder.

```yaml
on:
  pull_request_target:
    types: [opened, edited, closed, reopened]

jobs:
  check_dependencies:
    runs-on: ubuntu-latest
    name: Check Dependencies
    steps:
    - uses: gregsdennis/dependencies-action@main
      with:
        custom-domains: my-custom-domain.io another.domain.com
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Retry Behavior

The action automatically retries GitHub API calls that fail due to transient errors (network issues, 5xx responses, rate limiting). This improves reliability when GitHub's API experiences temporary issues.

**Default behavior:**
- 3 retry attempts with exponential backoff
- Retries on: network errors, 5xx server errors, rate limit errors
- Each retry adds ~1-7 seconds of delay

**Custom configuration:**
```yaml
- uses: gregsdennis/dependencies-action@main
  with:
    max-retries: 5  # Override default of 3
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Troubleshooting:**
- Retry attempts are logged in the action output
- If all retries fail, the action will fail with the last error
- Set `max-retries: 0` to disable retries (not recommended)
