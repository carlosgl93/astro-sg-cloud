import { test, expect } from '@playwright/test';

/**
 * E2E tests for Dashboard and Widgets
 *
 * Prerequisites:
 * 1. Backend running at http://localhost:8000
 * 2. Frontend running at http://localhost:4321
 * 3. Database and Redis available
 *
 * Run with: npx playwright test
 */

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/');

    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test('should load dashboard page', async ({ page }) => {
    // Check dashboard title exists
    const dashboardTitle = page.locator('h1:has-text("Dashboard")').or(page.locator('h1:has-text("Panel")'));
    await expect(dashboardTitle).toBeVisible({ timeout: 10000 });
  });

  test('should display metrics section', async ({ page }) => {
    // Check metrics section exists
    const metricsSection = page.locator('text=Métricas del Sistema');
    await expect(metricsSection).toBeVisible({ timeout: 10000 });
  });

  test('should display QueueMetrics widget', async ({ page }) => {
    // Check QueueMetrics widget exists
    const queueMetrics = page.locator('text=Cola de Mensajes').or(page.locator('text=Message Queue'));
    await expect(queueMetrics).toBeVisible({ timeout: 10000 });

    // Check priority queues are displayed
    const priorityQueues = page.locator('text=Prioridad Alta').or(page.locator('text=High Priority'));
    await expect(priorityQueues).toBeVisible();
  });

  test('should display TelemetryDashboard widget', async ({ page }) => {
    // Check TelemetryDashboard widget exists
    const telemetry = page.locator('text=Métricas de Telemetry').or(page.locator('text=Telemetry Metrics'));
    await expect(telemetry).toBeVisible({ timeout: 10000 });
  });

  test('should have refresh button on metrics widgets', async ({ page }) => {
    // Find refresh buttons in the metrics section
    const refreshButtons = page.locator('button:has-text("Actualizar")').or(page.locator('button:has-text("Refresh")'));

    // Should have at least 2 refresh buttons (one for each widget)
    await expect(refreshButtons).toHaveCount(2, { timeout: 5000 });
  });
});

test.describe('QueueMetrics Widget', () => {
  test('should load queue metrics from API', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for metrics to load
    const queueCard = page.locator('text=Cola de Mensajes');
    await expect(queueCard).toBeVisible({ timeout: 10000 });

    // Check for queue metrics indicators
    const sent = page.locator('text=Enviados').or(page.locator('text=Sent'));
    const failed = page.locator('text=Fallidos').or(page.locator('text=Failed'));

    await expect(sent).toBeVisible({ timeout: 5000 });
    await expect(failed).toBeVisible({ timeout: 5000 });
  });

  test('should show progress bar when queue has messages', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Look for progress bar in queue metrics
    const progressBar = page.locator('.h-2.bg-gray-200 >> nth=0');
    // Progress bar should exist (may be empty)
    await expect(progressBar).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Navigation', () => {
  test('should navigate to WhatsApp Templates', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click on templates link
    const templatesLink = page.locator('a:has-text("Templates")').or(page.locator('a:has-text("Plantillas")'));
    await templatesLink.click();

    // Should navigate to templates page
    await expect(page).toHaveURL(/\/(wa-)?templates/);
  });

  test('should navigate to Documents', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click on documents link
    const docsLink = page.locator('a:has-text("Documents")').or(page.locator('a:has-text("Documentos")'));
    await docsLink.click();

    // Should navigate to documents page
    await expect(page).toHaveURL(/\/documents/);
  });

  test('should navigate to Conversations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click on conversations link
    const convLink = page.locator('a:has-text("Conversations")').or(page.locator('a:has-text("Conversaciones")'));
    await convLink.click();

    // Should navigate to conversations page
    await expect(page).toHaveURL(/\/conversations/);
  });
});
