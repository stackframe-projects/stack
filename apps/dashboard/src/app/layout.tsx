import '../polyfills';
import './globals.css';
import React from 'react';
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from "geist/font/mono";
import { Analytics } from "@vercel/analytics/react";
import { Inter as FontSans } from "next/font/google";
import { StyleLink } from '@/components/style-link';
import { getEnvVariable } from '@stackframe/stack-shared/dist/utils/env';
import { stackServerApp } from '@/stack';
import { StackProvider, StackTheme } from '@stackframe/stack';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/components/theme-provider';
import { DevErrorNotifier } from '@/components/dev-error-notifier';
import { RouterProvider } from '@/components/router';
import { CSPostHogProvider, UserIdentity } from './providers';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_STACK_URL || ''),
  title: {
    default: 'Stack Auth Dashboard',
    template: '%s | Stack Auth',
  },
  description: 'Stack Auth is the fastest way to add authentication to your web app.',
  openGraph:{
    images: [`${process.env.NEXT_PUBLIC_STACK_URL}/open-graph-image.png`]
  }
};

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

type TagConfigJson = {
  tagName: string,
  attributes: { [key: string]: string },
  innerHTML?: string,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode,
}) {
  const headTags: TagConfigJson[] = JSON.parse(getEnvVariable('NEXT_PUBLIC_STACK_HEAD_TAGS'));

  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.gstatic.com" />
        <StyleLink href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded&display=block" />
        <StyleLink defer href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.css" integrity="sha384-OH8qNTHoMMVNVcKdKewlipV4SErXqccxxlg6HC9Cwjr5oZu2AdBej1TndeCirael" crossOrigin="anonymous" />

        {headTags.map((tag, index) => {
          const { tagName, attributes, innerHTML } = tag;
          return React.createElement(tagName, {
            key: index,
            dangerouslySetInnerHTML: { __html: innerHTML ?? "" },
            ...attributes,
          });
        })}
      </head>
      <CSPostHogProvider>
        <body 
          className={cn(
          "min-h-screen bg-background font-sans antialiased",
          fontSans.variable
        )}
          suppressHydrationWarning
        >
          <Analytics />
          <ThemeProvider>
            <StackProvider app={stackServerApp}>
              <StackTheme>
                <RouterProvider>
                  <UserIdentity />
                  {children}
                </RouterProvider>
              </StackTheme>
            </StackProvider>
          </ThemeProvider>
          <DevErrorNotifier />
          <Toaster />
        </body>
      </CSPostHogProvider>
    </html>
  );
}
