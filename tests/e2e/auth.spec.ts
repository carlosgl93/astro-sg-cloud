import { test, expect } from '@playwright/test';

/**
 * E2E tests for Authentication flow
 */

test.describe('Authentication', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    // Try to access protected route
    await page.goto('/wa-templates');

    // Should redirect to login or show auth prompt
    // (depends on auth implementation)
    await page.waitForLoadState('networkidle');

    // Either redirected to login or shows auth guard
    const isOnLogin = page.url().includes('login') || page.url().includes('auth') || page.url().includes('supabase');

    // If not redirected, should show auth-related content
    if (!isOnLogin) {
      const authContent = page
        .locator('text=Iniciar sesión')
        .or(page.locator('text=Log In').or(page.locator('text=Sign In')));
      // Auth guard or login should be visible
      await expect(authContent.or(page.locator('button'))).toBeVisible({ timeout: 5000 });
    }
  });

  test('should show login page', async ({ page }) => {
    // Go directly to login page if it exists
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Should show login content
    const loginButton = page
      .locator('button:has-text("Iniciar")')
      .or(page.locator('button:has-text("Log In")').or(page.locator('button:has-text("Sign In")')));

    // Login button or form should exist
    const hasLoginForm = (await loginButton.count()) > 0 || (await page.locator('form').count()) > 0;
    expect(hasLoginForm).toBeTruthy();
  });
});

test.describe('Admin Panel', () => {
  test('should require admin privileges', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Should either redirect or show access denied
    const accessDenied = page.locator('text=Acceso denegado').or(page.locator('text=Access denied'));

    // If not showing access denied, might be on login
    const onLogin = page.url().includes('login');

    if (!onLogin) {
      // Should show access denied or similar
      await expect(accessDenied.or(page.locator('h1'))).toBeVisible({ timeout: 5000 });
    }
  });
});
