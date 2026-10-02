import { Injectable } from '@nestjs/common';

/**
 * Meta WhatsApp Cloud API template components — Nest port of the Pravesh
 * `whatsapp/client.js` builders (textParam / imageHeader / documentHeader /
 * bodyParams / urlButton / buildTemplateComponents).
 */

export interface TextParameter {
  type: 'text';
  text: string;
}

export interface ImageHeaderComponent {
  type: 'header';
  parameters: [{ type: 'image'; image: { link: string } | { id: string } }];
}

export interface DocumentHeaderComponent {
  type: 'header';
  parameters: [{ type: 'document'; document: { link: string } | { id: string } }];
}

export interface BodyComponent {
  type: 'body';
  parameters: TextParameter[];
}

export interface UrlButtonComponent {
  type: 'button';
  sub_type: 'url';
  index: number;
  parameters: TextParameter[];
}

export type WhatsappComponent =
  | ImageHeaderComponent
  | DocumentHeaderComponent
  | BodyComponent
  | UrlButtonComponent;

export function textParam(text: unknown): TextParameter {
  return { type: 'text', text: String(text) };
}

export function bodyParams(values: unknown[]): BodyComponent {
  return { type: 'body', parameters: values.map(textParam) };
}

export function imageHeader(opts: { imageUrl?: string; imageId?: string }): ImageHeaderComponent {
  const image = opts.imageId ? { id: opts.imageId } : { link: String(opts.imageUrl) };
  return { type: 'header', parameters: [{ type: 'image', image }] };
}

export function documentHeader(opts: { documentUrl?: string; documentId?: string }): DocumentHeaderComponent {
  const document = opts.documentId ? { id: opts.documentId } : { link: String(opts.documentUrl) };
  return { type: 'header', parameters: [{ type: 'document', document }] };
}

export function urlButton(index: number, values: unknown[]): UrlButtonComponent {
  return {
    type: 'button',
    sub_type: 'url',
    index,
    parameters: values.map((v) => ({ type: 'text', text: String(v) })),
  };
}

/**
 * Template message. `components` is preferred (Pravesh contracts);
 * `parameters` is the legacy body-only shorthand kept for backward
 * compatibility with the existing ticket flow and specs.
 */
export interface WhatsappTemplateMessage {
  /** Recipient in international format, digits only, no leading '+' (e.g. 919876543210). */
  to: string;
  templateName: string;
  languageCode: string;
  /** Legacy body parameters in template order (converted to a body component). */
  parameters?: string[];
  /** Full template components (header/body/button) in send order. */
  components?: WhatsappComponent[];
}

export interface WhatsappProviderConfig {
  accessToken: string;
  phoneNumberId: string;
  apiVersion: string;
}

export interface WhatsappSendResult {
  providerMessageId: string;
}

const DEFAULT_TIMEOUT_MS = 15000;

@Injectable()
export class MetaWhatsappProvider {
  async sendTemplate(
    config: WhatsappProviderConfig,
    message: WhatsappTemplateMessage,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ): Promise<WhatsappSendResult> {
    const url = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;
    const components: WhatsappComponent[] =
      message.components ??
      (message.parameters ? [bodyParams(message.parameters)] : []);
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: message.to,
          type: 'template',
          template: {
            name: message.templateName,
            language: { code: message.languageCode },
            ...(components.length ? { components } : {}),
          },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      throw new Error(`WhatsApp API unreachable: ${(e as Error)?.message || 'network error'}`);
    }
    if (!res.ok) {
      let detail = '';
      try {
        detail = JSON.stringify(await res.json()).slice(0, 500);
      } catch {
        // Non-JSON error body — status code alone is enough.
      }
      throw new Error(`WhatsApp API rejected the message (HTTP ${res.status})${detail ? `: ${detail}` : ''}`);
    }
    const body: any = await res.json().catch(() => ({}));
    const id = body?.messages?.[0]?.id;
    if (!id) throw new Error('WhatsApp API returned no message id');
    return { providerMessageId: String(id) };
  }
}
