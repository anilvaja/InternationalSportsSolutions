import fs from 'fs';
const lines = fs.readFileSync('public/js/app.js', 'utf8').split('\n');
lines.forEach((l, i) => {
  if (l.includes('SetupWizardController') || l.includes('setupWizard') || l.includes('openWizard') || l.includes('completeness')) {
    console.log(`${i+1}: ${l.trim()}`);
  }
});

