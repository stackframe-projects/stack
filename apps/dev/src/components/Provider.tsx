'use client';
import { StackUIProvider } from "@stackframe/stack-ui";
import { elements } from "@stackframe/stack-ui-joy";
import { ThemeProvider } from 'next-themes';

export default function Provider({ children }) {
  return (
    <ThemeProvider>
      <StackUIProvider elements={elements}>
        {children}
      </StackUIProvider>
    </ThemeProvider>
  );
}