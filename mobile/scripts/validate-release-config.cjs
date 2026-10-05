const { readFileSync } = require('node:fs');
const { join } = require('node:path');
function validateReleaseConfig(config) {
  if (!config || typeof config.apiBaseUrl !== 'string' || !config.apiBaseUrl.trim()) throw new Error('Set config/environment.json apiBaseUrl to the approved live HTTPS API before a Release build.');
  const url = new URL(config.apiBaseUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || ['localhost','127.0.0.1'].includes(url.hostname) || /\.(example|invalid)$/.test(url.hostname)) throw new Error('Release requires a real HTTPS API origin, without credentials, query parameters, or a fragment.');
  return true;
}
module.exports = { validateReleaseConfig };
if (require.main === module) {
  try { validateReleaseConfig(JSON.parse(readFileSync(join(__dirname, '../config/environment.json'), 'utf8'))); console.log('Release API configuration is valid.'); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
