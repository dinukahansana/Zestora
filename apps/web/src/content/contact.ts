import type { Language } from '../i18n';

function value(input?: string) {
  return input?.trim() || undefined;
}

function httpsLink(input?: string) {
  if (!input) return undefined;
  try {
    const url = new URL(input);
    return url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

const email = value(import.meta.env.VITE_BUSINESS_EMAIL);
const phone = value(import.meta.env.VITE_BUSINESS_PHONE);

export const contact = {
  email: email && /^[^\s@?&]+@[^\s@?&]+\.[^\s@?&]+$/.test(email) ? email : undefined,
  phone: phone && /^\+?[\d\s()-]{7,25}$/.test(phone) ? phone : undefined,
  address: value(import.meta.env.VITE_BUSINESS_ADDRESS),
  hours: {
    en: value(import.meta.env.VITE_BUSINESS_HOURS_EN),
    si: value(import.meta.env.VITE_BUSINESS_HOURS_SI),
  } satisfies Record<Language, string | undefined>,
  links: [
    { name: 'map', url: httpsLink(import.meta.env.VITE_BUSINESS_MAP_URL) },
    { name: 'whatsapp', url: httpsLink(import.meta.env.VITE_BUSINESS_WHATSAPP_URL) },
    { name: 'instagram', url: httpsLink(import.meta.env.VITE_BUSINESS_INSTAGRAM_URL) },
    { name: 'facebook', url: httpsLink(import.meta.env.VITE_BUSINESS_FACEBOOK_URL) },
  ],
};
