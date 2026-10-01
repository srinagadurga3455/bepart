import { BadRequestException } from '@nestjs/common';
import { validateFormData } from './form-structure.validator';

// Mirrors a real organizer-built structure: required text/tel + optional
// email, dropdown, radio, checkbox (untouched optionals arrive as ''/[]).
const STRUCTURE = {
  title: 'Reg',
  sections: [
    {
      id: 's1',
      title: 'Details',
      fields: [
        { name: 'fullName', label: 'Full Name', type: 'text', required: true },
        { name: 'phone', label: 'Phone Number', type: 'tel', required: true },
        { name: 'email', label: 'Email Address', type: 'email', required: false },
        { name: 'branch', label: 'Branch', type: 'dropdown', options: ['CSE', 'ECE'], required: false },
        { name: 'year', label: 'Year', type: 'radio', options: ['1st', '2nd'], required: false },
        { name: 'events', label: 'Events', type: 'checkbox', options: ['Hackathon', 'Quiz'], required: false },
      ],
    },
  ],
};

describe('validateFormData - optional blanks', () => {
  it('accepts untouched optional fields sent as empty values (real form payload)', () => {
    expect(() =>
      validateFormData(STRUCTURE, {
        fullName: 'Asha',
        phone: '+919876543210',
        email: '',
        branch: '',
        year: '',
        events: [],
      }),
    ).not.toThrow();
  });

  it('accepts omitted optional fields', () => {
    expect(() =>
      validateFormData(STRUCTURE, { fullName: 'Asha', phone: '+919876543210' }),
    ).not.toThrow();
  });

  it('still rejects an empty REQUIRED field', () => {
    expect(() =>
      validateFormData(STRUCTURE, { fullName: '', phone: '+919876543210' }),
    ).toThrow(BadRequestException);
  });

  it('still rejects an unknown field', () => {
    expect(() =>
      validateFormData(STRUCTURE, { fullName: 'A', phone: '+919876543210', injected: 'x' }),
    ).toThrow(/Unknown field/);
  });

  it('still rejects a malformed non-empty email', () => {
    expect(() =>
      validateFormData(STRUCTURE, { fullName: 'A', phone: '+919876543210', email: 'not-an-email' }),
    ).toThrow(/valid email/);
  });

  it('still rejects a dropdown value outside options', () => {
    expect(() =>
      validateFormData(STRUCTURE, { fullName: 'A', phone: '+919876543210', branch: 'Civil' }),
    ).toThrow(/must be one of/);
  });

  it('accepts filled optional values', () => {
    expect(() =>
      validateFormData(STRUCTURE, {
        fullName: 'Asha',
        phone: '+919876543210',
        email: 'a@x.com',
        branch: 'CSE',
        year: '1st',
        events: ['Quiz'],
      }),
    ).not.toThrow();
  });
});
