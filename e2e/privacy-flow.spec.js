const { test, expect } = require("@playwright/test");

const firebaseAppMock = `
export function initializeApp(config) { return { config }; }
`;
const firebaseAuthMock = `
const state = { currentUser: null, listeners: [] };
export function getAuth() { return state; }
export async function getRedirectResult() { return null; }
export function onAuthStateChanged(auth, callback) {
  auth.listeners.push(callback);
  queueMicrotask(() => callback(auth.currentUser));
  return () => {};
}
function setUser(auth, email) {
  const user = { uid: "browser-test-user", email, displayName: "Browser Test", getIdToken: async () => "browser-test-token" };
  auth.currentUser = user;
  auth.listeners.forEach(callback => callback(user));
  return user;
}
export async function createUserWithEmailAndPassword(auth, email) { const user = setUser(auth, email); return { user }; }
export async function signInWithEmailAndPassword(auth, email) { const user = setUser(auth, email); return { user }; }
export async function signOut(auth) { auth.currentUser = null; auth.listeners.forEach(callback => callback(null)); }
export class GoogleAuthProvider { setCustomParameters() {} }
export async function signInWithRedirect() {}
`;

async function mockBrowserServices(page) {
  await page.route("https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js", route =>
    route.fulfill({ status: 200, contentType: "application/javascript", body: firebaseAppMock })
  );
  await page.route("https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js", route =>
    route.fulfill({ status: 200, contentType: "application/javascript", body: firebaseAuthMock })
  );
  await page.route("https://cdn.tailwindcss.com/**", route => route.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
  await page.route("https://fonts.googleapis.com/**", route => route.abort());
  await page.route("https://fonts.gstatic.com/**", route => route.abort());
  await page.route("**/api/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    let body = {};
    try { body = request.postDataJSON() || {}; } catch (_) {}
    if (url.pathname === "/api/session") return route.fulfill({ json: { isAdmin: false, isPrimaryAdmin: false, permissions: [] } });
    if (url.pathname === "/api/profile" && method === "GET") return route.fulfill({ json: { profile: null } });
    if (url.pathname === "/api/profile" && method === "POST") return route.fulfill({ json: { ok: true, profile: body } });
    if (url.pathname === "/api/support/tickets") return route.fulfill({ json: { tickets: [] } });
    if (url.pathname === "/api/privacy/consent") return route.fulfill({ json: { ok: true, consent: body.consent === true, version: "2026-11-11-v1" } });
    if (url.pathname === "/api/privacy/requests" && method === "GET") return route.fulfill({ json: { requests: [] } });
    if (url.pathname === "/api/privacy/requests" && method === "POST") return route.fulfill({ status: 201, json: { ok: true, requestId: "privacy-e2e", status: "pending" } });
    if (url.pathname === "/api/my-data/export") return route.fulfill({ json: { product: "NeuroEval Pro", account: { email: "browser@example.com" }, evaluations: [] } });
    if (url.pathname === "/api/evaluations" && method === "POST") return route.fulfill({ status: 201, json: { ok: true, id: "evaluation-e2e", reference: "NEURO-E2E", paymentStatus: "pending", amountCop: 4000, currency: "COP" } });
    if (url.pathname === "/api/my-evaluations/evaluation-e2e/payment-status") return route.fulfill({ json: { id: "evaluation-e2e", paymentStatus: "pending", reference: "NEURO-E2E", amountCop: 4000, currency: "COP" } });
    return route.fulfill({ status: 200, json: { ok: true, tickets: [], requests: [] } });
  });
}

test("registration, bilingual UI, sensitive-consent gate and assessment payment handoff", async ({ page }) => {
  await mockBrowserServices(page);
  await page.goto("/");
  await expect(page.locator("#auth-view")).toBeVisible();
  await expect(page.locator("#global-language")).toHaveValue("es");

  await page.locator("#global-language").selectOption("en");
  await expect(page.locator("#auth-view h1")).toContainText("Understand how your mind works");
  await expect(page.locator('a[data-legal-link="privacy"]')).toHaveAttribute("href", "/legal/privacy-en.html");

  await page.locator("#show-register").click();
  await page.locator("#reg-name").fill("Browser Test");
  await page.locator("#reg-email").fill("browser@example.com");
  await page.locator("#reg-password").fill("SafePass123!");
  await page.locator("#reg-age").fill("29");
  await page.locator("#reg-goal").selectOption({ label: "Focus" });
  await page.locator("#consent").check();
  await page.locator("#register-form button[type=submit]").click();

  await expect(page.locator("#dashboard-view")).toBeVisible();
  await page.locator("#start-adhd-evaluation").click();
  await expect(page.locator("#sensitive-consent-view")).toBeVisible();
  await expect(page.locator("#quiz-view")).toBeHidden();
  await page.locator("#sensitive-consent-checkbox").check();
  await page.locator("#sensitive-consent-form button[type=submit]").click();
  await expect(page.locator("#quiz-view")).toBeVisible();

  for (let step = 0; step < 30; step++) {
    if (await page.locator("#payment-view").isVisible()) break;
    const answers = page.locator("#answers button");
    await expect(answers.first()).toBeVisible();
    await answers.first().click();
    await page.locator("#next-question").click();
  }
  await expect(page.locator("#payment-view")).toBeVisible();
  await expect(page.locator("#payment-price")).toContainText("4,000");
});

test("privacy documents open and account privacy controls export data and submit requests", async ({ page }) => {
  await mockBrowserServices(page);
  await page.goto("/legal/privacy-es.html");
  await expect(page.getByRole("heading", { name: /Política de tratamiento de datos personales/ })).toBeVisible();
  await page.goto("/legal/terms-en.html");
  await expect(page.getByRole("heading", { name: /Terms and Conditions of Use/ })).toBeVisible();

  await page.goto("/");
  await page.locator("#show-register").click();
  await page.locator("#reg-name").fill("Browser Test");
  await page.locator("#reg-email").fill("browser2@example.com");
  await page.locator("#reg-password").fill("SafePass123!");
  await page.locator("#reg-age").fill("31");
  await page.locator("#reg-goal").selectOption("autoconocimiento");
  await page.locator("#consent").check();
  await page.locator("#register-form button[type=submit]").click();
  await expect(page.locator("#dashboard-view")).toBeVisible();

  await page.locator("#account-menu-toggle").click();
  await page.locator("#menu-settings").click();
  await expect(page.locator("#privacy-request-form")).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#settings-export-data").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("neuroeval-pro-mis-datos.json");

  await page.locator("#privacy-request-type").selectOption("deletion");
  await page.locator("#privacy-request-details").fill("Solicito revisión de supresión de mi cuenta.");
  await page.locator("#privacy-request-submit").click();
  await expect(page.locator("#privacy-request-status")).toContainText("Solicitud registrada");
});

test("family observation requires both guardian authority and sensitive-data consent", async ({ page }) => {
  await mockBrowserServices(page);
  await page.goto("/");
  await page.locator("#show-register").click();
  await page.locator("#reg-name").fill("Parent Browser Test");
  await page.locator("#reg-email").fill("parent-browser@example.com");
  await page.locator("#reg-password").fill("SafePass123!");
  await page.locator("#reg-age").fill("35");
  await page.locator("#reg-goal").selectOption("autoconocimiento");
  await page.locator("#consent").check();
  await page.locator("#register-form button[type=submit]").click();
  await expect(page.locator("#dashboard-view")).toBeVisible();
  await page.locator("#start-parent-evaluation").click();
  await page.locator("#parent-child-age").selectOption("12");
  await page.locator("#parent-relationship").selectOption({ index: 1 });
  await page.locator("#parent-setting-home").check();
  await page.locator("#parent-guardian-consent").check();
  await page.locator("#parent-evaluation-form button[type=submit]").click();
  await expect(page.locator("#parent-intro-message")).toContainText("autorizar expresamente");
  await expect(page.locator("#quiz-view")).toBeHidden();
  await page.locator("#parent-sensitive-consent").check();
  await page.locator("#parent-evaluation-form button[type=submit]").click();
  await expect(page.locator("#quiz-view")).toBeVisible();
});
