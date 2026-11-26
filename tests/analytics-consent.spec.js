const { test, expect } = require('@playwright/test');
const { GA4Interceptor } = require('../src/utils/ga4Interceptor');
const { PoliticsPage } = require('../src/pages/PoliticsPage');

test.describe('Test Suite 1 — inews.co.uk analytics & consent', () => {
  test('verifies pre-consent page_view, consent banner buttons, and post-consent GA4 update on Accept', async ({
    page,
  }, testInfo) => {
    const ga4 = new GA4Interceptor(page);
    const politicsPage = new PoliticsPage(page);

    // 1. Verify Browser Context (en-GB, Europe/London, Mobile) & Navigate
    await test.step('Verify UK context and navigate to Politics', async () => {
      const envInfo = await page.evaluate(() => ({
        project: '',
        userAgent: navigator.userAgent,
        locale: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        viewport: { width: window.innerWidth, height: window.innerHeight },
      }));
      envInfo.project = testInfo.project.name;

      console.log('1. Environment Verified:', envInfo);
      expect(envInfo.locale).toBe('en-GB');
      expect(envInfo.timezone).toBe('Europe/London');

      if (/mobile|iphone|pixel/i.test(testInfo.project.name)) {
        expect(envInfo.userAgent).toContain('Mobile');
      }

      await politicsPage.goto();
      expect(page.url()).toContain('https://inews.co.uk/category/news/politics');
    });

    // 2. Verify Pre-Consent GA4 page_view (news/politics, gcs=G101, npa=1)
    let preAcceptHitIndex;
    let initialPageView;

    await test.step('Verify pre-consent GA4 page_view (gcs=G101, npa=1, news/politics)', async () => {
      const result = await ga4.waitForHit((hit) => hit.params.en === 'page_view');
      initialPageView = result.hit;

      console.log('2. Pre-Consent GA4 Hit:', {
        event: initialPageView.params.en,
        gcs: initialPageView.params.gcs,
        npa: initialPageView.params.npa,
        pageLocation: initialPageView.params.dl,
      });

      expect(
        JSON.stringify(initialPageView.params),
        'GA4 page_view must be tagged to news/politics sub-channel'
      ).toContain('news/politics');

      expect(
        initialPageView.params.gcs,
        'Pre-consent hit must carry gcs=G101'
      ).toBe('G101');

      expect(
        initialPageView.params.npa,
        'Pre-consent hit must carry npa=1'
      ).toBe('1');

      preAcceptHitIndex = ga4.hits.length - 1;
    });

    // 3. Verify Consent Banner Buttons, Click Accept & Confirm DOM Removal
    let verifiedButtons;

    await test.step('Verify consent buttons, click Accept, and confirm DOM removal', async () => {
      verifiedButtons = await politicsPage.acceptConsentAndVerifyDismissed();
      console.log('3. Verified Consent Buttons Before Click:', verifiedButtons);

      const bannerCount = await page
        .locator('[id^="sp_message_container_"]:visible')
        .count();
      console.log('   Consent Banner DOM Count After Accept:', bannerCount);
      expect(bannerCount).toBe(0);
    });

    // 4. Verify Immediate Next GA4 Hit Updates Consent (gcs=G111, npa=0/absent)
    await test.step('Verify immediate next GA4 hit updates to gcs=G111 and npa=0/absent', async () => {
      const { hit: nextHit } = await ga4.waitForImmediateNextHit(preAcceptHitIndex);

      console.log('4. Immediate Post-Consent GA4 Hit:', {
        event: nextHit.params.en,
        gcs: nextHit.params.gcs,
        npa: nextHit.params.npa ?? '(absent)',
      });

      expect(
        nextHit.params.gcs,
        `Expected immediate next GA4 hit (${nextHit.params.en}) after Accept to have gcs=G111`
      ).toBe('G111');

      expect(
        nextHit.params.npa === undefined || nextHit.params.npa === '0',
        `Expected npa to be '0' or absent after Accept, but received npa=${nextHit.params.npa}`
      ).toBe(true);

      await testInfo.attach('ga4-accept-consent-evidence.json', {
        body: JSON.stringify(
          {
            project: testInfo.project.name,
            verifiedButtons,
            preConsentPageView: initialPageView.params,
            immediatePostConsentHit: nextHit.params,
          },
          null,
          2
        ),
        contentType: 'application/json',
      });
    });
  });

  test('verifies rejecting consent opens the two-option Subscribe Lite paywall without granting ad personalisation', async ({
    page,
  }, testInfo) => {
    const ga4 = new GA4Interceptor(page);
    const politicsPage = new PoliticsPage(page);

    // 1. Navigate to Politics
    await test.step('Navigate to Politics page', async () => {
      await politicsPage.goto();
      expect(page.url()).toContain('https://inews.co.uk/category/news/politics');
    });

    // 2. Verify Pre-Consent GA4 page_view
    let initialPageView;

    await test.step('Verify pre-consent GA4 page_view (gcs=G101, npa=1)', async () => {
      const result = await ga4.waitForHit((hit) => hit.params.en === 'page_view');
      initialPageView = result.hit;

      expect(initialPageView.params.gcs).toBe('G101');
      expect(initialPageView.params.npa).toBe('1');
    });

    // 3. Click Reject, verify both Consent-or-Pay options, and select i Paper Lite
    let rejectResult;

    await test.step('Click Reject and verify Subscribe Lite Consent-or-Pay options', async () => {
      rejectResult = await politicsPage.rejectConsentAndVerifySubscribeLiteOptions();
      console.log('Reject Consent Result:', rejectResult);

      expect(rejectResult.redirectedUrl).toContain('/subscribe-lite');
    });

    // 4. Verify NO captured GA4 hit granted personalisation (gcs !== G111, npa !== 0)
    await test.step('Verify no GA4 hit granted personalisation (gcs !== G111, npa !== 0)', async () => {
      await page.waitForTimeout(1500);

      for (const hit of ga4.hits) {
        expect(
          hit.params.gcs,
          `Hit ${hit.params.en} must not upgrade gcs to G111 after Reject`
        ).not.toBe('G111');

        if (hit.params.npa !== undefined) {
          expect(
            hit.params.npa,
            `Hit ${hit.params.en} must keep npa=1 after Reject`
          ).toBe('1');
        }
      }

      await testInfo.attach('ga4-reject-consent-evidence.json', {
        body: JSON.stringify(
          {
            project: testInfo.project.name,
            rejectResult,
            preRejectPageView: initialPageView.params,
            totalGa4HitsCaptured: ga4.hits.length,
          },
          null,
          2
        ),
        contentType: 'application/json',
      });
    });
  });

  test('verifies clicking Go back to Accept on Subscribe Lite returns to Politics and grants consent (gcs=G111)', async ({
    page,
  }, testInfo) => {
    const ga4 = new GA4Interceptor(page);
    const politicsPage = new PoliticsPage(page);

    // 1. Navigate to Politics
    await test.step('Navigate to Politics page', async () => {
      await politicsPage.goto();
      expect(page.url()).toContain('https://inews.co.uk/category/news/politics');
    });

    // 2. Verify Pre-Consent GA4 page_view
    let initialPageView;

    await test.step('Verify pre-consent GA4 page_view (gcs=G101, npa=1)', async () => {
      const result = await ga4.waitForHit((hit) => hit.params.en === 'page_view');
      initialPageView = result.hit;

      expect(initialPageView.params.gcs).toBe('G101');
      expect(initialPageView.params.npa).toBe('1');
    });

    // 3. Click Reject on consent banner -> lands on /subscribe-lite
    let rejectResult;

    await test.step('Click Reject on consent banner', async () => {
      rejectResult = await politicsPage.clickRejectAndWaitForSubscribeLite();
      console.log('1. Reject Result:', rejectResult);
      expect(rejectResult.redirectedUrl).toContain('/subscribe-lite');
    });

    // 4. Click "Go back to Accept" on Subscribe Lite -> returns to Politics
    let goBackResult;

    await test.step('Click Go back to Accept on Subscribe Lite', async () => {
      goBackResult = await politicsPage.clickGoBackToAcceptAndReturn();
      console.log('2. Go Back Result:', goBackResult);
      expect(goBackResult.returnedUrl).toContain('https://inews.co.uk/category/news/politics');
    });

    // 5. Click Accept on the re-shown consent banner & confirm DOM removal
    let acceptResult;

    await test.step('Click Accept on re-presented consent banner', async () => {
      acceptResult = await politicsPage.acceptConsentAndVerifyDismissed();
      console.log('3. Accept After Return Result:', acceptResult);

      const bannerCount = await page
        .locator('[id^="sp_message_container_"]:visible')
        .count();
      expect(bannerCount).toBe(0);
    });

    // 6. Verify GA4 upgrades to gcs=G111 and npa=0/absent
    await test.step('Verify GA4 hit after Go back to Accept upgrades to gcs=G111 and npa=0/absent', async () => {
      const { hit: postAcceptHit } = await ga4.waitForHit((hit) => hit.params.gcs === 'G111');

      console.log('4. Post Go-Back-to-Accept GA4 Hit:', {
        event: postAcceptHit.params.en,
        gcs: postAcceptHit.params.gcs,
        npa: postAcceptHit.params.npa ?? '(absent)',
      });

      expect(postAcceptHit.params.gcs).toBe('G111');
      expect(
        postAcceptHit.params.npa === undefined || postAcceptHit.params.npa === '0',
        `Expected npa to be '0' or absent after accepting, received npa=${postAcceptHit.params.npa}`
      ).toBe(true);

      await testInfo.attach('ga4-reject-go-back-accept-evidence.json', {
        body: JSON.stringify(
          {
            project: testInfo.project.name,
            rejectResult,
            goBackResult,
            acceptResult,
            preConsentPageView: initialPageView.params,
            postAcceptHit: postAcceptHit.params,
          },
          null,
          2
        ),
        contentType: 'application/json',
      });
    });
  });
});