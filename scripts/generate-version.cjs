const fs = require('fs');
const path = require('path');

const now = new Date();
const versionData = {
  version: '1.3.0',
  buildTime: now.getTime(),
  buildDate: now.toISOString(),
  description: 'Auto-sélection des meilleures IA par spécialité & Répartition rapide',
};

const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const targetPath = path.join(publicDir, 'version.json');
fs.writeFileSync(targetPath, JSON.stringify(versionData, null, 2), 'utf8');
console.log('✓ version.json generated successfully: Build time = ' + versionData.buildTime);
