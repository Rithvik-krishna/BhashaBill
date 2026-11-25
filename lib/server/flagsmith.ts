import { DefaultFlag, Flagsmith } from 'flagsmith-nodejs';
import type { FlagsResponse, Lang } from '@/lib/contract';
import { inr } from '@/lib/money';
import { DEMO_SHOP } from '@/lib/vendor';

export type ReminderVariant = 'polite' | 'firm';

export interface ReminderTraits {
  is_overdue: boolean;
  language: Lang;
  balance: number;
}

interface ReminderTemplates {
  polite: string;
  firm: string;
}

const DEFAULT_TEMPLATES: ReminderTemplates = {
  polite: 'Namaste {name}! Gentle reminder from {shop}: balance of ₹{balance} is due on {date}. Thank you!',
  firm: 'Namaste {name}, reminder from {shop}: balance of ₹{balance} was due on {date}. Please settle at your earliest.',
};

let cachedFlagsmith: Flagsmith | null = null;

function getFlagsmithClient(): Flagsmith | null {
  if (cachedFlagsmith) return cachedFlagsmith;
  const environmentKey = process.env.FLAGSMITH_ENVIRONMENT_KEY;
  if (!environmentKey) return null;

  cachedFlagsmith = new Flagsmith({
    environmentKey,
    requestTimeoutSeconds: 4,
    // Remote evaluation only (no local polling); safe fallback if Flagsmith is unreachable
    enableLocalEvaluation: false,
    defaultFlagHandler: () => new DefaultFlag(null, false),
  });
  return cachedFlagsmith;
}

function parseTemplates(raw: unknown): ReminderTemplates {
  if (!raw) return DEFAULT_TEMPLATES;
  try {
    const parsed = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Partial<ReminderTemplates>;
    return {
      polite:
        typeof parsed.polite === 'string' && parsed.polite.trim().length > 0
          ? parsed.polite
          : DEFAULT_TEMPLATES.polite,
      firm:
        typeof parsed.firm === 'string' && parsed.firm.trim().length > 0
          ? parsed.firm
          : DEFAULT_TEMPLATES.firm,
    };
  } catch {
    return DEFAULT_TEMPLATES;
  }
}

function normalizeVariant(raw: unknown): ReminderVariant {
  if (typeof raw === 'string' && raw.trim().toLowerCase() === 'firm') {
    return 'firm';
  }
  return 'polite';
}

export async function getPublicFlags(): Promise<FlagsResponse> {
  const client = getFlagsmithClient();
  if (!client) {
    return { tts_readback: false };
  }

  try {
    const flags = await client.getEnvironmentFlags();
    return {
      tts_readback: Boolean(flags.isFeatureEnabled('tts_readback')),
    };
  } catch (err) {
    console.error('[flagsmith] failed to fetch environment flags:', err);
    return { tts_readback: false };
  }
}

export async function getReminderConfig(
  identity: string,
  traits: ReminderTraits,
): Promise<{ variant: ReminderVariant; template: string }> {
  const client = getFlagsmithClient();
  if (!client) {
    const variant: ReminderVariant = traits.is_overdue ? 'firm' : 'polite';
    return { variant, template: DEFAULT_TEMPLATES[variant] };
  }

  try {
    const flags = await client.getIdentityFlags(identity, {
      is_overdue: traits.is_overdue,
      language: traits.language,
      balance: traits.balance,
    });
    const toneVal = flags.getFeatureValue('reminder_tone_test');
    const templatesVal = flags.getFeatureValue('reminder_templates');

    const variant =
      toneVal !== null && toneVal !== undefined && String(toneVal).trim() !== ''
        ? normalizeVariant(toneVal)
        : traits.is_overdue
          ? 'firm'
          : 'polite';
    const templates = parseTemplates(templatesVal);

    return {
      variant,
      template: templates[variant],
    };
  } catch (err) {
    console.error('[flagsmith] failed to evaluate reminder flags:', err);
    const variant: ReminderVariant = traits.is_overdue ? 'firm' : 'polite';
    return { variant, template: DEFAULT_TEMPLATES[variant] };
  }
}

export function renderReminderMessage(
  template: string,
  params: { name: string; shop?: string | null; balance: number; date: string | null },
): string {
  // inr() already includes "₹", so replace "₹{balance}" before "{balance}" to prevent "₹₹"
  const formattedBalance = inr(params.balance);
  const formattedDate = params.date ?? 'soon';
  const shopName = params.shop?.trim() || DEMO_SHOP.profile.name;

  return template
    .replaceAll('{name}', params.name)
    .replaceAll('{shop}', shopName)
    .replaceAll('₹{balance}', formattedBalance)
    .replaceAll('{balance}', formattedBalance)
    .replaceAll('{date}', formattedDate);
}
