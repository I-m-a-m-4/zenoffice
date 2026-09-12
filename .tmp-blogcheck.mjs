import ts from 'typescript';
import fs from 'fs';

const src = fs.readFileSync('src/lib/blog-data.ts', 'utf8');
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
fs.writeFileSync('.tmp-blogcheck-out.mjs', js);
const mod = await import('./.tmp-blogcheck-out.mjs');
const posts = mod.allBlogPosts;

const words = (s) => (s || '').trim().split(/\s+/).filter(Boolean).length;

const rows = posts.map(p => ({
  slug: p.slug,
  words: words(p.content),
  faq: (p.faq || []).length,
  tbl: p.tableData ? p.tableData.rows.length : 0,
  titleLen: p.title.length,
}));

rows.sort((a, b) => a.words - b.words);
console.log('total posts:', posts.length);
console.log('slug dups:', posts.length - new Set(posts.map(p => p.slug)).size);
console.log('title dups:', posts.length - new Set(posts.map(p => p.title)).size);
console.log('');
console.log('words faq tbl  titleLen  slug');
for (const r of rows) {
  console.log(String(r.words).padStart(5), String(r.faq).padStart(3), String(r.tbl).padStart(3), String(r.titleLen).padStart(9), ' ', r.slug);
}

// internal links resolve?
const slugs = new Set(posts.map(p => p.slug));
const bad = [];
for (const p of posts) {
  for (const m of (p.content || '').matchAll(/\]\(\/blog\/([a-z0-9-]+)\)/g)) {
    if (!slugs.has(m[1]) && m[1] !== 'mastering-retail-operations-with-zeneva') bad.push(p.slug + ' -> ' + m[1]);
  }
}
console.log('\nbroken internal blog links:', bad.length ? bad : 'none');
