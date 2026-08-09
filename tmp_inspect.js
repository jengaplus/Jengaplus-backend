const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'App.js');
const content = fs.readFileSync(file, 'utf8');
const lines = content.split(/\r?\n/);
const start = 1355;
const end = 1370;
for (let i = start; i <= end; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}
