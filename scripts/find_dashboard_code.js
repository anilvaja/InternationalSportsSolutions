import fs from 'fs';

const appJs = fs.readFileSync('public/js/app.js', 'utf8');
const lines = appJs.split('\n');

console.log('--- Search in public/js/app.js ---');
lines.forEach((line, i) => {
  if (line.includes("navigate(tab") || line.includes("renderOverview") || line.includes("renderDashboard") || line.includes("loadOverview") || line.includes("/api/academy/dashboard") || line.includes("/api/academy/overview")) {
    console.log(`${i + 1}: ${line.trim().slice(0, 120)}`);
  }
});
