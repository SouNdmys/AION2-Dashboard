import { _electron as electron } from "playwright";

function fail(message) {
  throw new Error(`[ui-smoke] ${message}`);
}

async function waitForVisibleText(page, text, timeout = 20_000) {
  const locator = page.getByText(text, { exact: false });
  await locator.first().waitFor({ state: "visible", timeout });
}

async function waitForAnyVisibleText(page, texts, timeout = 30_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    for (const text of texts) {
      const visible = await page
        .getByText(text, { exact: false })
        .first()
        .isVisible()
        .catch(() => false);
      if (visible) {
        return text;
      }
    }
    await page.waitForTimeout(250);
  }
  fail(`timed out waiting for any of: ${texts.join(", ")}`);
}

async function ensureDashboardReady(page) {
  const firstVisible = await waitForAnyVisibleText(page, ["角色总览", "创建第一个账号"], 30_000);
  if (firstVisible === "创建第一个账号") {
    await page.getByPlaceholder("新账号名称").fill("Smoke-Account");
    await page.getByRole("button", { name: "创建第一个账号" }).first().click();
    await waitForVisibleText(page, "角色总览");
  }
}

async function run() {
  /** @type {import('playwright').ElectronApplication | null} */
  let app = null;
  try {
    app = await electron.launch({
      args: ["."],
      timeout: 30_000,
    });

    const page = await app.firstWindow();
    await page.waitForLoadState("domcontentloaded", { timeout: 20_000 });
    await ensureDashboardReady(page);

    await waitForVisibleText(page, "操作中心");

    await page.getByRole("button", { name: "设置页" }).click();
    await waitForVisibleText(page, "设置页");
    await waitForVisibleText(page, "保存设置");

    await page.getByRole("button", { name: "做装模拟" }).click();
    await waitForVisibleText(page, "做装模拟器");
    await waitForVisibleText(page, "市场工具");

    // Validate standardized IPC error format from preload bridge.
    const ipcErrorMessage = await page.evaluate(async () => {
      try {
        // @ts-ignore - intentional invalid payload for smoke validation
        await window.aionApi.selectAccount(12345);
        return null;
      } catch (error) {
        if (error instanceof Error) {
          return error.message;
        }
        return String(error);
      }
    });
    if (!ipcErrorMessage) {
      fail("expected standardized IPC error message but got success");
    }
    if (!ipcErrorMessage.includes("[account:select][INVALID_PAYLOAD]")) {
      fail(`unexpected IPC error format: ${ipcErrorMessage}`);
    }

    await page.getByRole("button", { name: "角色总览" }).click();
    await waitForVisibleText(page, "优先级待办");

    console.log("[ui-smoke] PASS");
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
