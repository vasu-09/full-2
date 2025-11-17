const fs = require('node:fs');
const path = require('node:path');

let envLoaded = false;

const loadEnvFile = () => {
  if (envLoaded) {
    return;
  }

  envLoaded = true;
  const envPath = path.join(__dirname, '.env');

  if (!fs.existsSync(envPath)) {
    return;
  }

  const raw = fs.readFileSync(envPath, 'utf8');
  raw
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .forEach((line) => {
      const [key, ...rest] = line.split('=');
      if (!key) {
        return;
      }

      const value = rest.join('=').trim();
      if (value && process.env[key] === undefined) {
        const normalized = value.replace(/^['"]|['"]$/g, '');
        process.env[key] = normalized;
      }
    });
};

module.exports = () => {
  const { expo } = require('./app.json');
  loadEnvFile();

  const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL || expo?.extra?.apiBaseUrl || '';

  return {
    ...expo,
    extra: {
      ...expo?.extra,
      apiBaseUrl,
    },
  };
};