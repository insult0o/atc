import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ReactQueryProvider } from './providers/react-query-provider';
import { ErrorBoundary } from './components/error-boundary';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'PDF Intelligence Platform',
  description: 'AI-powered PDF processing platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ErrorBoundary>
          <ReactQueryProvider>
            {children}
          </ReactQueryProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
} 