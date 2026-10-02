/**
 * Reusable registration form templates.
 * Each template produces a BuilderForm ready to load into FormBuilder.
 * The system fields (Name, Phone) are always included via defaultNewForm()
 * structure; templates may add more fields on top.
 */

import { newKey } from './formBuilderUtils';
import type { BuilderField, BuilderForm, BuilderSection } from './formBuilderUtils';
import type { FormSettings } from '../../../app/types';

export interface FormTemplate {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji icon for display
  defaultSettings: FormSettings;
  build: () => BuilderForm;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function field(
  label: string,
  type: BuilderField['type'],
  opts: Partial<BuilderField> = {},
): BuilderField {
  return {
    key: newKey(),
    name: '',
    label,
    type,
    required: true,
    options: [],
    ...opts,
  };
}

function section(title: string, description: string, fields: BuilderField[]): BuilderSection {
  return {
    key: newKey(),
    id: `s_${newKey()}`,
    title,
    description,
    fields,
    memberGroup: null,
  };
}

function participantSection(): BuilderSection {
  return section('Participant Details', '', [
    { key: newKey(), name: 'fullName', label: 'Name', type: 'text', required: true, options: [], system: 'name' },
    { key: newKey(), name: 'phone', label: 'Phone Number', type: 'tel', required: true, options: [], system: 'phone' },
    field('Email Address', 'email'),
  ]);
}

// ─── Templates ────────────────────────────────────────────────────────────────

const hackathonTemplate: FormTemplate = {
  id: 'hackathon',
  name: 'Hackathon',
  description: 'Team registration with role, skills, and idea pitch',
  icon: '💻',
  defaultSettings: {
    collectName: true,
    collectPhone: true,
    collectEmail: true,
    requireLogin: false,
    allowMultipleSubmissions: false,
    confirmationMessage: "You're registered! Check your phone for the confirmation ticket.",
    registrationOpen: true,
    showConsentSection: true,
    consentText:
      'By registering, you agree to the event rules and code of conduct. Your submitted project must be original work created during the hackathon.',
    consentCheckboxLabel: 'I agree to the hackathon rules and code of conduct.',
  },
  build: () => ({
    title: 'Hackathon Registration',
    description: 'Register your team for the hackathon. Fill in all required fields.',
    sections: [
      participantSection(),
      section('Academic Details', '', [
        field('College / Institution', 'text'),
        field('Department / Branch', 'dropdown', {
          options: ['CSE', 'AI & DS', 'ECE', 'EEE', 'Mechanical', 'Civil', 'Other'],
        }),
        field('Year of Study', 'radio', {
          options: ['1st Year', '2nd Year', '3rd Year', '4th Year'],
        }),
      ]),
      section('Team Details', 'You can participate as an individual or in a team (max 4 members).', [
        field('Participation Type', 'radio', { options: ['Individual', 'Team (2 members)', 'Team (3 members)', 'Team (4 members)'] }),
        field('Team Name', 'text', { required: false }),
      ]),
      section('Project Idea', '', [
        field('Problem Statement / Theme', 'dropdown', {
          options: ['Healthcare', 'Education', 'Environment', 'Finance', 'Smart City', 'Open Innovation'],
        }),
        field('Brief Project Idea', 'textarea', { required: false }),
        field('Tech Stack You Plan to Use', 'text', { required: false }),
      ]),
    ],
    theme: undefined,
  }),
};

const bootcampTemplate: FormTemplate = {
  id: 'bootcamp',
  name: 'Bootcamp',
  description: 'Skill assessment, experience level, and session preferences',
  icon: '🎓',
  defaultSettings: {
    collectName: true,
    collectPhone: true,
    collectEmail: true,
    requireLogin: false,
    allowMultipleSubmissions: false,
    confirmationMessage:
      'Registration confirmed! Session details and venue will be shared on your registered phone.',
    registrationOpen: true,
    showConsentSection: true,
    consentText:
      'Attendance is mandatory for all sessions. Participants who miss more than one session may not receive a certificate.',
    consentCheckboxLabel: 'I understand and agree to the attendance policy.',
  },
  build: () => ({
    title: 'Bootcamp Registration',
    description: 'Register for the bootcamp. Limited seats — first come first served.',
    sections: [
      participantSection(),
      section('Academic / Professional Background', '', [
        field('College or Organization', 'text'),
        field('Current Role', 'radio', {
          options: ['Student', 'Working Professional', 'Freelancer', 'Other'],
        }),
        field('Year of Study (if student)', 'radio', {
          options: ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Not applicable'],
          required: false,
        }),
      ]),
      section('Skill Assessment', '', [
        field('Experience Level', 'radio', {
          options: ['Complete Beginner', 'Beginner (some exposure)', 'Intermediate', 'Advanced'],
        }),
        field('Why do you want to join this bootcamp?', 'textarea'),
        field('What do you hope to learn or achieve?', 'textarea', { required: false }),
      ]),
      section('Session Preferences', '', [
        field('Preferred Batch / Timing', 'dropdown', {
          options: ['Morning (9AM–12PM)', 'Afternoon (2PM–5PM)', 'Evening (6PM–9PM)'],
          required: false,
        }),
        field('Laptop Available?', 'radio', { options: ['Yes', 'No'] }),
      ]),
    ],
    theme: undefined,
  }),
};

const workshopTemplate: FormTemplate = {
  id: 'workshop',
  name: 'Workshop',
  description: 'Prior experience, materials needed, and dietary preferences',
  icon: '🛠️',
  defaultSettings: {
    collectName: true,
    collectPhone: true,
    collectEmail: true,
    requireLogin: false,
    allowMultipleSubmissions: false,
    confirmationMessage:
      'You are confirmed for the workshop! Bring the required materials listed in the confirmation email.',
    registrationOpen: true,
    showConsentSection: false,
    consentText: '',
    consentCheckboxLabel: '',
  },
  build: () => ({
    title: 'Workshop Registration',
    description: 'Register for the workshop. Please read the description carefully before signing up.',
    sections: [
      participantSection(),
      section('Background', '', [
        field('Current Occupation', 'radio', {
          options: ['Student', 'Working Professional', 'Other'],
        }),
        field('Prior Experience with This Topic', 'radio', {
          options: ['None', 'Basic', 'Intermediate', 'Advanced'],
        }),
      ]),
      section('Workshop Details', '', [
        field('Which workshop track are you signing up for?', 'dropdown', {
          options: ['Track A', 'Track B', 'Track C'],
        }),
        field('Special requirements or accommodations', 'textarea', { required: false }),
      ]),
    ],
    theme: undefined,
  }),
};

const generalEventTemplate: FormTemplate = {
  id: 'general',
  name: 'General Event',
  description: 'Simple registration with basic participant info',
  icon: '🎟️',
  defaultSettings: {
    collectName: true,
    collectPhone: true,
    collectEmail: false,
    requireLogin: false,
    allowMultipleSubmissions: false,
    confirmationMessage: 'Registration successful! Your ticket has been sent.',
    registrationOpen: true,
    showConsentSection: false,
    consentText: '',
    consentCheckboxLabel: '',
  },
  build: () => ({
    title: 'Event Registration',
    description: 'Register for the event by filling in the details below.',
    sections: [
      participantSection(),
      section('Event Preferences', '', [
        field('How did you hear about this event?', 'dropdown', {
          options: ['Social Media', 'College Notice Board', 'Friend / Colleague', 'Email', 'Other'],
          required: false,
        }),
        field('Any questions or comments for the organizer?', 'textarea', { required: false }),
      ]),
    ],
    theme: undefined,
  }),
};

const blankTemplate: FormTemplate = {
  id: 'blank',
  name: 'Blank Form',
  description: 'Start from scratch with just participant name and phone',
  icon: '📄',
  defaultSettings: {
    collectName: true,
    collectPhone: true,
    collectEmail: false,
    requireLogin: false,
    allowMultipleSubmissions: false,
    confirmationMessage: 'Thank you for registering!',
    registrationOpen: true,
    showConsentSection: false,
    consentText: '',
    consentCheckboxLabel: '',
  },
  build: () => ({
    title: 'Untitled form',
    description: '',
    sections: [
      {
        key: newKey(),
        id: `s_${newKey()}`,
        title: 'Participant Details',
        description: '',
        fields: [
          { key: newKey(), name: 'fullName', label: 'Name', type: 'text', required: true, options: [], system: 'name' },
          { key: newKey(), name: 'phone', label: 'Phone Number', type: 'tel', required: true, options: [], system: 'phone' },
        ],
        memberGroup: null,
      },
    ],
    theme: undefined,
  }),
};

export const FORM_TEMPLATES: FormTemplate[] = [
  hackathonTemplate,
  bootcampTemplate,
  workshopTemplate,
  generalEventTemplate,
  blankTemplate,
];
