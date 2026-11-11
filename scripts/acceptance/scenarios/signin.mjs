// Sign-in route regression only. No email is sent and no identity is replaced.
export async function signin({ browser, base, evidence }) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    for (const query of ["intent=signin", "taken=existing%40example.test"]) {
      await page.goto(`${base}/login?next=%2Fapps&${query}`);
      evidence.record("signin", "signed-out", "existing-account route offers a usable sign-in form", await page.getByRole("heading", { name: "Sign in to your account.", exact: true }).isVisible());
      evidence.record("signin", "signed-out", "the action is clearly existing-account sign-in", await page.getByRole("button", { name: "Email me a sign-in link", exact: true }).isVisible());
      evidence.record("signin", "signed-out", "the old account-collision dead end is absent", await page.getByRole("heading", { name: "That email already has an account.", exact: true }).count() === 0);
      if (query.startsWith("taken")) evidence.record("signin", "signed-out", "the existing email is retained", await page.getByLabel("Email", { exact: true }).inputValue() === "existing@example.test");
    }
  } finally { await context.close(); }
}
