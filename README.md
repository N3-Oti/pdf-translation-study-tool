# PDF Translation Study Tool

Static browser app for translating uploaded PDFs into downloadable study HTML using the user's Gemini Key.

## Scope

This folder is intended to be a standalone project. It does not depend on the parent workspace at runtime.

## Development

```powershell
npm test
npm start
```

The MVP is designed for static hosting on Cloudflare Pages. Gemini API calls are made directly from the user's browser with their own key.

## Static Hosting

Serve the `src/` directory as static files. No build step is required for the current MVP.

## GitHub Pages

This repository includes a GitHub Actions workflow for GitHub Pages. It runs the test suite and deploys the `src/` directory directly, with no build step.

1. Push this repository to GitHub.
2. In GitHub, open `Settings` -> `Pages`.
3. Under `Build and deployment`, set `Source` to `GitHub Actions`.
4. Push to `main`, or run the `Deploy GitHub Pages` workflow manually from the `Actions` tab.

The app uses relative asset paths, so it works from a project Pages URL such as `https://USER.github.io/REPOSITORY/`.
