import type { Extracted, Lang } from '@/lib/contract';

export const DRAFT_STORAGE_KEY = 'bhashabill_draft_v1';

export interface OrderDraft {
  transcript: string;
  extracted: Extracted;
  language: Lang;
}

export function saveDraft(draft: OrderDraft): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
}

export function loadDraft(): OrderDraft | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OrderDraft;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(DRAFT_STORAGE_KEY);
}
