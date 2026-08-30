import type { Metadata } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import './globals.css';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { CartProvider } from '@/lib/cart-context';
import { AuthProvider } from '@/lib/auth-context';
import { WishlistProvider } from '@/lib/wishlist-context';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-fraunces',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Slay Jeans — Denim, redefined.',
    template: '%s | Slay Jeans',
  },
  description:
    'Premium denim and fashion for Men, Women and Kids. New washes, considered fits, limited runs.',
  metadataBase: new URL(process.env.WEB_URL ?? 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    siteName: 'Slay Jeans',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <head>
        <noscript>
          {/* Without JS the scroll-reveal never fires — show everything. */}
          <style>{`.reveal{opacity:1!important;transform:none!important}`}</style>
        </noscript>
      </head>
      <body className="flex min-h-screen flex-col overflow-x-hidden">
        <AuthProvider>
          <WishlistProvider>
            <CartProvider>
              <SiteHeader />
              <main className="flex-1">{children}</main>
              <SiteFooter />
            </CartProvider>
          </WishlistProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
