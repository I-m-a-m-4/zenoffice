const fs = require('fs');
const path = require('path');

const files = ['ar.ts', 'de.ts', 'es.ts', 'fr.ts', 'hi.ts', 'it.ts', 'ja.ts', 'ko.ts', 'pt.ts', 'zh.ts'];
const dir = path.join(__dirname, '..', 'src', 'lib', 'i18n', 'messages');

files.forEach(file => {
    const filepath = path.join(dir, file);
    if (!fs.existsSync(filepath)) {
        console.log(`File not found: ${filepath}`);
        return;
    }
    let content = fs.readFileSync(filepath, 'utf8');
    
    // Check if keys already exist
    if (content.includes('healthNegativeStock')) {
        console.log(`${file} already patched.`);
        return;
    }
    
    // Find healthMissingImages line and insert after it
    const searchStr = /healthMissingImages:\s*['"].*?['"],/g;
    const match = content.match(searchStr);
    if (match) {
        const replacement = `${match[0]}\n    healthNegativeStock: 'Negative Stock',\n    healthMissingCostPrice: 'No Cost Price',`;
        content = content.replace(searchStr, replacement);
        fs.writeFileSync(filepath, content, 'utf8');
        console.log(`Patched ${file}`);
    } else {
        console.log(`Could not find healthMissingImages in ${file}`);
    }
});
