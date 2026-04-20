# 07 Open-Source Evidence

## Repository URL

The Git remote in the local repository points to:

- `https://github.com/KevinT31/AeroGenIoT`

For the regional competition package, Aurora Noctua should be documented against that repository unless the team intentionally publishes from a different final URL before ZIP assembly.

## Required Screenshot

The competition package should include a screenshot that shows:

- the repository is publicly accessible or open-sourced
- the repository name
- the owner or organization
- the visible file tree or repository landing page

Recommended filename:

- `open-source-repository-screenshot.png`

Recommended path inside this repository before final ZIP packaging:

- `docs/submission/assets/open-source-repository-screenshot.png`

## What the Screenshot Should Show

At minimum, capture:

- repository home page
- branch selector or default branch visible
- file tree visible
- public visibility or accessible repository page

If possible, also capture:

- latest commit summary
- repository URL bar
- release or tag section if one exists

## Current Status

The repository URL has been identified, but no screenshot image was found in the codebase.

## Final Evidence Checklist

| Item | Status | Notes |
| --- | --- | --- |
| GitHub repository URL identified | Yes | `https://github.com/KevinT31/AeroGenIoT` |
| Public or open-source screenshot added | No | Add the screenshot PNG before final ZIP export |
| Commit hash documented in submission package | No | Record the final pushed commit hash at packaging time |
| Release or tag documented | No | Create a release tag if the team wants stronger packaging evidence |

## Recommended Final Additions

Before the final ZIP export:

1. open the published repository page in a browser
2. take a clean screenshot
3. save it as `docs/submission/assets/open-source-repository-screenshot.png`
4. record the final commit hash using `git rev-parse HEAD`
5. optionally create a release tag for the competition package
