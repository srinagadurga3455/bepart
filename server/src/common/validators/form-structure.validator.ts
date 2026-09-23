import { BadRequestException } from '@nestjs/common';

const ALLOWED_TYPES = ['text', 'tel', 'email', 'textarea', 'dropdown', 'radio', 'checkbox'] as const;
type FieldType = (typeof ALLOWED_TYPES)[number];

interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
}

interface SectionDef {
  id: string;
  title: string;
  fields: FieldDef[];
}

interface FormStructure {
  title: string;
  description?: string;
  sections: SectionDef[];
}

function isString(v: any): boolean {
  return typeof v === 'string';
}

function validateFieldDef(field: any, path: string): void {
  if (!field || typeof field !== 'object') throw new BadRequestException(`${path}: field must be object`);
  if (!isString(field.name) || !field.name.trim()) throw new BadRequestException(`${path}: name required`);
  if (!isString(field.label) || !field.label.trim()) throw new BadRequestException(`${path}: label required`);
  if (!ALLOWED_TYPES.includes(field.type)) throw new BadRequestException(`${path}: type must be one of ${ALLOWED_TYPES.join(', ')}`);
  if (field.required !== undefined && typeof field.required !== 'boolean') throw new BadRequestException(`${path}: required must be boolean`);
  if (['dropdown', 'radio', 'checkbox'].includes(field.type)) {
    if (!Array.isArray(field.options) || field.options.length === 0) throw new BadRequestException(`${path}: options required for ${field.type}`);
    for (const opt of field.options) {
      if (!isString(opt) || !opt.trim()) throw new BadRequestException(`${path}: option must be non-empty string`);
    }
  } else if (field.options !== undefined) {
    // text/tel/email/textarea should not have options, but allow silently
    if (field.options !== undefined && !Array.isArray(field.options)) throw new BadRequestException(`${path}: options must be array`);
  }
}

export function validateFormStructure(formStructure: any): void {
  if (formStructure === null || formStructure === undefined) return; // optional
  if (typeof formStructure !== 'object' || Array.isArray(formStructure)) throw new BadRequestException('formStructure must be object');
  const fs = formStructure as FormStructure;
  if (!isString(fs.title) || !fs.title.trim()) throw new BadRequestException('formStructure.title required');
  if (fs.description !== undefined && !isString(fs.description)) throw new BadRequestException('formStructure.description must be string');
  if (!Array.isArray(fs.sections) || fs.sections.length === 0) throw new BadRequestException('formStructure.sections must be non-empty array');
  for (let i = 0; i < fs.sections.length; i++) {
    const sec = fs.sections[i];
    const secPath = `sections[${i}]`;
    if (!sec || typeof sec !== 'object') throw new BadRequestException(`${secPath} must be object`);
    if (!isString(sec.id) || !sec.id.trim()) throw new BadRequestException(`${secPath}.id required`);
    if (!isString(sec.title) || !sec.title.trim()) throw new BadRequestException(`${secPath}.title required`);
    if (!Array.isArray(sec.fields) || sec.fields.length === 0) throw new BadRequestException(`${secPath}.fields must be non-empty array`);
    for (let j = 0; j < sec.fields.length; j++) {
      validateFieldDef(sec.fields[j], `${secPath}.fields[${j}]`);
    }
  }
}

function getAllFields(formStructure: FormStructure): FieldDef[] {
  const fields: FieldDef[] = [];
  for (const sec of formStructure.sections) fields.push(...sec.fields);
  return fields;
}

function isEmail(val: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
}

function isTel(val: string): boolean {
  // accept +91 ... or digits, keep minimal
  return /^\+?[0-9\s\-()]{7,20}$/.test(val);
}

export function validateFormData(formStructure: any, formData: any): void {
  // If no formStructure, no validation
  if (!formStructure || typeof formStructure !== 'object' || !Array.isArray(formStructure.sections)) return;
  if (formData === null || formData === undefined) formData = {};
  if (typeof formData !== 'object' || Array.isArray(formData)) throw new BadRequestException('formData must be object');

  const fields = getAllFields(formStructure as FormStructure);
  const fieldMap = new Map<string, FieldDef>(fields.map((f) => [f.name, f]));

  // Check required
  for (const field of fields) {
    const val = (formData as any)[field.name];
    const isMissing = val === undefined || val === null || (typeof val === 'string' && !val.trim()) || (Array.isArray(val) && val.length === 0);
    if (field.required && isMissing) throw new BadRequestException(`Field '${field.label}' (${field.name}) is required`);
  }

  // Validate each provided value
  for (const [key, val] of Object.entries(formData as any)) {
    const field = fieldMap.get(key);
    if (!field) throw new BadRequestException(`Unknown field '${key}' not in formStructure`);
    switch (field.type) {
      case 'text':
      case 'textarea':
        if (!isString(val as any)) throw new BadRequestException(`Field '${field.label}' must be string`);
        break;
      case 'email':
        if (!isString(val as any) || !isEmail(val as string)) throw new BadRequestException(`Field '${field.label}' must be valid email`);
        break;
      case 'tel':
        if (!isString(val as any) || !isTel(val as string)) throw new BadRequestException(`Field '${field.label}' must be valid phone`);
        break;
      case 'dropdown':
      case 'radio': {
        if (!isString(val as any)) throw new BadRequestException(`Field '${field.label}' must be string`);
        if (!field.options!.includes(val as string)) throw new BadRequestException(`Field '${field.label}' value must be one of ${field.options!.join(', ')}`);
        break;
      }
      case 'checkbox': {
        if (!Array.isArray(val)) throw new BadRequestException(`Field '${field.label}' must be array`);
        for (const v of val as any[]) {
          if (!isString(v)) throw new BadRequestException(`Field '${field.label}' array values must be strings`);
          if (!field.options!.includes(v)) throw new BadRequestException(`Field '${field.label}' value '${v}' not in allowed options ${field.options!.join(', ')}`);
        }
        break;
      }
      default:
        break;
    }
  }
}
