const manifest = require('../manifest.json');
const pkg = require('../package.json');
const versions = require('../versions.json');
const tag = process.env.GITHUB_REF_NAME || process.argv[2];
if (!tag || tag !== manifest.version || pkg.version !== manifest.version || versions[tag] !== manifest.minAppVersion) {
  throw new Error('Release tag, manifest, package and versions.json must agree');
}
console.log(`Validated release ${tag}`);
