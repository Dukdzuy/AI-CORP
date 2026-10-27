#!/usr/bin/env node
/**
 * Builds the thesis PDF from the Markdown chapters in docs/thesis/.
 *
 *   node scripts/docs/build-thesis.mjs [out.pdf]     (default docs/thesis/AI-CORP-thesis.pdf)
 *
 * Needs pandoc (2.19+) on PATH and the `playwright` package with Chromium. Figures are the SVGs
 * from scripts/docs/render-diagrams.sh, so run that first. Chapters are the files NN-*.md in
 * name order; headings marked {.unnumbered} (front matter, references) or {.appendix} are not
 * numbered, and the table of contents is placed after the front matter.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const thesisDir = join(root, 'docs/thesis');
const outPdf = resolve(process.argv[2] ?? join(thesisDir, 'AI-CORP-thesis.pdf'));
const work = process.env.THESIS_WORK_DIR ?? mkdtempSync(join(tmpdir(), 'thesis-'));

const chapters = readdirSync(thesisDir).filter((f) => /^\d\d-.*\.md$/.test(f)).sort();
const parts = chapters.map((file) => {
  let text = readFileSync(join(thesisDir, file), 'utf8');
  if (/\{\.appendix\}/.test(text)) {
    // Appendices are lettered in their titles; none of their headings is numbered.
    text = text
      .replace(/^(# .*)\{\.appendix\}$/gm, '$1{.unnumbered .appendix}')
      .replace(/^(#{2,4} (?!.*\{).*)$/gm, '$1 {.unnumbered}');
  }
  return text;
});
// Front matter first, then the table of contents placeholder, then the chapters.
parts.splice(1, 0, '<div id="toc-placeholder"></div>');
const source = join(thesisDir, '.thesis-build.md');
writeFileSync(source, parts.join('\n\n'));

const html = join(work, 'thesis.html');
try {
  execFileSync('pandoc', [
    source, '-f', 'markdown+link_attributes', '-t', 'html5', '-s', '--embed-resources',
    '--number-sections', '--toc', '--toc-depth=2', '-V', 'lang=vi',
    '--metadata', 'title=Design and Development of a Multi-Agent Platform for Object-Oriented Enterprise Workflow Automation',
    '--metadata', 'pagetitle=AI-CORP thesis', '-V', 'title=',
    '--resource-path', thesisDir, '--css', join(thesisDir, 'thesis.css'), '-o', html,
  ], { stdio: 'inherit' });
} finally {
  execFileSync('rm', ['-f', source]);
}

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`file://${html}`, { waitUntil: 'load' });
await page.evaluate(() => {
  // Move the table of contents after the front matter, drop the empty title block.
  document.querySelector('header#title-block-header')?.remove();
  const toc = document.querySelector('nav#TOC');
  const slot = document.getElementById('toc-placeholder');
  if (toc && slot) {
    const title = document.createElement('h1');
    title.className = 'unnumbered';
    title.textContent = 'Mục lục';
    toc.querySelector('h2')?.remove();
    toc.prepend(title);
    toc.querySelectorAll('a').forEach((a) => {
      const id = a.getAttribute('href')?.slice(1);
      const target = id && document.getElementById(id);
      // The cover title and front matter stay out of the table of contents.
      if (target?.closest('.cover')) a.closest('li')?.remove();
    });
    slot.replaceWith(toc);
  }
  // Number figures per chapter: "Hình 4.2".
  let chapter = '';
  let n = 0;
  for (const el of document.querySelectorAll('h1, figure')) {
    if (el.tagName === 'H1') {
      const num = el.querySelector('.header-section-number')?.textContent?.trim();
      const letter = /^Phụ\s+lục\s+([A-Z])/.exec((el.textContent ?? '').trim())?.[1];
      chapter = num ?? letter ?? chapter;
      n = 0;
      continue;
    }
    const caption = el.querySelector('figcaption');
    if (!caption) continue;
    n += 1;
    const label = document.createElement('span');
    label.className = 'fig-label';
    label.textContent = `Hình ${chapter}.${n}. `;
    caption.prepend(label);
  }
});
await page.pdf({
  path: outPdf,
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: true,
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate: '<div style="width:100%;text-align:center;font-size:10pt;font-family:serif"><span class="pageNumber"></span></div>',
});
await browser.close();
console.log(`Wrote ${outPdf}`);
