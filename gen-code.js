#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const chaptersDir = path.join(process.cwd(), 'chapters', 'zh');
const codeDir = path.join(process.cwd(), 'code');

// Ensure code directory exists
if (!fs.existsSync(codeDir)) {
  fs.mkdirSync(codeDir, { recursive: true });
}

// Reading directory
const files = fs.readdirSync(chaptersDir).filter(f => f.endsWith('.md'));

let count = 0;
for (const file of files) {
  // Extract chapter number or prefix
  const prefixMatch = file.match(/^(\d+)_/);
  let outName;
  if (prefixMatch) {
     outName = `ch${prefixMatch[1]}.html`;
  } else {
     // Handle cases like appendix_a_mini_react.md
     const nameMatch = file.match(/^([^_]+(?:_[^_]+)?)/); // gets appendix_a
     const name = nameMatch ? nameMatch[1] : file.replace('.md', '');
     outName = `${name}.html`;
  }
  
  const filePath = path.join(chaptersDir, file);
  
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Find all ```html blocks
  const regex = /```html\n([\s\S]*?)\n```/g;
  let match;
  let lastMatchContent = null;
  
  while ((match = regex.exec(content)) !== null) {
    lastMatchContent = match[1]; // Get the content inside the block
  }
  
  if (lastMatchContent !== null) {
    fs.writeFileSync(path.join(codeDir, outName), lastMatchContent);
    console.log(`√ Extracted ${outName} from ${file}`);
    count++;
  } else {
    console.log(`- No HTML block found in ${file}`);
  }
}

console.log(`\n🎉 Done! Successfully extracted ${count} HTML files to the ${codeDir} directory.`);
