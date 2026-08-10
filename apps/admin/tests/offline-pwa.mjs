/* eslint-disable no-undef */
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ serviceWorkers: 'allow', viewport: { width: 390, height: 844 } });
const page = await context.newPage();
page.on('console', (m) => console.log('browser:', m.type(), m.text()));
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto('http://localhost:4173/pos/', { waitUntil: 'networkidle' });
await page.getByLabel('Usuario o email').fill('admin');
await page.getByLabel('Contraseña').fill('Cambiar123!');
await page.getByRole('button', { name: 'Ingresar' }).click();
await page.waitForURL('http://localhost:4173/pos/');
await page.getByText('Panel administrativo').waitFor();
await page.evaluate(() => navigator.serviceWorker.ready);
const pwa = await page.evaluate(async () => {
  const manifestLink = document.querySelector('link[rel="manifest"]');
  const registration = await navigator.serviceWorker.getRegistration();
  return { manifest: manifestLink?.getAttribute('href'), controlled: Boolean(registration?.active) };
});
console.log('pwa', pwa);
if (!pwa.manifest || !pwa.controlled) throw new Error('Manifest o Service Worker no disponible');
await page.getByRole('button', { name: /Sincronizar ahora/ }).click();
await page.waitForFunction(
  () => document.body.innerText.includes('Online') && document.body.innerText.includes('Última:'),
);
const counts = await page.evaluate(async () => {
  const req = indexedDB.open('rincon-offline');
  const db = await new Promise((ok, no) => {
    req.onsuccess = () => ok(req.result);
    req.onerror = () => no(req.error);
  });
  const count = (n) =>
    new Promise((ok, no) => {
      const tx = db.transaction(n);
      const r = tx.objectStore(n).count();
      r.onsuccess = () => ok(r.result);
      r.onerror = () => no(r.error);
    });
  return {
    products: await count('products'),
    categories: await count('categories'),
    brands: await count('brands'),
    branches: await count('branches'),
    branchProducts: await count('branchProducts'),
  };
});
console.log('online-counts', counts);
if (!counts.products || !counts.branchProducts) throw new Error('IndexedDB no fue sincronizada');
await page.screenshot({ path: '/tmp/rincon-pwa-mobile-online.png', fullPage: true });
await context.setOffline(true);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.getByText('Panel administrativo').waitFor();
await page.goto('http://localhost:4173/pos/products', { waitUntil: 'domcontentloaded' });
console.log('offline-body', (await page.locator('body').innerText()).slice(0, 1000));
await page.getByRole('heading', { name: 'Productos de la sucursal' }).waitFor();
await page.getByText('Gaseosa Cola 2,25 L').waitFor();
const offlineCounts = await page.evaluate(async () => {
  const req = indexedDB.open('rincon-offline');
  const db = await new Promise((ok) => {
    req.onsuccess = () => ok(req.result);
  });
  return await new Promise((ok) => {
    const r = db.transaction('products').objectStore('products').count();
    r.onsuccess = () => ok(r.result);
  });
});
console.log('offline-products', offlineCounts);
await page.screenshot({ path: '/tmp/rincon-pwa-mobile-offline.png', fullPage: true });
await context.setOffline(false);
await page.waitForFunction(async () => {
  try {
    return (await fetch('/pos/api/health')).ok;
  } catch {
    return false;
  }
});
await page.getByRole('button', { name: /Sincronizar ahora/ }).click();
await page.waitForFunction(() => document.body.innerText.includes('Online'));
console.log('restored-online', true);
await browser.close();
