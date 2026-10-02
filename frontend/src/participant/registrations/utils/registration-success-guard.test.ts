import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const registerPage = readFileSync(join(here, '..', 'pages', 'RegisterPage.tsx'), 'utf8');
const successState = readFileSync(join(here, '..', 'components', 'SuccessState.tsx'), 'utf8');

/** Strip line, block, and JSX comments so assertions target rendered copy/code. */
function stripComments(src: string): string {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1');
}

const cleanRegister = stripComments(registerPage);
const cleanSuccess = stripComments(successState);

describe('registration success screen (ticket confirmation stays intact)', () => {
  for (const [name, src] of [['RegisterPage', cleanRegister], ['SuccessState', cleanSuccess]] as const) {
    it(`${name} keeps the confirmation heading and ticket-delivery copy`, () => {
      assert.match(src, /Registration Confirmed!/);
      assert.match(src, /You are successfully registered for/);
      assert.match(src, /Your ticket has been sent to your registered WhatsApp number\./);
      assert.match(src, /Open WhatsApp to access your ticket and QR code\. Keep the ticket handy for entry\./);
    });

    it(`${name} shows Join WhatsApp Group only via the stored event link`, () => {
      assert.match(src, /Join WhatsApp Group/);
      assert.match(src, /Join the official event WhatsApp group/);
      assert.match(src, /Join the group for event announcements, updates, and important information\./);
      // The button opens the configured link in a new tab — never redirects.
      assert.match(src, /getWhatsappGroupLink\(event\)/);
      assert.match(src, /target="_blank"/);
      assert.match(src, /rel="noopener noreferrer"/);
    });

    it(`${name} has no View Ticket button, QR preview, or ticket URL`, () => {
      assert.doesNotMatch(src, /View Ticket/);
      assert.doesNotMatch(src, /QRCodeSVG/);
      assert.doesNotMatch(src, /qrcode\.react/);
      assert.doesNotMatch(src, /ticketUrl/);
    });
  }
});
