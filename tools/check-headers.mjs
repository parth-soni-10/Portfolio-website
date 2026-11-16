/**
 * Check that the two copies of the Content-Security-Policy are still in step.
 *
 *   node tools/check-headers.mjs
 *
 * Read-only, no dependencies. Exits non-zero on drift, so it can be wired into
 * CI — which is the point, because this is a pair that cannot be avoided and
 * will not stay equal by itself.
 *
 * Why there are two copies at all: a <meta http-equiv> CSP cannot carry
 * `frame-ancestors`, and page response headers can only be set by the host. So
 * `_headers` holds the full policy and `index.html` holds everything except that
 * one directive. A browser that sees both enforces the *intersection*, which
 * means a directive added to only one of them is silently dropped, and a
 * directive removed from only one of them silently stays in force. Neither
 * failure announces itself.
 *
 * It also checks the plain headers, since they exist only in `_headers` and a
 * typo there costs nothing to catch here.
 */

import { readFile } from 'node:fs/promises';

const HERE = new URL('..', import.meta.url);
const html = await readFile(new URL('index.html', HERE), 'utf8');
const headers = await readFile(new URL('_headers', HERE), 'utf8');

const problems = [];
const ok = (message) => console.log(`  OK   ${message}`);
const bad = (message) => {
  problems.push(message);
  console.log(`  FAIL ${message}`);
};

const directives = (policy) =>
  policy
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);

// ---- the <meta> policy ----------------------------------------------------
const metaMatch = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i);
if (!metaMatch) {
  bad('index.html has no <meta http-equiv="Content-Security-Policy">');
}
const metaPolicy = metaMatch ? metaMatch[1] : '';
const metaSet = new Set(directives(metaPolicy));

// ---- the _headers policy --------------------------------------------------
// The file is a list of `/*`-style blocks; take the CSP out of the block that
// defines it, so a second block (a per-path rule added later) cannot be
// mistaken for the site-wide one.
const blocks = headers.split(/^\s*\/\S*\s*$/m);
let headerPolicy = '';
for (const block of blocks) {
  const match = block.match(/^\s*Content-Security-Policy:\s*(.+)$/m);
  if (match) {
    headerPolicy = match[1].trim();
    break;
  }
}
if (!headerPolicy) bad('_headers has no Content-Security-Policy');
const headerSet = new Set(directives(headerPolicy));

// ---- the two must agree except for frame-ancestors ------------------------
if (metaSet.size && headerSet.size) {
  const onlyMeta = [...metaSet].filter((d) => !headerSet.has(d));
  const onlyHeader = [...headerSet].filter((d) => !metaSet.has(d));

  if (onlyMeta.length) {
    bad(`_headers is missing directive(s) index.html carries: ${onlyMeta.join('; ')}`);
  }
  if (onlyHeader.length !== 1 || onlyHeader[0] !== "frame-ancestors 'none'") {
    bad(
      `_headers must differ from index.html by exactly "frame-ancestors 'none'" — it differs by: ${
        onlyHeader.length ? onlyHeader.join('; ') : '(nothing)'
      }`
    );
  }
  if (!onlyMeta.length && onlyHeader.length === 1 && onlyHeader[0] === "frame-ancestors 'none'") {
    ok(`both policies agree, differing only by frame-ancestors (${metaSet.size} directives)`);
  }
}

// ---- the plain headers ----------------------------------------------------
const expected = new Map([
  ['X-Frame-Options', 'DENY'],
  ['X-Content-Type-Options', 'nosniff'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ['Strict-Transport-Security', 'max-age=31536000'],
]);

for (const [name, value] of expected) {
  const match = headers.match(new RegExp(`^\\s*${name}:\\s*(.+)$`, 'm'));
  if (!match) bad(`_headers is missing ${name}`);
  else if (match[1].trim() !== value) bad(`${name} is "${match[1].trim()}", expected "${value}"`);
  else ok(`${name}: ${value}`);
}

// HSTS is deliberately host-only: includeSubDomains or preload would pin a
// sibling host that may still be HTTP-only.
const hsts = headers.match(/^\s*Strict-Transport-Security:\s*(.+)$/m);
if (hsts && /includeSubDomains|preload/i.test(hsts[1])) {
  bad(`Strict-Transport-Security must not carry includeSubDomains/preload: ${hsts[1].trim()}`);
}

if (!/^\s*Permissions-Policy:\s*\S/m.test(headers)) {
  bad('_headers is missing Permissions-Policy');
} else {
  const policy = headers.match(/^\s*Permissions-Policy:\s*(.+)$/m)[1];
  const denied = ['camera', 'microphone', 'geolocation', 'payment', 'usb'];
  const missing = denied.filter((feature) => !new RegExp(`\\b${feature}\\s*=\\s*\\(\\)`).test(policy));
  if (missing.length) bad(`Permissions-Policy does not deny: ${missing.join(', ')}`);
  else ok('Permissions-Policy denies the device APIs');
}

// The referrer policy exists twice too — once as a header, once as a meta tag.
const metaReferrer = html.match(/<meta\s+name="referrer"\s+content="([^"]+)"/i);
if (!metaReferrer) {
  bad('index.html has no <meta name="referrer">');
} else if (metaReferrer[1] !== headers.match(/^\s*Referrer-Policy:\s*(.+)$/m)?.[1].trim()) {
  bad(
    `the meta referrer (${metaReferrer[1]}) and the Referrer-Policy header (${
      headers.match(/^\s*Referrer-Policy:\s*(.+)$/m)?.[1].trim()
    }) disagree`
  );
} else {
  ok('the meta referrer and the Referrer-Policy header agree');
}

console.log(
  problems.length
    ? `\nheader check FAILED (${problems.length} problem${problems.length === 1 ? '' : 's'})`
    : '\nheader check passed'
);
process.exit(problems.length ? 1 : 0);
