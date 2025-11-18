const fs = require('node:fs');
const os = require('node:os');
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

const detectLanIPv4 = () => {
  const nets = os.networkInterfaces();
  const candidates = [];

  for (const entries of Object.values(nets)) {
    if (!entries) continue;
    for (const entry of entries) {
      if (!entry || entry.family !== 'IPv4' || entry.internal) continue;
      if (!entry.address || entry.address.startsWith('169.254.')) continue;
      candidates.push(entry.address);
    }
  }

  return candidates[0] ?? null;
};

const inferDevApiBaseUrl = () => {
  const isBuild = process.env.EAS_BUILD === 'true' || process.env.CI === 'true';
  const isProduction = process.env.NODE_ENV === 'production';
  if (isBuild || isProduction) {
    return null;
  }

  const ip = detectLanIPv4();
  if (!ip) {
    console.warn('[app.config] Could not detect LAN IPv4. Set EXPO_PUBLIC_API_URL manually.');
    return null;
  }

  const port = process.env.EXPO_PUBLIC_API_PORT || '8080';
  const url = `http://${ip}:${port}`;
  console.log(`[app.config] Defaulting EXPO_PUBLIC_API_URL to ${url}`);
  return url;
};

module.exports = () => {
  const { expo } = require('./app.json');
  loadEnvFile();

  let apiBaseUrl = process.env.EXPO_PUBLIC_API_URL || expo?.extra?.apiBaseUrl || '';
  if (!apiBaseUrl) {
    apiBaseUrl = inferDevApiBaseUrl() || '';
  }

  return {
    ...expo,
    extra: {
      ...expo?.extra,
      apiBaseUrl,
    },
  };
};