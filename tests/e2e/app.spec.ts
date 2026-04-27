import { test, expect } from "@playwright/test";
import path from "path";

test.describe("Lightroom Analyzer — Main Flow", () => {

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("loads homepage with correct title and tabs", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Decode any photo");
    await expect(page.getByText("Analyze Photo")).toBeVisible();
    await expect(page.getByText("Edit Difference")).toBeVisible();
  });

  test("shows upload zone on Analyze tab", async ({ page }) => {
    await expect(page.getByText("Drop photo or")).toBeVisible();
    await expect(page.getByText("browse")).toBeVisible();
  });

  test("Analyze button is disabled before upload", async ({ page }) => {
    const analyzeBtn = page.getByRole("button", { name: /analyze edit style/i });
    await expect(analyzeBtn).toBeDisabled();
  });

  test("switches to Edit Difference tab", async ({ page }) => {
    await page.getByText("Edit Difference").click();
    await expect(page.getByText("Original (unedited)")).toBeVisible();
    await expect(page.getByText("Edited version")).toBeVisible();
    await expect(page.getByRole("button", { name: /detect edit difference/i })).toBeVisible();
  });

  test("Detect Edit Difference button is disabled before uploads", async ({ page }) => {
    await page.getByText("Edit Difference").click();
    const diffBtn = page.getByRole("button", { name: /detect edit difference/i });
    await expect(diffBtn).toBeDisabled();
  });

  test("shows image preview after upload", async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, "fixtures/test-photo.jpg"));
    await expect(page.locator('img[alt="Preview"]')).toBeVisible();
  });

  test("enables Analyze button after upload", async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, "fixtures/test-photo.jpg"));
    const analyzeBtn = page.getByRole("button", { name: /analyze edit style/i });
    await expect(analyzeBtn).toBeEnabled();
  });

  test("opens and closes preset library drawer", async ({ page }) => {
    await page.getByRole("button", { name: /library/i }).click();
    await expect(page.getByText("Preset Library")).toBeVisible();
    await page.keyboard.press("Escape");
    // close via X button instead
    await page.getByRole("button", { name: /library/i }).click();
    await page.locator("button").filter({ hasText: "✕" }).first().click();
    await expect(page.getByText("Preset Library")).not.toBeVisible();
  });

  test("shows empty state in library when no presets", async ({ page }) => {
    await page.getByRole("button", { name: /library/i }).click();
    await expect(page.getByText(/no presets/i)).toBeVisible();
  });

  test("can create a new collection in the library", async ({ page }) => {
    await page.getByRole("button", { name: /library/i }).click();
    await page.getByRole("button", { name: /\+ new/i }).click();
    await page.locator('input[placeholder="Name…"]').fill("Wedding");
    await page.keyboard.press("Enter");
    await expect(page.getByText(/wedding/i)).toBeVisible();
  });

});

test.describe("Lightroom Analyzer — Full Analyze Flow", () => {
  test("analyzes a photo and shows results", async ({ page }) => {
    await page.goto("/");

    // Upload test photo
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, "fixtures/test-photo.jpg"));

    // Click analyze
    await page.getByRole("button", { name: /analyze edit style/i }).click();

    // Wait for results (API call can take a few seconds)
    await expect(page.getByText(/confidence/i)).toBeVisible({ timeout: 30000 });

    // Check panels are visible
    await expect(page.getByText("LIGHT")).toBeVisible();
    await expect(page.getByText("COLOR")).toBeVisible();
    await expect(page.getByText("HSL / COLOR")).toBeVisible();

    // Check XMP download button is visible
    await expect(page.getByRole("button", { name: /download .xmp/i })).toBeVisible();

    // Check save to library button is visible
    await expect(page.getByRole("button", { name: /save to library/i })).toBeVisible();
  });

  test("can save a result to the library", async ({ page }) => {
    await page.goto("/");

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, "fixtures/test-photo.jpg"));
    await page.getByRole("button", { name: /analyze edit style/i }).click();
    await expect(page.getByText(/confidence/i)).toBeVisible({ timeout: 30000 });

    // Save to library
    await page.getByRole("button", { name: /save to library/i }).click();
    await expect(page.getByText(/saved!/i)).toBeVisible();

    // Open library and verify preset is there
    await page.getByRole("button", { name: /library/i }).click();
    await expect(page.locator(".rounded-xl").filter({ hasText: "Load" })).toBeVisible();
  });
});