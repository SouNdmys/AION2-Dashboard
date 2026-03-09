import fs from "node:fs";
import path from "node:path";
import { _electron as electron } from "playwright";

function resolveOutputDir() {
  const outDirFlagIndex = process.argv.indexOf("--out-dir");
  if (outDirFlagIndex >= 0 && process.argv[outDirFlagIndex + 1]) {
    return path.resolve(process.argv[outDirFlagIndex + 1]);
  }
  return path.resolve("artifacts/ui-baseline/phase0");
}

const OUTPUT_DIR = resolveOutputDir();
const VIEWPORTS = [
  { key: "desktop", width: 1728, height: 1117 },
  { key: "narrow", width: 430, height: 932 },
];

const WORKSHOP_CARD_HEADINGS = [
  { key: "simulation", heading: "做装模拟器" },
  { key: "ocr", heading: "OCR抓价器" },
  { key: "market-analysis", heading: "市场分析器" },
  { key: "inventory", heading: "库存管理" },
];

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

async function waitForVisibleText(page, text, timeout = 20_000) {
  await page.getByText(text, { exact: false }).first().waitFor({ state: "visible", timeout });
}

async function ensureDashboardReady(page) {
  const createFirstAccountButton = page.getByRole("button", { name: "创建第一个账号" }).first();
  if (await createFirstAccountButton.isVisible().catch(() => false)) {
    await page.getByPlaceholder("新账号名称").fill("Baseline-Phase0");
    await createFirstAccountButton.click();
  }
  await waitForVisibleText(page, "角色总览");
}

async function clickToolbar(page, buttonName) {
  await page.getByRole("button", { name: buttonName, exact: true }).first().click();
}

async function captureViewport(page, filePath) {
  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
  await page.screenshot({
    path: filePath,
    type: "jpeg",
    quality: 82,
    fullPage: false,
  });
}

async function captureCard(page, heading, filePath) {
  const headingLocator = page.getByRole("heading", { name: heading, exact: false }).first();
  await headingLocator.scrollIntoViewIfNeeded();
  const articleLocator = headingLocator.locator("xpath=ancestor::article[1]");
  await articleLocator.screenshot({
    path: filePath,
    type: "jpeg",
    quality: 85,
  });
}

async function run() {
  ensureDir(OUTPUT_DIR);
  const manifest = {
    generatedAt: new Date().toISOString(),
    outputDir: OUTPUT_DIR,
    screenshots: [],
  };

  let app = null;
  try {
    app = await electron.launch({
      args: ["."],
      timeout: 30_000,
    });

    const page = await app.firstWindow();
    await page.waitForLoadState("domcontentloaded", { timeout: 20_000 });
    await ensureDashboardReady(page);

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      await clickToolbar(page, "角色总览");
      await waitForVisibleText(page, "优先级待办");
      {
        const filePath = path.join(OUTPUT_DIR, `${viewport.key}-dashboard-overview.jpg`);
        await captureViewport(page, filePath);
        manifest.screenshots.push(path.relative(path.resolve("."), filePath).replaceAll("\\", "/"));
      }

      await clickToolbar(page, "角色操作");
      await waitForVisibleText(page, "角色操作");
      {
        const filePath = path.join(OUTPUT_DIR, `${viewport.key}-dashboard-character.jpg`);
        await captureViewport(page, filePath);
        manifest.screenshots.push(path.relative(path.resolve("."), filePath).replaceAll("\\", "/"));
      }

      await clickToolbar(page, "设置页");
      await waitForVisibleText(page, "设置页");
      {
        const filePath = path.join(OUTPUT_DIR, `${viewport.key}-dashboard-settings.jpg`);
        await captureViewport(page, filePath);
        manifest.screenshots.push(path.relative(path.resolve("."), filePath).replaceAll("\\", "/"));
      }

      await clickToolbar(page, "工坊");
      await waitForVisibleText(page, "工坊（内置配方库）");
      {
        const filePath = path.join(OUTPUT_DIR, `${viewport.key}-workshop-overview.jpg`);
        await captureViewport(page, filePath);
        manifest.screenshots.push(path.relative(path.resolve("."), filePath).replaceAll("\\", "/"));
      }

      for (const card of WORKSHOP_CARD_HEADINGS) {
        const filePath = path.join(OUTPUT_DIR, `${viewport.key}-workshop-${card.key}.jpg`);
        await captureCard(page, card.heading, filePath);
        manifest.screenshots.push(path.relative(path.resolve("."), filePath).replaceAll("\\", "/"));
      }
    }

    fs.writeFileSync(path.join(OUTPUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
    console.log(`[ui-baseline-phase0] captured ${manifest.screenshots.length} screenshots`);
  } finally {
    if (app) {
      await app.close();
    }
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
