/**
 * Which windowsVirtualKeyCode strategy actually round-trips every character?
 *
 * Run against a plain uncontrolled input on about:blank, so nothing but Chrome's
 * own key handling is in the picture — no React, no app.
 */
import { Cdp } from '../scripts/record/cdp.mjs';
import { launch } from '../scripts/record/browser.mjs';
import { sleep } from '../scripts/record/page.mjs';

const SAMPLE = `bimex4@gmail.com  a.b-c_d+e,f/g'h"i (j) [k] {l} <m> #n $o %p &q *r =s ;t :u ?v \`w ~x |y \\z 0123456789`;

// Proper US-layout virtual key codes. The shifted character and the unshifted
// one share a key, so both map to the same code.
const OEM = {
  ';': 186, ':': 186,
  '=': 187, '+': 187,
  ',': 188, '<': 188,
  '-': 189, '_': 189,
  '.': 190, '>': 190,
  '/': 191, '?': 191,
  '`': 192, '~': 192,
  '[': 219, '{': 219,
  '\\': 220, '|': 220,
  ']': 221, '}': 221,
  "'": 222, '"': 222,
};
const SHIFTED_DIGIT = { '!': 49, '@': 50, '#': 51, $: 52, '%': 53, '^': 54, '&': 55, '*': 56, '(': 57, ')': 48 };

function vkFor(ch) {
  if (ch === '\n') return 13;
  if (ch === ' ') return 32;
  if (ch >= 'a' && ch <= 'z') return ch.toUpperCase().charCodeAt(0);
  if (ch >= 'A' && ch <= 'Z') return ch.charCodeAt(0);
  if (ch >= '0' && ch <= '9') return ch.charCodeAt(0);
  if (SHIFTED_DIGIT[ch] !== undefined) return SHIFTED_DIGIT[ch];
  if (OEM[ch] !== undefined) return OEM[ch];
  return 0;
}

const STRATEGIES = {
  'A current (charCodeAt)': (ch) => ch.toUpperCase().charCodeAt(0),
  'B zero': () => 0,
  'C proper VK map': (ch) => vkFor(ch),
};

const browser = await launch({ width: 800, height: 600, dpr: 1, headless: true, port: 9352, browserPath: null });

try {
  const cdp = await Cdp.attach(browser.page.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  const evaluate = async (expr) => {
    const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return r?.result?.value;
  };

  for (const [name, vk] of Object.entries(STRATEGIES)) {
    await evaluate(`
      document.body.innerHTML = '<input id="t" style="width:90%">';
      document.querySelector('#t').focus();
      1
    `);
    await sleep(120);

    for (const ch of SAMPLE) {
      const common = {
        key: ch,
        text: ch,
        unmodifiedText: ch,
        windowsVirtualKeyCode: vk(ch),
      };
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', ...common });
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...common });
    }
    await sleep(200);

    const got = await evaluate(`document.querySelector('#t').value`);
    const ok = got === SAMPLE;
    console.log(`\n${name}: ${ok ? 'EXACT' : 'MISMATCH'}`);
    if (!ok) {
      console.log(`   want: ${JSON.stringify(SAMPLE)}`);
      console.log(`   got : ${JSON.stringify(got)}`);
      const missing = [...new Set([...SAMPLE].filter((c) => !String(got).includes(c)))];
      console.log(`   chars that vanished: ${JSON.stringify(missing.join(''))}`);
    }
  }

  cdp.close();
} finally {
  browser.cleanup();
}
