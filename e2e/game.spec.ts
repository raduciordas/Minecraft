import { expect, test, type Page } from '@playwright/test';

async function startFreshGame(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/?server=off');
  await page.locator('#name-input').fill('Testator');
  await page.locator('#name-submit').click();
  await expect(page.locator('#name-entry')).toHaveClass(/hidden/);
  await expect(page.locator('#app canvas')).toBeVisible();
  await page.waitForFunction(() => {
    const game = (window as unknown as { __game?: { worldReady?: boolean } }).__game;
    return game?.worldReady === true;
  });
}

test.beforeEach(async ({ page }) => {
  await startFreshGame(page);
});

test('starts on solid ground and clears interrupted movement input', async ({ page }) => {
  const initial = await page.evaluate(() => {
    const game = (window as any).__game;
    const body = game.player.body;
    return {
      x: body.x,
      y: body.y,
      z: body.z,
      ground: game.world.highestSolidY(Math.floor(body.x), Math.floor(body.z)),
    };
  });

  expect(initial.x).toBeCloseTo(-15.5, 3);
  expect(initial.z).toBeCloseTo(21.5, 3);
  expect(initial.y).toBeCloseTo(initial.ground + 1, 2);

  const cleared = await page.evaluate(() => {
    const input = (window as any).__game.input;
    input.touchMoveX = 0.8;
    input.touchMoveZ = -0.6;
    input.touchJump = true;
    window.dispatchEvent(new Event('blur'));
    return input.getMoveInput();
  });
  expect(cleared).toEqual({ x: 0, z: 0, jump: false, down: false });
});

test('the enlarged map shows all six numbered phases', async ({ page }) => {
  const labels = await page.evaluate(() => {
    const game = (window as any).__game;
    game.hotbar.assignToSelected(309);
    game.input.setTouchActive(true);
    return game.miniMap.marks.slice(0, 6).map((mark: { label: string }) => mark.label);
  });

  await expect(page.locator('#minimap')).toBeVisible();
  const mapBox = await page.locator('.minimap-canvas').boundingBox();
  expect(mapBox?.width).toBeGreaterThanOrEqual(670);
  expect(labels).toEqual([
    '1. Bunicul Fierar',
    '2. Moș Căliman',
    '3. Baciul Luncii',
    '4. Ciobănașul Codrin',
    '5. Muma Pădurii',
    '6. Baba Dochia',
  ]);
});

test('all lessons accept their canonical browser program', async ({ page }) => {
  test.setTimeout(180_000);
  const results = await page.evaluate(async () => {
    const game = (window as any).__game;
    const puzzles = (window as any).__puzzles;
    const output: { id: string; success: boolean; text: string }[] = [];
    for (const id of Object.keys(puzzles)) {
      const result = await game.solveLesson(id);
      output.push({ id, success: result?.success === true, text: result?.text ?? '' });
    }
    return output;
  });

  expect(results).toHaveLength(33);
  expect(results.filter((result) => !result.success)).toEqual([]);
  for (const result of results) expect(result.text, result.id).not.toBe('');
});

test('a wrong sequence fails and solving again grants the reward again', async ({ page }) => {
  const outcome = await page.evaluate(async () => {
    const game = (window as any).__game;
    const puzzle = (window as any).__puzzles.fantana;
    const rewardIds = puzzle.rewardItems.map((item: { id: number }) => item.id);
    const counts = () => rewardIds.map((id: number) => game.inventory.count(id));

    const wrong = await game.solveLesson('fantana', [{ kind: 'action', id: 'coboara' }]);
    const before = counts();
    const first = await game.solveLesson('fantana');
    const afterFirst = counts();
    const second = await game.solveLesson('fantana');
    const afterSecond = counts();
    return { wrong, first, second, before, afterFirst, afterSecond };
  });

  expect(outcome.wrong?.success).toBe(false);
  expect(outcome.first?.success).toBe(true);
  expect(outcome.second?.success).toBe(true);
  expect(outcome.afterFirst.map((count, index) => count - outcome.before[index])).toEqual([1, 1]);
  expect(outcome.afterSecond.map((count, index) => count - outcome.afterFirst[index])).toEqual([1, 1]);
});

test('the real Run button hides the editor for animation and opens it with feedback', async ({ page }) => {
  const prepared = await page.evaluate(() => (window as any).__game.prepareLesson('fantana'));
  expect(prepared).toBe(true);
  await expect(page.locator('#tabla')).not.toHaveClass(/hidden/);

  await page.locator('.tabla-run').click();
  await expect(page.locator('#tabla')).toHaveClass(/hidden/);
  await expect(page.locator('#tabla')).not.toHaveClass(/hidden/, { timeout: 20_000 });
  await expect(page.locator('.tabla-status')).toContainText('APA CURGE');
});
