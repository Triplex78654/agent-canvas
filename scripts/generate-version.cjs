const fs = require('fs');
const path = require('path');

// The version shown in the app always comes from package.json (single source of truth).
const pkg = require('../package.json');
const now = new Date();
const versionData = {
  version: pkg.version,
  buildTime: now.getTime(),
  buildDate: now.toISOString(),
  description: 'Agent Canvas ' + pkg.version,
};

const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const targetPath = path.join(publicDir, 'version.json');
fs.writeFileSync(targetPath, JSON.stringify(versionData, null, 2), 'utf8');
console.log('✓ version.json generated: ' + pkg.version + ' @ ' + versionData.buildDate);
