
____________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________
__________________________________________________________________README____________________________________________________________________________________________________________________________________________________________________________________

# Playwright UK Consent & GA4 Telemetry (`inews.co.uk` & `newscientist.com`)

Automated Playwright suites verifying Consent Management Platform (CMP) journeys, paywall flows, and Google Analytics 4 (`gcs` / `npa`) compliance across `inews.co.uk` and `https://www.newscientist.com/` under UK contexts.

## Suites & Structure

- `tests/analytics-consent.spec.js` (`suite1-mobile-chrome-uk`) — Mobile UK tests on `https://inews.co.uk/category/news/politics` verifying Accept, Reject-to-Subscribe-Lite, and "Go back to Accept" telemetry upgrades (`gcs=G101` → `G111`).
- `tests/dark-mode-consent.spec.js` (`suite2-desktop-chrome-dark-uk`) — Desktop dark-mode UK consent banner and telemetry verification on `https://www.newscientist.com/`.
- `src/pages/PoliticsPage.js` — Page Object encapsulating Sourcepoint CMP interactions and Piano `/subscribe-lite` offer iframes.
- `src/utils/ga4Interceptor.js` — Network interceptor validating `/g/collect` beacon parameters (`en`, `gcs`, `npa`).
- `.github/workflows/playwright.yml` — GitHub Actions workflow running both suites on push/PR with traces and screenshots retained on failure.

## Run Locally

```bash
npm ci
npx playwright install chromium
npx playwright test
## Running Locally

```bash
npm ci
npx playwright install chromium

# Run both suites
npx playwright test

# Run individual suites
npx playwright test --project=suite1-mobile-chrome-uk --headed
npx playwright test --project=suite2-desktop-chrome-dark-uk --headed


____________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________


1. Reducing Reliance on Live Production Sites in CI
Staging + Fixed CMP Config: Run PR checks against staging with a deterministic Sourcepoint campaign ID rather than live A/B experiments.

HAR Replay (page.routeFromHAR): Replay recorded CMP/Piano network responses in PR pipelines for deterministic speed, reserving live production runs for a scheduled nightly smoke job.

GA4 Sink Stubbing: Capture /g/collect payloads in-test and fulfill with 204 No Content so CI avoids external latency and does not pollute live analytics.

2. Triaging Failures: Selector Drift vs. Regression vs. Flake
Flake: Fails once due to slow third-party script/iframe hydration and passes on retry (retries: 2).

Selector Drift: Fails across all retries on locator lookup (TimeoutError / Frame was detached), while the failure screenshot shows the CMP banner or Piano modal still rendered with changed DOM/classes.

Genuine Regression: UI actions succeed, but assertions fail (e.g., gcs stays G101 after Accept, gcs=G111 fires pre-consent, or the banner fails to dismiss).

3. Extending Beyond Emulated Chrome to Other Browsers & Real Devices
Approach: Add webkit and firefox projects in playwright.config.js to test WebKit ITP cookie rules and engine rendering, and connect a cloud device grid (BrowserStack / Sauce Labs) for real iOS Safari and Android Chrome touch/viewport validation.

Trade-Offs: Higher CI duration and device-minute costs, plus increased network/OS flake—best balanced by running headless Chromium + WebKit on PRs and real-device matrices.