const fs = require('fs');

const path = 'src/types.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/export interface Product \{[\s\S]*?export type TopSellingItem = Product & \{\n    quantitySold: number;\n\};/m, '// Removed inventory types\n');
content = content.replace(/export interface CustomerInsightsOutput \{[\s\S]*?export interface ContentPlanner \{[\s\S]*?\n\}/m, '// Removed sales and AI types\n');
content = content.replace(/export interface BusinessAnalysisOutput \{[\s\S]*?export interface Branch \{[\s\S]*?\n\}/m, '// Removed analysis and branch\n');
content = content.replace(/export interface BusinessStats \{[\s\S]*?export interface SupplierPurchase \{[\s\S]*?\n\}/m, '// Removed stats and expenses\n');
content = content.replace(/businessAnalysis\?: BusinessAnalysisOutput;/g, '');
content = content.replace(/aiTroubleshootSuggestions\?: AISuggestions;/g, '');

fs.writeFileSync(path, content);
console.log('types.ts cleaned!');
