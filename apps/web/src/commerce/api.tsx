import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { Choice, LocalText } from '../content/catalogue';

export const orderingEnabled = import.meta.env.VITE_CATALOGUE_MODE === 'api';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(`/api${path}`, { ...options, headers, credentials: 'same-origin' });
  if (!response.ok) {
    const data = await response.json().catch(() => null) as { error?: { code?: string } } | null;
    throw new ApiError(data?.error?.code ?? 'REQUEST_FAILED', response.status);
  }
  if (response.status === 204 || response.status === 202) return undefined as T;
  return response.json() as Promise<T>;
}

export function send<T>(path: string, data?: unknown, method = 'POST') {
  return api<T>(path, { method, body: data === undefined ? undefined : JSON.stringify(data) });
}

export interface Account {
  id: string;
  email: string;
  name: string;
  role: 'customer' | 'admin';
}

export interface Address {
  _id: string;
  label: string;
  address: string;
}

export type PaymentEnvironment = 'sandbox' | 'live' | 'simulator';

export interface Shop {
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  minimumOrder: number;
  paymentEnvironment?: PaymentEnvironment;
  deliveryZones: { id: string; name: LocalText; fee: number }[];
}

export interface Line {
  productSlug: string;
  name: LocalText;
  size: Choice;
  addOns: Choice[];
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Totals {
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
}

export interface Quote {
  items: Line[];
  totals: Totals;
}

export interface Order extends Quote {
  reference: string;
  customer: { name: string; email: string; phone: string };
  fulfillment: { type: 'pickup' | 'delivery'; address?: string; zoneId?: string; preferredAt?: string; instructions?: string };
  notes: string;
  orderStatus: string;
  paymentStatus: string;
  paymentMethod: string;
  paymentEnvironment?: PaymentEnvironment;
  createdAt: string;
}

export function useAccount() {
  return useQuery({
    queryKey: ['account'], enabled: orderingEnabled, retry: false,
    queryFn: async ({ signal }) => {
      try {
        return (await api<{ user: Account }>('/auth/me', { signal })).user;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
  });
}

export function RequestError({ error }: { error: unknown }) {
  const { t } = useTranslation();
  if (!error) return null;
  return (
    <p role="alert" className="rounded-xl bg-blush p-3 text-sm font-bold text-[#783326]">
      {t(`errors.${error instanceof ApiError ? error.code : 'REQUEST_FAILED'}`, { defaultValue: t('errors.REQUEST_FAILED') })}
    </p>
  );
}
