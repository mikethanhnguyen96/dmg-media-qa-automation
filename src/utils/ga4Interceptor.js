class GA4Interceptor {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.hits = [];
    this._attachListener();
  }

  _attachListener() {
    this.page.on('request', (request) => {
      const url = request.url();
      if (!this.isGA4CollectRequest(url)) return;

      const parsedHits = this._parseGA4Request(request);
      this.hits.push(...parsedHits);
    });
  }

  /**
   * Matches any subdomain of google-analytics.com or analytics.google.com hitting /g/collect
   * @param {string} urlString
   */
  isGA4CollectRequest(urlString) {
    try {
      const parsed = new URL(urlString);
      const isGAHost =
        /(^|\.)google-analytics\.com$/i.test(parsed.hostname) ||
        /(^|\.)analytics\.google\.com$/i.test(parsed.hostname);
      return isGAHost && parsed.pathname.includes('/g/collect');
    } catch {
      return false;
    }
  }

  /**
   * GA4 sends parameters in the URL query string AND/OR newline-delimited POST body.
   * @param {import('@playwright/test').Request} request
   */
  _parseGA4Request(request) {
    const urlObj = new URL(request.url());
    const baseParams = Object.fromEntries(urlObj.searchParams.entries());
    const postData = request.postData();

    if (!postData) {
      return [
        {
          timestamp: Date.now(),
          host: urlObj.hostname,
          url: request.url(),
          params: baseParams,
        },
      ];
    }

    const lines = postData
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    return lines.map((line) => {
      const lineParams = Object.fromEntries(new URLSearchParams(line).entries());
      return {
        timestamp: Date.now(),
        host: urlObj.hostname,
        url: request.url(),
        params: { ...baseParams, ...lineParams },
      };
    });
  }

  /**
   * Waits for a specific GA4 hit matching a predicate, checking existing hits first.
   * @param {(hit: object) => boolean} predicate
   * @param {number} timeoutMs
   */
  async waitForHit(predicate, timeoutMs = 15_000) {
    const existingIndex = this.hits.findIndex(predicate);
    if (existingIndex !== -1) {
      return { hit: this.hits[existingIndex], index: existingIndex };
    }

    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      await this.page.waitForTimeout(100);
      const idx = this.hits.findIndex(predicate);
      if (idx !== -1) {
        return { hit: this.hits[idx], index: idx };
      }
    }

    throw new Error(
      `Timed out after ${timeoutMs}ms waiting for matching GA4 hit.\nCaptured hits (${this.hits.length}):\n` +
        JSON.stringify(
          this.hits.map((h) => ({
            host: h.host,
            en: h.params.en,
            gcs: h.params.gcs,
            npa: h.params.npa,
            dl: h.params.dl,
          })),
          null,
          2
        )
    );
  }

  /**
   * Waits specifically for the VERY NEXT GA4 hit recorded after `afterIndex`.
   * @param {number} afterIndex
   * @param {number} timeoutMs
   */
  async waitForImmediateNextHit(afterIndex, timeoutMs = 15_000) {
    const targetIndex = afterIndex + 1;
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      if (this.hits.length > targetIndex) {
        return { hit: this.hits[targetIndex], index: targetIndex };
      }
      await this.page.waitForTimeout(100);
    }

    throw new Error(
      `Timed out waiting for immediate next GA4 hit (expected index ${targetIndex}, total captured: ${this.hits.length}).`
    );
  }
}

module.exports = { GA4Interceptor };