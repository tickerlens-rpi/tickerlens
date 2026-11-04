/**
 * @fileoverview Small text helpers for research copy.
 */

import type {Company} from '../data/research';

/** Counts words the way a reader would: runs of non-space characters. */
export function countWords(text: string): number {
  return text.split(/\s+/).filter(word => word !== '').length;
}

const LEGAL_SUFFIX =
  /,?\s+(Inc\.|Incorporated|Corporation|Corp\.|Company|Co\.|& Co\.)$/;

/**
 * The name people use in conversation: "Apple Inc." becomes "Apple" and
 * "The Walt Disney Company" becomes "Walt Disney".
 */
export function shortName(company: Company): string {
  return company.name.replace(/^The\s+/, '').replace(LEGAL_SUFFIX, '');
}
