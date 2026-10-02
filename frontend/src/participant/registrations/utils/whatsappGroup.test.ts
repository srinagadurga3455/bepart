import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getWhatsappGroupLink,
  hasWhatsappGroupLink,
  validateWhatsappGroupLinkInput,
} from './whatsappGroup.ts';

describe('getWhatsappGroupLink', () => {
  it('returns the configured link when present', () => {
    assert.equal(
      getWhatsappGroupLink({ whatsappGroupLink: 'https://chat.whatsapp.com/abc123' }),
      'https://chat.whatsapp.com/abc123',
    );
  });

  it('trims surrounding whitespace', () => {
    assert.equal(
      getWhatsappGroupLink({ whatsappGroupLink: '  https://chat.whatsapp.com/abc123  ' }),
      'https://chat.whatsapp.com/abc123',
    );
  });

  it('returns null when the link is null', () => {
    assert.equal(getWhatsappGroupLink({ whatsappGroupLink: null }), null);
  });

  it('returns null when the link is missing', () => {
    assert.equal(getWhatsappGroupLink({}), null);
  });

  it('returns null when the link is an empty string', () => {
    assert.equal(getWhatsappGroupLink({ whatsappGroupLink: '' }), null);
  });

  it('returns null when the link is whitespace-only', () => {
    assert.equal(getWhatsappGroupLink({ whatsappGroupLink: '   ' }), null);
  });

  it('returns null when the event itself is missing', () => {
    assert.equal(getWhatsappGroupLink(null), null);
    assert.equal(getWhatsappGroupLink(undefined), null);
  });
});

describe('hasWhatsappGroupLink', () => {
  it('is true when a link exists', () => {
    assert.equal(hasWhatsappGroupLink({ whatsappGroupLink: 'https://chat.whatsapp.com/abc' }), true);
  });

  it('is false when the link is null / empty / missing', () => {
    assert.equal(hasWhatsappGroupLink({ whatsappGroupLink: null }), false);
    assert.equal(hasWhatsappGroupLink({ whatsappGroupLink: '' }), false);
    assert.equal(hasWhatsappGroupLink(null), false);
    assert.equal(hasWhatsappGroupLink(undefined), false);
  });
});

describe('validateWhatsappGroupLinkInput (organizer form)', () => {
  it('accepts empty input (field is optional)', () => {
    assert.equal(validateWhatsappGroupLinkInput(''), null);
    assert.equal(validateWhatsappGroupLinkInput('   '), null);
  });

  it('accepts a chat.whatsapp.com URL', () => {
    assert.equal(validateWhatsappGroupLinkInput('https://chat.whatsapp.com/abc123'), null);
  });

  it('rejects non-URL input', () => {
    assert.match(validateWhatsappGroupLinkInput('not-a-url') ?? '', /valid URL/);
  });
});
