module.exports = async ({ page, context }) => {
  // Get URL from context
  const { url } = context;

  // Set viewport size
  await page.setViewport({ width: 1366, height: 768 });

  // Goto URL and wait for content and animations
  await page.goto(url, { timeout: 6000 });
  await page.content();
  await page.waitForTimeout(2000);

  // Try accepting cookies to hide cookie notice
  // by clicking on any suspicious button
  const cookiesAgreed = await page.evaluate(() => {
    let cookiesAgreed = false;
    if (document.body.textContent.match(/cookie/i)) {
      document
        .querySelectorAll('a, button, [type="button"], [type="submit"]')
        .forEach((element) => {
          if (
            [element.textContent, element.name, element.value].some(
              (content) =>
                typeof content === 'string' &&
                content.match(
                  /(akzeptieren|verstanden|zustimmen|stimme zu|okay|^ok|accept|understand|agree|allow|enable|close)/i
                )
            )
          ) {
            element.click();
            cookiesAgreed = true;
          }
        });
    }
    return cookiesAgreed;
  });

  // If cookies have been agreed, wait for animations
  if (cookiesAgreed) {
    await page.waitForTimeout(500);
  }

  // Take screenshot of website
  const data = await page.screenshot({
    type: 'jpeg',
    quality: 80,
    encoding: 'base64',
  });

  // Return screenshot as buffer
  return { type: 'text/plain', data };
};
