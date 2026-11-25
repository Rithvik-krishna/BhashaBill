// Pure date parsing helper for spoken due-date phrases across en/kn/hi/ta.

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDaysIso(base: Date, days: number): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
  return toIsoDate(d);
}

export function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

// 0 = Sunday .. 6 = Saturday
const WEEKDAY_PATTERNS: { day: number; patterns: string[] }[] = [
  {
    day: 0,
    patterns: ['sunday', 'sun', 'ಭಾನುವಾರ', 'रविवार', 'ஞாயிறு'],
  },
  {
    day: 1,
    patterns: ['monday', 'mon', 'ಸೋಮವಾರ', 'सोमवार', 'திங்கள்'],
  },
  {
    day: 2,
    patterns: ['tuesday', 'tue', 'tues', 'ಮಂಗಳವಾರ', 'मंगलवार', 'செவ்வாய்'],
  },
  {
    day: 3,
    patterns: ['wednesday', 'wed', 'ಬುಧವಾರ', 'बुधवार', 'புதன்'],
  },
  {
    day: 4,
    patterns: ['thursday', 'thu', 'thur', 'thurs', 'ಗುರುವಾರ', 'गुरुवार', 'வியாழன்'],
  },
  {
    day: 5,
    patterns: ['friday', 'fri', 'ಶುಕ್ರವಾರ', 'शुक्रवार', 'வெள்ளி'],
  },
  {
    day: 6,
    patterns: ['saturday', 'sat', 'ಶನಿವಾರ', 'शनिवार', 'சனி'],
  },
];

const DAY_AFTER_PATTERNS = ['day after tomorrow', 'ನಾಡಿದ್ದು', 'परसों', 'நாளை மறுநாள்'];
const TOMORROW_PATTERNS = ['tomorrow', 'ನಾಳೆ', 'कल', 'நாளை'];
const TODAY_PATTERNS = ['today', 'ಇಂದು', 'आज', 'இன்று'];

export function parseDueText(text: string | null | undefined, today = new Date()): string | null {
  if (!text) return null;
  const normalized = text.trim().toLowerCase().replace(/கிழமை/g, '').replace(/\s+/g, ' ');
  if (!normalized) return null;

  if (DAY_AFTER_PATTERNS.some((p) => normalized.includes(p))) {
    return addDaysIso(today, 2);
  }
  if (TOMORROW_PATTERNS.some((p) => normalized.includes(p))) {
    return addDaysIso(today, 1);
  }
  if (TODAY_PATTERNS.some((p) => normalized.includes(p))) {
    return addDaysIso(today, 0);
  }

  for (const entry of WEEKDAY_PATTERNS) {
    for (const pat of entry.patterns) {
      // ASCII weekday names use word boundaries; Indic scripts use substring match
      const isAscii = /^[a-z]+$/.test(pat);
      const matched = isAscii
        ? new RegExp(`\\b${pat}\\b`, 'i').test(normalized)
        : normalized.includes(pat);
      if (matched) {
        const currentDay = today.getDay();
        const diff = (entry.day - currentDay + 7) % 7;
        const daysAhead = diff === 0 ? 7 : diff; // strictly after today
        return addDaysIso(today, daysAhead);
      }
    }
  }

  return null;
}
