const { test, expect } = require('@playwright/test');
const { NewScientistHomePage } = require('../src/pages/NewScientistHomePage');

test.describe('Test Suite 2 — newscientist.com dark mode & consent', () => {
  test('defaults to dark mode on dark OS, persists light mode override after consent and refresh', async ({
    page,
  }, testInfo) => {
    const nsHome = new NewScientistHomePage(page);

    // 1. Verify Desktop Chrome, en-GB, OS dark colour scheme on newscientist.com
    await test.step('Verify Desktop Chrome UK dark-mode context and navigate', async () => {
      const envInfo = await page.evaluate(() => ({
        locale: navigator.language,
        prefersDark: window.matchMedia('(prefers-color-scheme: dark)').matches,
        viewport: { width: window.innerWidth, height: window.innerHeight },
      }));

      console.log('1. Environment Verified:', envInfo);
      expect(envInfo.locale).toBe('en-GB');
      expect(envInfo.prefersDark).toBe(true);

      await nsHome.goto();
      expect(page.url()).toContain('https://www.newscientist.com');
    });

    // 2. Assert <html data-theme="dark"> after load with NO colourSchemeAppearance key yet
    await test.step('Verify initial data-theme="dark" and empty localStorage preference', async () => {
      await expect(nsHome.htmlElement).toHaveAttribute('data-theme', 'dark');

      const initialStorageValue = await nsHome.getStoredColourScheme();
      console.log('2. Initial Theme & Storage:', {
        dataTheme: await nsHome.htmlElement.getAttribute('data-theme'),
        colourSchemeAppearance: initialStorageValue,
      });

      expect(
        initialStorageValue,
        'colourSchemeAppearance must not exist in localStorage before user toggles theme'
      ).toBeNull();
    });

    // 3. Accept the consent modal and confirm it is removed from the DOM
    let acceptedButtonLabel;
    await test.step('Accept consent modal and confirm DOM removal', async () => {
      acceptedButtonLabel = await nsHome.acceptConsentAndVerifyDismissed();
      const remainingContainers = await page.locator('[id^="sp_message_container_"]').count();

      console.log('3. Consent Accepted:', {
        buttonClicked: acceptedButtonLabel,
        remainingBannerContainers: remainingContainers,
      });

      expect(remainingContainers).toBe(0);
    });

    // 4. Flip header appearance switch to light mode -> data-theme="light" & localStorage === "light"
    await test.step('Switch to light mode via header toggle and verify DOM + localStorage', async () => {
      await nsHome.switchToLightModeInHeader();

      await expect(nsHome.htmlElement).toHaveAttribute('data-theme', 'light');

      const storedAfterToggle = await nsHome.getStoredColourScheme();
      console.log('4. After Header Light Toggle:', {
        dataTheme: await nsHome.htmlElement.getAttribute('data-theme'),
        colourSchemeAppearance: storedAfterToggle,
      });

      expect(storedAfterToggle).toBe('light');
    });

    // 5. Reload page and verify data-theme="light" persists over the OS dark-mode setting
    await test.step('Reload page and confirm light mode override persists', async () => {
      await page.reload({ waitUntil: 'domcontentloaded' });

      await expect(nsHome.htmlElement).toHaveAttribute('data-theme', 'light');

      const storedAfterReload = await nsHome.getStoredColourScheme();
      const stillPrefersDarkOS = await page.evaluate(
        () => window.matchMedia('(prefers-color-scheme: dark)').matches
      );

      console.log('5. After Page Reload:', {
        osPrefersDark: stillPrefersDarkOS,
        dataTheme: await nsHome.htmlElement.getAttribute('data-theme'),
        colourSchemeAppearance: storedAfterReload,
      });

      expect(stillPrefersDarkOS).toBe(true);
      expect(storedAfterReload).toBe('light');

      await testInfo.attach('dark-mode-consent-evidence.json', {
        body: JSON.stringify(
          {
            acceptedConsentButton: acceptedButtonLabel,
            postToggleTheme: await nsHome.htmlElement.getAttribute('data-theme'),
            postReloadStorage: storedAfterReload,
            osEmulatedDark: stillPrefersDarkOS,
          },
          null,
          2
        ),
        contentType: 'application/json',
      });
    });
  });
});