import type { VendorProfile } from './contract';

// Single hardcoded demo shop. EDIT the phone number (digits with country code, no +).
export const DEMO_SHOP = {
  vendor_key: 'demo',
  profile: {
    name: 'Lakshmi Sweets',
    phone: '919000000000',
    city: 'Mysuru',
  },
} satisfies { vendor_key: string; profile: VendorProfile };
