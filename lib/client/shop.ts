'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Lang, VendorProfile } from '@/lib/contract';
import { DEMO_SHOP } from '@/lib/vendor';

// Device-based identity, NOT authentication.
export type ShopProfile = VendorProfile & {
  vendor_key: string;
  default_language: Lang;
};

const SHOP_STORAGE_KEY = 'bb_shop';
const SHOP_CHANGE_EVENT = 'bb_shop_changed';

function notifyShopChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SHOP_CHANGE_EVENT));
  }
}

export function getShop(): ShopProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SHOP_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ShopProfile>;
    if (!parsed || typeof parsed.name !== 'string' || !parsed.vendor_key) {
      return null;
    }
    return {
      name: parsed.name,
      phone: typeof parsed.phone === 'string' ? parsed.phone : '',
      city: typeof parsed.city === 'string' ? parsed.city : null,
      vendor_key: parsed.vendor_key,
      default_language: parsed.default_language ?? 'kn',
    };
  } catch {
    return null;
  }
}

export function saveShop(
  input: Omit<ShopProfile, 'vendor_key'> & { vendor_key?: string },
): ShopProfile {
  const existing = getShop();
  const vendor_key =
    input.vendor_key ||
    existing?.vendor_key ||
    (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `shop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  const profile: ShopProfile = {
    name: input.name.trim(),
    phone: input.phone.trim(),
    city: input.city?.trim() || null,
    vendor_key,
    default_language: input.default_language,
  };

  try {
    localStorage.setItem(SHOP_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // ignore storage errors
  }
  notifyShopChanged();
  return profile;
}

export function saveDemoShop(): ShopProfile {
  return saveShop({
    name: DEMO_SHOP.profile.name,
    phone: DEMO_SHOP.profile.phone,
    city: DEMO_SHOP.profile.city,
    vendor_key: DEMO_SHOP.vendor_key,
    default_language: 'kn',
  });
}

export function clearShop(): void {
  try {
    localStorage.removeItem(SHOP_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
  notifyShopChanged();
}

export function useShop() {
  const [shop, setShop] = useState<ShopProfile | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    setShop(getShop());
    setReady(true);
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener(SHOP_CHANGE_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(SHOP_CHANGE_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [refresh]);

  return { shop, ready };
}
