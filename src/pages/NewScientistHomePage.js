const { expect } = require('@playwright/test');

class NewScientistHomePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'https://www.newscientist.com/';
    this.htmlElement = page.locator('html');

    // Consent modal locators (Sourcepoint CMP iframe + common fallback modal selectors)
    this.cmpContainer = page.locator('[id^="sp_message_container_"]');
    this.cmpIframe = page.frameLocator('iframe[id^="sp_message_iframe_"]');
    this.iframeAcceptButton = this.cmpIframe.getByRole('button', {
      name: /accept|agree|yes, i.?m happy/i,
    });
    this.directAcceptButton = page.getByRole('button', {
      name: /^accept( all)?$|^agree$/i,
    });

    // Header appearance switch (handles button/switch/input toggle patterns in the header)
    this.header = page.locator('header').first();
    this.appearanceSwitch = this.header
      .locator(
        [
          'button[aria-label*="theme" i]',
          'button[aria-label*="mode" i]',
          'button[aria-label*="appearance" i]',
          'button[aria-label*="light" i]',
          'button[aria-label*="dark" i]',
          '[role="switch"][aria-label*="theme" i]',
          '[role="switch"][aria-label*="mode" i]',
          '[data-testid*="theme" i]',
          '[class*="theme-toggle" i]',
          '[class*="appearance" i]',
        ].join(', ')
      )
      .first();
  }

  async goto() {
    await this.page.goto(this.url, { waitUntil: 'domcontentloaded' });
  }

  /**
   * Reads `colourSchemeAppearance` directly from window.localStorage.
   */
  async getStoredColourScheme() {
    return this.page.evaluate(() =>
      window.localStorage.getItem('colourSchemeAppearance')
    );
  }

  /**
   * Verifies the consent modal buttons, clicks Accept, and confirms removal from the DOM.
   */
  async acceptConsentAndVerifyDismissed() {
    const isSpBannerVisible = await this.cmpContainer
      .first()
      .isVisible({ timeout: 10_000 })
      .catch(() => false);

    if (isSpBannerVisible) {
      const acceptBtn = this.iframeAcceptButton.first();
      await expect(acceptBtn).toBeVisible({ timeout: 10_000 });
      await expect(acceptBtn).toBeEnabled();

      const label = (await acceptBtn.innerText()).trim();
      await acceptBtn.click();

      await expect(this.cmpContainer).toHaveCount(0, { timeout: 10_000 }).catch(async () => {
        await expect(this.cmpContainer.first()).toBeHidden({ timeout: 10_000 });
      });

      return label;
    }

    const directBtn = this.directAcceptButton.first();
    await expect(directBtn).toBeVisible({ timeout: 10_000 });
    await expect(directBtn).toBeEnabled();

    const label = (await directBtn.innerText()).trim();
    await directBtn.click();
    await expect(directBtn).toBeHidden({ timeout: 10_000 });

    return label;
  }

  /**
   * Verifies the appearance toggle in the header is visible & enabled, then clicks it
   * to switch from dark mode to light mode.
   */
  async switchToLightModeInHeader() {
    await expect(this.header).toBeVisible({ timeout: 10_000 });
    await expect(this.appearanceSwitch).toBeVisible({ timeout: 10_000 });
    await expect(this.appearanceSwitch).toBeEnabled();

    await this.appearanceSwitch.click();

    // Some toggles cycle modes or open a 2-option menu (Light / Dark); handle if a Light menu option appears
    const lightMenuOption = this.page
      .getByRole('menuitem', { name: /^light$/i })
      .or(this.page.getByRole('button', { name: /^light$/i }));

    if (await lightMenuOption.first().isVisible({ timeout: 500 }).catch(() => false)) {
      await lightMenuOption.first().click();
    }
  }
}

module.exports = { NewScientistHomePage };