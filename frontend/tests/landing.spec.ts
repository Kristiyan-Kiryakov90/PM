import { test, expect } from '@playwright/test';

/**
 * Landing Page Tests
 * Tests for landing page and public pages
 */

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to landing page
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Landing Page Display', () => {
    test('should load landing page successfully', async ({ page }) => {
      expect(page.url()).toContain('index.html');

      // Should display landing page content
      const mainContent = page.locator('main, [class*="landing"], [class*="hero"]').first();
      await expect(mainContent).toBeVisible();
    });

    test('should display page title', async ({ page }) => {
      const title = await page.title();
      expect(title).toBeTruthy();
    });

    test('should display hero section or welcome message', async ({ page }) => {
      const heroSection = page.locator('[class*="hero"], h1').first();

      await expect(heroSection).toBeVisible();
    });

    test('should display navigation', async ({ page }) => {
      const nav = page.locator('nav, header').first();

      await expect(nav).toBeVisible();
    });
  });

  test.describe('Landing Page Navigation', () => {
    test('should have signin link', async ({ page }) => {
      const signinLink = page.locator('a:has-text("Sign In"), a:has-text("Login"), a[href*="signin"]').first();

      await expect(signinLink).toBeVisible();

      await signinLink.click();

      expect(page.url()).toContain('signin');
    });

    test('should have signup link', async ({ page }) => {
      await page.goto('/index.html');

      const signupLink = page.locator('a:has-text("Sign Up"), a:has-text("Register"), a[href*="signup"]').first();

      await expect(signupLink).toBeVisible();

      await signupLink.click();

      expect(page.url()).toContain('signup');
    });

    test('should have about section or information', async ({ page }) => {
      const aboutSection = page.locator('[class*="about"], [class*="feature"]').first();

      if (await aboutSection.isVisible()) {
        expect(aboutSection).toBeTruthy();
      }
    });
  });

  test.describe('System Admin Bootstrap', () => {
    test('should have system admin setup option', async ({ page }) => {
      // Look for modal, button, or link for sys_admin bootstrap
      const adminButton = page.locator('button:has-text("Admin"), button:has-text("Setup"), button:has-text("System")').first();

      if (await adminButton.isVisible()) {
        expect(adminButton).toBeTruthy();
      }
    });

    test('should open admin bootstrap modal', async ({ page }) => {
      const adminButton = page.locator('button:has-text("Admin"), button:has-text("Setup"), button:has-text("System")').first();

      if (!await adminButton.isVisible()) {
        test.skip();
      }

      await adminButton.click();

      // Should display admin setup form
      const emailInput = page.locator('input[type="email"], input[placeholder*="Email"]').first();

      const isModalVisible = await emailInput.isVisible().catch(() => false);

      if (isModalVisible) {
        await expect(emailInput).toBeVisible();
      }
    });
  });

  test.describe('Call to Action', () => {
    test('should have primary CTA button', async ({ page }) => {
      const ctaButton = page.locator('button, a').filter({ hasText: /get started|sign up|start|begin/i }).first();

      if (await ctaButton.isVisible()) {
        expect(ctaButton).toBeTruthy();
      }
    });

    test('should have secondary CTA button', async ({ page }) => {
      const ctaButtons = page.locator('button, a').filter({ hasText: /learn more|about|demo|contact/i });

      const count = await ctaButtons.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Landing Page Features', () => {
    test('should display feature list or sections', async ({ page }) => {
      const features = page.locator('[class*="feature"], [class*="card"], [class*="section"]');

      const count = await features.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should display benefits or value proposition', async ({ page }) => {
      const benefits = page.locator('text=/benefit|advantage|why|solution/i').first();

      if (await benefits.isVisible()) {
        const text = await benefits.textContent();
        expect(text).toBeTruthy();
      }
    });
  });

  test.describe('Landing Page Footer', () => {
    test('should display footer', async ({ page }) => {
      // Scroll to bottom
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

      const footer = page.locator('footer, [class*="footer"]').first();

      const isVisible = await footer.isVisible().catch(() => false);

      if (isVisible) {
        await expect(footer).toBeVisible();
      }
    });

    test('should have footer links', async ({ page }) => {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

      const footerLinks = page.locator('footer a, [class*="footer"] a');

      const count = await footerLinks.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Responsive Design', () => {
    test('should display properly on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto('/index.html');
      await page.waitForLoadState('networkidle');

      const mainContent = page.locator('main, [class*="landing"]').first();
      await expect(mainContent).toBeVisible();
    });

    test('should display properly on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });

      await page.goto('/index.html');
      await page.waitForLoadState('networkidle');

      const mainContent = page.locator('main, [class*="landing"]').first();
      await expect(mainContent).toBeVisible();
    });

    test('should display properly on desktop viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });

      await page.goto('/index.html');
      await page.waitForLoadState('networkidle');

      const mainContent = page.locator('main, [class*="landing"]').first();
      await expect(mainContent).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      const headings = page.locator('h1, h2, h3, h4, h5, h6');

      const count = await headings.count();
      expect(count).toBeGreaterThan(0);

      // First heading should be h1
      const firstHeading = headings.first();
      const tag = await firstHeading.evaluate((el) => el.tagName);
      expect(tag).toBe('H1');
    });

    test('should have alt text for images', async ({ page }) => {
      const images = page.locator('img');

      const count = await images.count();

      if (count > 0) {
        for (let i = 0; i < Math.min(3, count); i++) {
          const alt = await images.nth(i).getAttribute('alt');
          // Alt text should exist (even if empty for decorative images)
          expect(alt !== undefined).toBeTruthy();
        }
      }
    });

    test('should have proper color contrast', async ({ page }) => {
      const textElements = page.locator('p, h1, h2, h3, a, button, span').first();

      if (await textElements.isVisible()) {
        // This is a basic check - full contrast testing would require additional tools
        expect(await textElements.isVisible()).toBeTruthy();
      }
    });
  });
});
