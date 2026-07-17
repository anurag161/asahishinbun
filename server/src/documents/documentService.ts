import type { Db } from '../db/Db';
import { buildDocumentContext, DOCUMENT_TITLE, type DocumentType } from './context';
import { renderDocumentHtml } from './templates';
import { monthLabel } from './format';

export interface RenderedDocument {
  type: DocumentType;
  title: string;
  html: string;
  /** Safe ASCII base filename (no extension). */
  filenameBase: string;
}

export async function renderDocument(
  db: Db,
  type: DocumentType,
  staffId: number,
  month: string,
): Promise<RenderedDocument> {
  const ctx = await buildDocumentContext(db, staffId, month);
  const html = renderDocumentHtml(type, ctx);
  return {
    type,
    title: `${DOCUMENT_TITLE[type]} ${monthLabel(month)}`,
    html,
    filenameBase: `${type}_${staffId}_${month}`,
  };
}
