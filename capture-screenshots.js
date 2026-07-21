const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const SCREENSHOTS_DIR = path.join(__dirname, 'assets', 'screenshots');

// Ensure directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// 1. Create a mock config.json for the backend server
const serverConfigPath = path.join(__dirname, 'server', 'config.json');
const mockConfig = {
  workspaces: [
    {
      "id": "mock-oroborous",
      "name": "Oroborous Workspace",
      "path": __dirname
    }
  ],
  activeWorkspaceId: "mock-oroborous",
  aiSettings: {
    "provider": "ollama",
    "baseUrl": "http://localhost:11434",
    "apiKey": "",
    "model": "llama3"
  },
  vibeMode: true
};
fs.writeFileSync(serverConfigPath, JSON.stringify(mockConfig, null, 2));
console.log('Mock server config written.');

// Helper to wait for a port to be open
function waitForPort(port, timeout = 60000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (Date.now() - start > timeout) {
        clearInterval(interval);
        reject(new Error(`Timeout waiting for port ${port}`));
        return;
      }

      const req = http.get(`http://localhost:${port}/`, (res) => {
        clearInterval(interval);
        resolve();
      });

      req.on('error', () => {
        // Port not open yet, keep waiting
      });
    }, 1000);
  });
}

async function run() {
  let backendProcess;
  let frontendProcess;
  let browser;

  try {
    // 2. Start Backend Server
    console.log('Starting backend server...');
    backendProcess = spawn('node', ['server/index.js'], { stdio: 'inherit' });

    // 3. Start Expo Web
    console.log('Starting Expo Web...');
    frontendProcess = spawn('node', ['node_modules/expo/bin/cli', 'start', '--web', '--non-interactive'], {
      env: { ...process.env, PORT: '8081' },
      stdio: 'inherit'
    });

    // 4. Wait for ports
    console.log('Waiting for backend (3005) and frontend (8081) to start...');
    await Promise.all([
      waitForPort(3005),
      waitForPort(8081)
    ]);
    console.log('Both servers are up and running!');

    // 5. Launch Puppeteer
    console.log('Launching Puppeteer...');
    let puppeteer;
    try {
      puppeteer = require('puppeteer');
    } catch (e) {
      console.log('Puppeteer not found in project root, trying /tmp/puppeteer...');
      puppeteer = require('/tmp/puppeteer/node_modules/puppeteer');
    }
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    // Set a premium mobile viewport size (Material 3 Expressive Mobile Viewport)
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

    // --- SCREENSHOT 1: Login Screen ---
    console.log('Navigating to Login screen...');
    await page.goto('http://localhost:8081');
    // Wait for the app to render
    await page.waitForSelector('[accessibilityLabel="continue-claude"]', { timeout: 30000 });
    // Soft delay for animations to finish
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'login.png') });
    console.log('Login screenshot saved.');

    // --- SCREENSHOT 2: Dashboard Screen ---
    console.log('Navigating to Dashboard...');
    await page.click('[accessibilityLabel="continue-claude"]');
    // Wait for dashboard title to render
    await page.waitForSelector('[accessibilityLabel="workspace-card"]', { timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'dashboard.png') });
    console.log('Dashboard screenshot saved.');

    // --- SCREENSHOT 3: Settings Screen ---
    console.log('Navigating to Settings...');
    await page.click('[accessibilityLabel="settings"]');
    // Wait for settings title or provider buttons
    await page.waitForSelector('text/AI Integration Engine', { timeout: 10000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'settings.png') });
    console.log('Settings screenshot saved.');

    // Go back to Dashboard
    console.log('Returning to Dashboard...');
    await page.goto('http://localhost:8081');
    await page.waitForSelector('[accessibilityLabel="workspace-card"]', { timeout: 15000 });

    // --- SCREENSHOT 4: Workspace IDE Screen ---
    console.log('Opening Workspace IDE...');
    await page.click('[accessibilityLabel="workspace-card"]');
    // Wait for Workspace Screen UI (e.g. terminal or IDE header)
    await page.waitForSelector('[accessibilityLabel="tab-terminal"]', { timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'workspace.png') });
    console.log('Workspace screenshot saved.');

  } catch (error) {
    console.error('Error during screenshot generation:', error);
  } finally {
    if (browser) {
      console.log('Closing browser...');
      await browser.close();
    }
    if (backendProcess) {
      console.log('Stopping backend server...');
      backendProcess.kill();
    }
    if (frontendProcess) {
      console.log('Stopping Expo Web...');
      frontendProcess.kill();
    }
    console.log('Screenshot process completed.');
    process.exit(0);
  }
}

run();