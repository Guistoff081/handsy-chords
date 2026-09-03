# Task 1 Report: Bootstrap the Product Design prototype and test harness

Status: DONE

## Completed

- Confirmed the pre-existing prototype repository is on `feature/guitar-practice-prototype`; template bootstrap was intentionally skipped as instructed.
- Installed the requested UI, font, and test dependencies and updated `package-lock.json`.
- Added deterministic Vitest scripts in `package.json`.
- Added the requested jsdom Vitest configuration while preserving existing Vite server and build configuration.
- Added `tests/setup.js` with the required DOM matcher import, `ResizeObserver` mock, and canvas context stub.

## Verification

All required checks passed:

```text
npm test       # passed; no matching unit tests, exit 0
npm run build  # passed; created dist/client/index.html and prepared Sites build
npm run test:sites  # passed; 1/1 Sites worker test
```

## Self-review

- `git diff --check` passed with no whitespace errors.
- Confirmed only the allowed configuration files, the required test setup file, and dependency lockfile changed.
- Confirmed `npm ls --depth=0` resolves all direct dependencies without errors.

## Concern

`npm` reports that esbuild's postinstall script is not covered by the local `allowScripts` policy. The installed dependency tree, tests, and production build all function correctly.
