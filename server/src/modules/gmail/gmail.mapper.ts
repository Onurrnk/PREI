// =====================================================================
// PREI | Gmail mapper (Anti-Corruption Layer)
// Pure functions that translate Gmail's raw API schema into PREI DTOs.
// Keeping this isolated means Gmail schema changes never leak into the
// domain or the frontend contract.
// =====================================================================
import type { gmail_v1 } from 'googleapis';
import type { EmailMessageDTO } from './dto/email.dto';

type Header = gmail_v1.Schema$MessagePartHeader;

export function getHeader(headers: Header[] | undefined, name: string): string {
  const h = headers?.find((x) => x.name?.toLowerCase() === name.toLowerCase());
  return h?.value ?? '';
}

/** Parse a "Display Name <email@x.com>" header into parts. */
export function parseAddress(raw: string): { name: string; email: string } {
  const match = raw.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (match) {
    const name = match[1].trim();
    const email = match[2].trim();
    return { name: name || email, email };
  }
  const email = raw.trim();
  return { name: email, email };
}

export function splitAddresses(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => parseAddress(s).email)
    .filter(Boolean);
}

function decode(data?: string | null): string {
  if (!data) return '';
  return Buffer.from(data, 'base64url').toString('utf-8');
}

/** Recursively collect plain-text and HTML bodies from a message payload. */
export function extractBodies(payload?: gmail_v1.Schema$MessagePart): {
  text: string;
  html: string | null;
} {
  let text = '';
  let html: string | null = null;

  const walk = (part?: gmail_v1.Schema$MessagePart) => {
    if (!part) return;
    const mime = part.mimeType ?? '';
    if (mime === 'text/plain' && part.body?.data) {
      text += decode(part.body.data);
    } else if (mime === 'text/html' && part.body?.data) {
      html = (html ?? '') + decode(part.body.data);
    }
    part.parts?.forEach(walk);
  };

  walk(payload);
  // Fallback: single-part message with body on the root.
  if (!text && !html && payload?.body?.data) {
    text = decode(payload.body.data);
  }
  return { text, html };
}

export function toMessageDTO(msg: gmail_v1.Schema$Message): EmailMessageDTO {
  const headers = msg.payload?.headers ?? undefined;
  const from = parseAddress(getHeader(headers, 'From'));
  const dateHeader = getHeader(headers, 'Date');
  const internal = msg.internalDate ? Number(msg.internalDate) : undefined;
  const date = dateHeader
    ? new Date(dateHeader).toISOString()
    : internal
      ? new Date(internal).toISOString()
      : new Date().toISOString();

  const { text, html } = extractBodies(msg.payload ?? undefined);

  return {
    id: msg.id ?? '',
    threadId: msg.threadId ?? '',
    from: from.name,
    fromEmail: from.email,
    to: splitAddresses(getHeader(headers, 'To')),
    subject: getHeader(headers, 'Subject'),
    date,
    snippet: msg.snippet ?? '',
    bodyText: text,
    bodyHtml: html,
  };
}
