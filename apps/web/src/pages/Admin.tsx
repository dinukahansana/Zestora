import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { PageHeading } from '../components/Storefront';
import { RequestError, useAccount } from '../commerce/api';
import { CatalogueEditor } from '../admin/CatalogueEditor';
import { Dashboard } from '../admin/Dashboard';
import { CustomersAdmin, OrdersAdmin } from '../admin/Operations';
import { SettingsAdmin, StockCouponsAdmin } from '../admin/Settings';

const tabs = ['overview', 'catalogue', 'orders', 'customers', 'stockCoupons', 'settings'] as const;
type Tab = typeof tabs[number];

export default function AdminPage() {
  const { t } = useTranslation();
  const account = useAccount();
  const [params, setParams] = useSearchParams();
  const tab = tabs.find(item => item === params.get('tab')) ?? 'overview';
  const changeTab = (next: Tab) => setParams({ tab: next }, { preventScrollReset: true });

  return <>
    <PageHeading title={t('admin.title')} />
    <div className="container-wide py-7">
      {account.isPending ? <p role="status">{t('common.loading')}</p>
        : account.isError ? <RequestError error={account.error} />
        : account.data?.role !== 'admin' ? <div className="rounded-xl bg-moss p-4">
          <p>{t('admin.forbidden')}</p>
          {!account.data && <Link to="/account?next=admin" className="button button-primary mt-3">{t('account.signIn')}</Link>}
        </div> : <>
          <nav aria-label={t('admin.title')} className="mb-5 flex flex-wrap gap-2 border-b border-line pb-4">
            {tabs.map(item => <button key={item} type="button" aria-current={tab === item ? 'page' : undefined} className={`button ${tab === item ? 'button-primary' : 'button-outline'}`} onClick={() => changeTab(item)}>{t(`admin.${item}`)}</button>)}
          </nav>
          {tab === 'overview' && <Dashboard openOrders={() => changeTab('orders')} />}
          {tab === 'catalogue' && <CatalogueEditor />}
          {tab === 'orders' && <OrdersAdmin />}
          {tab === 'customers' && <CustomersAdmin />}
          {tab === 'stockCoupons' && <StockCouponsAdmin />}
          {tab === 'settings' && <SettingsAdmin />}
        </>}
    </div>
  </>;
}
