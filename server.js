const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');

const app = express();
const PORT = process.env.PORT || 3030;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'supernovia-scraper' });
});

// Route de scraping générique
app.post('/scrape', async (req, res) => {
  const { url, credentials, database } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL requise' });
  }

  console.log(`[Scraper] Request for ${database || 'generic'}: ${url}`);

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    });

    const page = await context.newPage();

    // Si credentials fournis, gérer le login selon le database type
    if (credentials && database) {
      await handleLogin(page, database, credentials);
    }

    // Navigation vers l'URL cible
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await page.waitForTimeout(3000);

    // Extraction du contenu
    const content = await extractContent(page, database);

    await browser.close();

    res.json({
      success: true,
      content,
      extractedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[Scraper] Error:', error);
    if (browser) await browser.close();

    res.status(500).json({
      error: error.message || 'Erreur de scraping'
    });
  }
});

// Fonction de login selon la base
async function handleLogin(page, database, credentials) {
  const { username, password } = credentials;

  switch (database) {
    case 'lexisnexis':
      await loginLexis(page, username, password);
      break;
    case 'dalloz':
      await loginDalloz(page, username, password);
      break;
    case 'doctrine':
      await loginDoctrine(page, username, password);
      break;
    case 'lamyline':
      await loginLamyline(page, username, password);
      break;
    case 'linkedin':
      await loginLinkedIn(page, username, password);
      break;
  }
}

// Login LexisNexis (OAuth2)
async function loginLexis(page, username, password) {
  console.log('[Lexis] Logging in...');
  await page.goto('https://www.lexis360intelligence.fr/login');
  await page.waitForTimeout(2000);

  await page.fill('#userid', username);
  await page.click('#signInSbmtBtn');
  await page.waitForSelector('#password', { timeout: 10000 });
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(10000); // OAuth redirect

  console.log('[Lexis] Login complete');
}

// Login Dalloz (2-step)
async function loginDalloz(page, username, password) {
  console.log('[Dalloz] Logging in...');
  await page.goto('https://connexion.dalloz.fr/login');
  await page.waitForTimeout(2000);

  await page.fill('#username', username);
  await page.click('#soumettre');
  await page.waitForTimeout(3000);

  await page.fill('#password', password);
  await page.click('#soumettre');
  await page.waitForTimeout(5000);

  console.log('[Dalloz] Login complete');
}

// Login Doctrine (2-step)
async function loginDoctrine(page, username, password) {
  console.log('[Doctrine] Logging in...');
  // Si redirection login
  if (page.url().includes('/login') || page.url().includes('/auth')) {
    await page.fill('input[name="username"], input[type="email"]', username);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);
  }

  console.log('[Doctrine] Login complete');
}

// Login Lamyline (1-step)
async function loginLamyline(page, username, password) {
  console.log('[Lamyline] Logging in...');
  await page.fill('#username', username);
  await page.fill('#password', password);
  await page.click('#btnlogin', { force: true });
  await page.waitForTimeout(5000);

  console.log('[Lamyline] Login complete');
}

// Login LinkedIn (2-step + 2FA)
async function loginLinkedIn(page, username, password) {
  console.log('[LinkedIn] Logging in...');
  await page.goto('https://www.linkedin.com/login');
  await page.waitForTimeout(2000);

  await page.fill('input[name="session_key"]', username);
  await page.fill('input[name="session_password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(15000); // Temps pour 2FA manuel

  console.log('[LinkedIn] Login complete');
}

// Extraction de contenu selon la base
async function extractContent(page, database) {
  let selectors = [];

  switch (database) {
    case 'lexisnexis':
      selectors = ['article', 'main', '.document-content'];
      break;
    case 'dalloz':
      selectors = ['#content', '.flash-content', 'article'];
      break;
    case 'doctrine':
      selectors = ['article', '[data-test-id="document-content"]'];
      break;
    case 'lamyline':
      selectors = ['#cDocument', '#dTxT', 'div.mainContent'];
      break;
    case 'linkedin':
      selectors = ['.feed-shared-update-v2__description', '.break-words'];
      break;
    default:
      selectors = ['article', 'main', '#content', 'body'];
  }

  return await page.evaluate((sels) => {
    for (const selector of sels) {
      const el = document.querySelector(selector);
      if (el && el.textContent && el.textContent.trim().length > 100) {
        return el.textContent.trim();
      }
    }
    return document.body.textContent?.trim() || '';
  }, selectors);
}

app.listen(PORT, () => {
  console.log(`🚀 Supernovia Scraper running on port ${PORT}`);
  console.log(`   Playwright installed: ${process.env.PLAYWRIGHT_BROWSERS_PATH || 'default'}`);
});
