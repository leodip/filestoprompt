const fs = require('fs');
const path = require('path');

// Read the package.json file
const packageJsonPath = path.join(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Parse the current version
const versionParts = packageJson.version.split('.');
let [major, minor, patch] = versionParts;

// If patch has a build number (e.g., "0-1"), split it
const patchParts = patch.toString().split('-');
const patchNumber = patchParts[0];
let buildNumber = patchParts.length > 1 ? parseInt(patchParts[1]) : 0;

// Increment the build number
buildNumber++;

// Set the new version
packageJson.version = `${major}.${minor}.${patchNumber}-${buildNumber}`;

// Write the updated package.json file
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

console.log(`Version updated to ${packageJson.version}`);