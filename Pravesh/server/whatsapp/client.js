const { API_BASE, getConfig } = require('./config');
const { record } = require('./usage');

function normalizePhone(to) {
  // Keep digits only; Cloud API expects international format without '+'.
  return String(to || '').replace(/\D/g, '');
}

// Single place that talks to the Meta Graph API.
async function postMessage(payload) {
  const { phoneNumberId, accessToken, apiVersion } = getConfig();

  const fullPayload = { messaging_product: 'whatsapp', ...payload };
  
  console.log(`[WhatsApp API] Sending to ${payload.to || 'N/A'}:`, JSON.stringify(fullPayload, null, 2));

  const res = await fetch(`${API_BASE}/${apiVersion}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(fullPayload),
  });

  const data = await res.json().catch(() => ({}));

  console.log(`[WhatsApp API] Response (${res.status}):`, JSON.stringify(data, null, 2));

  if (!res.ok) {
    if (payload.type) record('failed', { type: payload.type, to: payload.to });
    throw new Error(data?.error?.message || `WhatsApp API error: ${res.status}`);
  }

  if (payload.type) record('sent', { type: payload.type, to: payload.to });
  return data;
}

// --- Template component builders ---

const textParam = (text) => ({ type: 'text', text: String(text) });

function documentHeader({ documentUrl, documentId }) {
  const document = documentId ? { id: documentId } : { link: documentUrl };
  return { type: 'header', parameters: [{ type: 'document', document }] };
}

function imageHeader({ imageUrl, imageId }) {
  const image = imageId ? { id: imageId } : { link: imageUrl };
  return { type: 'header', parameters: [{ type: 'image', image }] };
}

function bodyParams(values) {
  return { type: 'body', parameters: values.map(textParam) };
}

function urlButton(index, values) {
  // URL button parameters should contain the variables to substitute in the URL template
  return { 
    type: 'button', 
    sub_type: 'url', 
    index, 
    parameters: values.map((val) => ({ type: 'text', text: String(val) }))
  };
}

// Shared by /send-template: builds components from flat request fields.
function buildTemplateComponents({ headerDocumentUrl, headerDocumentId, bodyVariables = [], buttonVariables = [] }) {
  const components = [];
  if (headerDocumentUrl || headerDocumentId) {
    components.push(documentHeader({ documentUrl: headerDocumentUrl, documentId: headerDocumentId }));
  }
  if (bodyVariables.length) {
    components.push(bodyParams(bodyVariables));
  }
  if (buttonVariables.length) {
    components.push(urlButton(0, buttonVariables));
  }
  return components;
}

module.exports = {
  normalizePhone,
  postMessage,
  textParam,
  documentHeader,
  imageHeader,
  bodyParams,
  urlButton,
  buildTemplateComponents,
};
