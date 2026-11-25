// Indian numbering system (lakh, crore) to English words for 0 .. 99,99,99,999.

const ONES = [
  '',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];

const TENS = [
  '',
  '',
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety',
];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const ten = Math.floor(n / 10);
  const rem = n % 10;
  return rem === 0 ? TENS[ten] : `${TENS[ten]}-${ONES[rem]}`;
}

function threeDigits(n: number): string {
  if (n === 0) return '';
  const hundred = Math.floor(n / 100);
  const rem = n % 100;
  const parts: string[] = [];
  if (hundred > 0) parts.push(`${ONES[hundred]} hundred`);
  if (rem > 0) parts.push(twoDigits(rem));
  return parts.join(' ');
}

export function amountInWords(amount: number): string {
  const whole = Math.floor(Math.max(0, Math.min(999999999, Math.round(amount))));
  if (whole === 0) return 'Zero rupees only';

  const crore = Math.floor(whole / 10000000);
  const lakh = Math.floor((whole % 10000000) / 100000);
  const thousand = Math.floor((whole % 100000) / 1000);
  const rest = whole % 1000;

  const parts: string[] = [];
  if (crore > 0) parts.push(`${twoDigits(crore)} crore`);
  if (lakh > 0) parts.push(`${twoDigits(lakh)} lakh`);
  if (thousand > 0) parts.push(`${twoDigits(thousand)} thousand`);
  if (rest > 0) parts.push(threeDigits(rest));

  const phrase = `${parts.join(' ')} rupees only`;
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}
