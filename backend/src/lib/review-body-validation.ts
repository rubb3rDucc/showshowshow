import { ValidationError } from './errors.js';

const MAX_BODY_BYTES = 200_000;
const SAFE_HREF = /^(https?:\/\/|\/|#)/;

type Node = {
  type?: unknown;
  content?: unknown;
  marks?: unknown;
  attrs?: unknown;
};

/**
 * Validate a Tiptap JSON document before persisting.
 *
 * The frontend's Tiptap instance produces well-formed docs by construction;
 * this guards against malicious or malformed clients posting raw JSON. We do
 * shape validation only — full schema validation would require importing
 * Tiptap on the backend, which we deliberately avoid (see docs/REVIEWS.md).
 *
 * Throws ValidationError on failure.
 */
export function validateReviewBody(body: unknown): void {
  if (body === null) return;

  if (typeof body !== 'object') {
    throw new ValidationError('body must be an object or null');
  }

  const size = JSON.stringify(body).length;
  if (size > MAX_BODY_BYTES) {
    throw new ValidationError(`body exceeds ${MAX_BODY_BYTES} byte limit`);
  }

  const root = body as Node;
  if (root.type !== 'doc') {
    throw new ValidationError('body must be a Tiptap doc node');
  }

  walk(root);
}

function walk(node: Node): void {
  if (typeof node.type !== 'string') {
    throw new ValidationError('every node must have a string `type`');
  }

  if (Array.isArray(node.marks)) {
    for (const mark of node.marks) {
      validateMark(mark);
    }
  }

  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      if (typeof child !== 'object' || child === null) {
        throw new ValidationError('content children must be objects');
      }
      walk(child as Node);
    }
  }
}

function validateMark(mark: unknown): void {
  if (typeof mark !== 'object' || mark === null) {
    throw new ValidationError('marks must be objects');
  }

  const m = mark as { type?: unknown; attrs?: { href?: unknown } };
  if (typeof m.type !== 'string') {
    throw new ValidationError('marks must have a string `type`');
  }

  if (m.type === 'link' && m.attrs && typeof m.attrs === 'object') {
    const href = m.attrs.href;
    if (typeof href !== 'string' || !SAFE_HREF.test(href)) {
      throw new ValidationError('link href must be http(s) or relative');
    }
  }
}