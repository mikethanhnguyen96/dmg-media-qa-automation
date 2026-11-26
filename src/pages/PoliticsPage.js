const { expect } = require('@playwright/test');

class PoliticsPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'https://inews.co.uk/category/news/politics';
    this.acceptPattern = /^(accept( all)?|agree|yes, i.?m happy)$/i;
    this.layer1RejectPattern = /^(reject( all)?|disagree|continue without accepting)$/i;
    this.rejectCssSelector = 'button[class*="reject_"], [role="button"][class*="reject_"]';
    this.subscribeLiteOfferBtnSelector =
      '#view-offer > div.lazy-transclude > div.pn-wrapper.ng-scope > main > section.pn-main__plans.pn-plans.first.two-cards > div > div:nth-child(2) > button';
    this.goBackToAcceptSelector =
      '#view-offer > div.lazy-transclude > div.pn-wrapper.ng-scope > main > section.pn-main__plans.pn-plans.first.two-cards > div > div:nth-child(1) > a';
  }

  async goto() {
    await this.page.goto(this.url, { waitUntil: 'domcontentloaded' });
  }

  async _findVisibleLocator(buildLocatorFn, timeoutMs = 15_000) {
    let target = null;
    let source = 'main-dom';

    await expect
      .poll(
        async () => {
          const mainCandidate = buildLocatorFn(this.page).first();
          if (await mainCandidate.isVisible().catch(() => false)) {
            target = mainCandidate;
            source = 'main-dom';
            return true;
          }

          for (const frame of this.page.frames()) {
            if (frame === this.page.mainFrame()) continue;
            const frameCandidate = buildLocatorFn(frame).first();
            if (await frameCandidate.isVisible().catch(() => false)) {
              target = frameCandidate;
              source = `iframe (${frame.name() || frame.url().slice(0, 40)})`;
              return true;
            }
          }

          return false;
        },
        { timeout: timeoutMs, intervals: [200] }
      )
      .toBe(true);

    return { locator: target, source };
  }

  async _findVisibleButton(pattern, cssSelector = null, timeoutMs = 15_000) {
    const { locator, source } = await this._findVisibleLocator((root) => {
      const byRole = root.getByRole('button', { name: pattern });
      return cssSelector ? root.locator(cssSelector).or(byRole) : byRole;
    }, timeoutMs);
    return { button: locator, source };
  }

  async _verifyBannerDismissed(clickedButton) {
    await expect(clickedButton).toHaveCount(0, { timeout: 10_000 }).catch(async () => {
      await expect(clickedButton).toBeHidden({ timeout: 10_000 });
    });
    await expect(this.page.locator('[id^="sp_message_container_"]:visible')).toHaveCount(0, {
      timeout: 10_000,
    });
  }

  async acceptConsentAndVerifyDismissed() {
    const { button, source } = await this._findVisibleButton(this.acceptPattern);
    await expect(button).toBeEnabled();
    const acceptLabel = (await button.innerText()).trim();

    await button.click();
    await this._verifyBannerDismissed(button);

    return { acceptLabel, source };
  }

  async clickRejectAndWaitForSubscribeLite() {
    const { button, source } = await this._findVisibleButton(
      this.layer1RejectPattern,
      this.rejectCssSelector
    );
    await expect(button).toBeEnabled();
    const rejectLabel = (await button.innerText()).trim();

    await button.click();
    await this.page.waitForURL(/\/subscribe-lite/i, {
      timeout: 15_000,
      waitUntil: 'domcontentloaded',
    });

    return { rejectLabel, source, redirectedUrl: this.page.url() };
  }

  async clickGoBackToAcceptAndReturn() {
    const { locator: goBackLink, source: goBackSource } = await this._findVisibleLocator(
      (root) =>
        root
          .locator(this.goBackToAcceptSelector)
          .or(root.getByRole('link', { name: /go back to accept/i })),
      15_000
    );

    await expect(goBackLink).toBeVisible();
    const goBackLabel = (await goBackLink.innerText()).trim();

    await goBackLink.scrollIntoViewIfNeeded();
    await goBackLink.dispatchEvent('click').catch((err) => {
      if (!/Frame was detached|Target closed/i.test(err.message)) throw err;
    });

    await this.page.waitForURL(
      (url) =>
        url.hostname.includes('inews.co.uk') &&
        !url.pathname.includes('/subscribe-lite'),
      { timeout: 15_000, waitUntil: 'domcontentloaded' }
    );

    return { goBackLabel, goBackSource, returnedUrl: this.page.url() };
  }

  async rejectConsentAndVerifySubscribeLiteOptions() {
    const { rejectLabel, source } = await this.clickRejectAndWaitForSubscribeLite();

    await expect(this.page.locator('[id^="sp_message_container_"]:visible')).toHaveCount(0, {
      timeout: 10_000,
    });

    const { locator: getLiteBtn, source: offerSource } = await this._findVisibleLocator(
      (root) =>
        root
          .locator(this.subscribeLiteOfferBtnSelector)
          .or(root.getByRole('button', { name: /get the i paper lite/i })),
      15_000
    );

    await expect(getLiteBtn).toBeEnabled();
    const liteButtonLabel = (await getLiteBtn.innerText()).trim();
    await getLiteBtn.click();

    const { locator: accountPrompt } = await this._findVisibleLocator(
      (root) => root.getByText(/create your account/i),
      15_000
    );
    await expect(accountPrompt).toBeVisible();

    const { locator: subscriptionSummaryText } = await this._findVisibleLocator(
      (root) =>
        root.getByText(/you['’]re on your way to subscribe to the\s+i\s+paper/i),
      15_000
    );
    await expect(subscriptionSummaryText).toBeVisible();

    const verifiedConfirmationText = (await subscriptionSummaryText.innerText()).trim();

    return {
      rejectLabel,
      source,
      offerSource,
      redirectedUrl: this.page.url(),
      liteButtonLabel,
      verifiedConfirmationText,
    };
  }
}

module.exports = { PoliticsPage };