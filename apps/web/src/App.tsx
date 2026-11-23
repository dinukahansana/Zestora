import { MotionConfig } from 'framer-motion';
import { lazy } from 'react';
import { Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { HomePage } from './pages/Home';
const CataloguePage = lazy(() => import('./pages/Catalogue').then(module => ({ default: module.CataloguePage })));
const ProductPage = lazy(() => import('./pages/Catalogue').then(module => ({ default: module.ProductPage })));
const AboutPage = lazy(() => import('./pages/Information').then(module => ({ default: module.AboutPage })));
const FaqPage = lazy(() => import('./pages/Information').then(module => ({ default: module.FaqPage })));
const GalleryPage = lazy(() => import('./pages/Information').then(module => ({ default: module.GalleryPage })));
const NotFoundPage = lazy(() => import('./pages/Information').then(module => ({ default: module.NotFoundPage })));
const PolicyPage = lazy(() => import('./pages/Information').then(module => ({ default: module.PolicyPage })));
const ContactPage = lazy(() => import('./pages/Contact'));

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
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </MotionConfig>
  );
}
