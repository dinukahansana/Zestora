import { useQuery } from '@tanstack/react-query';
import { api, orderingEnabled } from '../commerce/api';
import type { LocalText } from './catalogue';
import { contact as environmentContact } from './contact';

export interface Presentation {
  name: string;
  logo: string;
  phone: string;
  email: string;
  address: LocalText;
  hours: LocalText;
  map: string;
  whatsapp: string;
  instagram: string;
  facebook: string;
  defaultLanguage: 'en' | 'si';
  currency: 'LKR';
}

export function useShopPresentation() {
  return useQuery({
    queryKey: ['shop-presentation'], enabled: orderingEnabled, staleTime: 60000,
    queryFn: () => api<Presentation>('/shop/storefront'),
  });
}

export function useShopContact() {
  const { data } = useShopPresentation();
  return {
    email: data?.email || environmentContact.email,
    phone: data?.phone || environmentContact.phone,
    address: { en: data?.address.en || environmentContact.address, si: data?.address.si || data?.address.en || environmentContact.address },
    hours: { en: data?.hours.en || environmentContact.hours.en, si: data?.hours.si || environmentContact.hours.si },
    links: environmentContact.links.map(link => ({
      ...link,
      url: data?.[link.name as 'map' | 'whatsapp' | 'facebook' | 'instagram'] || link.url,
    })),
  };
}
