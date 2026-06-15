# PDF Translation Study Tool

[日本語](README.md)

A static browser app for analyzing and translating uploaded PDFs, then downloading the result as study HTML.
Gemini API calls are made directly from the user's browser with the user's own Gemini Key.

## Scope

This folder is intended to be a standalone project. It does not depend on the parent workspace at runtime.

## Development

```powershell
npm test
npm start
```

The current MVP is designed for static hosting. No server-side API or build step is required.

## Static Hosting

Serve the `src/` directory as static files. No build step is required for the current MVP.

## GitHub Pages

This repository includes a GitHub Actions workflow for GitHub Pages.
The workflow runs the test suite and deploys the `src/` directory directly.

1. Push this repository to GitHub.
2. In GitHub, open `Settings` -> `Pages`.
3. Under `Build and deployment`, set `Source` to `GitHub Actions`.
4. Push to `main`, or run the `Deploy GitHub Pages` workflow manually from the `Actions` tab.

The app uses relative asset paths, so it works from a project Pages URL such as `https://USER.github.io/REPOSITORY/`.
