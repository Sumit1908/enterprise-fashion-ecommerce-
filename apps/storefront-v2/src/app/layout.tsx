import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { StoreProvider } from '@/lib/store';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { MobileNav } from '@/components/layout/MobileNav';
import { SearchOverlay } from '@/components/widgets/SearchOverlay';
import { CartDrawer } from '@/components/widgets/CartDrawer';
import { RegistrationModal } from '@/components/widgets/RegistrationModal';
import { Toast } from '@/components/widgets/Toast';
import { ReferEarnButton, RewardsButton } from '@/components/widgets/FloatingWidgets';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: {
    default: 'SLAY JEANS — Premium Men’s Fashion',
    template: '%s | SLAY JEANS',
  },
  description:
    'SLAY JEANS — premium men’s denim, shirts and everyday essentials. Built for everyday, made to move.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-white">
        <StoreProvider>
          <AnnouncementBar />
          <Header />
          <main>{children}</main>
          <Footer />

          <MobileNav />
          <SearchOverlay />
          <CartDrawer />
          <RegistrationModal />
          <ReferEarnButton />
          <RewardsButton />
          <Toast />
        </StoreProvider>
      </body>
    </html>
  );
}
