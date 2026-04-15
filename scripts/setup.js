/**
 * Site-to-DS — Setup Script
 * Detects environment and installs Playwright + Chromium
 */

const { execSync } = require('child_process');
const fs = require('fs');

function run(cmd) {
  try { return execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' }).trim(); } catch { return ''; }
}

function main() {
  console.log('\n🌾 Site-to-DS — Environment Setup\n');

  // Node version check
  const nodeVersion = process.version.match(/v(\d+)/)?.[1];
  if (!nodeVersion || parseInt(nodeVersion) < 16) {
    console.error('❌ Node.js 16+ required. Current:', process.version);
    process.exit(1);
  }
  console.log(`✅ Node.js ${process.version}`);

  // Detect package manager
  const pm = fs.existsSync('pnpm-lock.yaml') ? 'pnpm'
    : fs.existsSync('yarn.lock') ? 'yarn' : 'npm';
  console.log(`📦 Package manager: ${pm}`);

  // Install Playwright
  try {
    require.resolve('playwright');
    console.log('✅ Playwright already installed');
  } catch {
    console.log('📥 Installing Playwright...');
    execSync(`${pm} ${pm === 'npm' ? 'install' : 'add'} playwright`, { stdio: 'inherit' });
  }

  // Install Chromium
  console.log('🌐 Ensuring Chromium browser...');
  execSync('npx playwright install chromium', { stdio: 'inherit' });

  console.log('\n✅ Setup complete! Run: node site-to-ds/scripts/harvest.js <URL>\n');
}

main();
