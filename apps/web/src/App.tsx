import { MotionConfig } from 'framer-motion';
import { lazy } from 'react';
import { Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { LiveOrdering } from './commerce/Summary';
import { HomePage } from './pages/Home';
const CataloguePage = lazy(() => import('./pages/Catalogue').then(module => ({ default: module.CataloguePage })));
const ProductPage = lazy(() => import('./pages/Catalogue').then(module => ({ default: module.ProductPage })));
const AboutPage = lazy(() => import('./pages/Information').then(module => ({ default: module.AboutPage })));
const FaqPage = lazy(() => import('./pages/Information').then(module => ({ default: module.FaqPage })));
const GalleryPage = lazy(() => import('./pages/Information').then(module => ({ default: module.GalleryPage })));
const NotFoundPage = lazy(() => import('./pages/Information').then(module => ({ default: module.NotFoundPage })));
const PolicyPage = lazy(() => import('./pages/Information').then(module => ({ default: module.PolicyPage })));
const ContactPage = lazy(() => import('./pages/Contact'));

const AdminPage = lazy(() => import('./pages/Admin'));
const CartPage = lazy(() => import('./pages/CartCheckout').then(module => ({ default: module.CartPage })));
const CheckoutPage = lazy(() => import('./pages/CartCheckout').then(module => ({ default: module.CheckoutPage })));
const AccountPage = lazy(() => import('./pages/Account').then(module => ({ default: module.AccountPage })));
const ConfirmationPage = lazy(() => import('./pages/Tracking').then(module => ({ default: module.ConfirmationPage })));
const TrackingPage = lazy(() => import('./pages/Tracking').then(module => ({ default: module.TrackingPage })));
const PasswordPage = lazy(() => import('./pages/Tracking').then(module => ({ default: module.PasswordPage })));

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="menu" element={<CataloguePage />} />
          <Route path="menu/:slug" element={<ProductPage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="gallery" element={<GalleryPage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="faq" element={<FaqPage />} />
          <Route path="privacy" element={<PolicyPage policy="privacy" />} />
          <Route path="terms" element={<PolicyPage policy="terms" />} />
          <Route path="refunds" element={<PolicyPage policy="refunds" />} />
          <Route path="cancellation" element={<PolicyPage policy="cancellation" />} />
          <Route path="admin" element={<LiveOrdering><AdminPage /></LiveOrdering>} />
          <Route path="cart" element={<LiveOrdering><CartPage /></LiveOrdering>} />
          <Route path="checkout" element={<LiveOrdering><CheckoutPage /></LiveOrdering>} />
          <Route path="order-confirmation" element={<LiveOrdering><ConfirmationPage /></LiveOrdering>} />
          <Route path="track" element={<LiveOrdering><TrackingPage /></LiveOrdering>} />
          <Route path="account" element={<LiveOrdering><AccountPage /></LiveOrdering>} />
          <Route path="forgot-password" element={<LiveOrdering><PasswordPage /></LiveOrdering>} />
          <Route path="reset-password" element={<LiveOrdering><PasswordPage reset /></LiveOrdering>} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </MotionConfig>
  );
}
