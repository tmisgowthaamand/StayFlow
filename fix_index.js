import fs from 'fs';
const content = fs.readFileSync('src/index.js', 'utf8').split('\n');
let skip = 0;
for (let i = 1; i < content.length; i++) {
    if (content[i].trim().startsWith('import express')) {
        skip = i;
        break;
    }
}
fs.writeFileSync('src/index.js', content.slice(skip).join('\n'));
console.log(`Skipped ${skip} lines.`);
