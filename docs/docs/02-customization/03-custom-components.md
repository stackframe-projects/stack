---
sidebar_position: 1
---

# Custom Components

Even though Stack provides beautiful components out of the box, sometimes you might want to achieve coherent visual across your whole website.Stack allow you to replace low-level components like button, input, and text, with your own custom components as long as the props are the same.  The high-level components like sign-in, sign-up, or oauth will automatically use the custom components. This is useful if you want to achieve deep customization. 

We currently already implemented the support for MUI Joy for you, so you can use it directly with minimal setup (see [MUI Joy](#mui-joy-setup)). If you use other libraries or your own custom components, you can follow customizing components guide below.

## Customizing Components

Here is an example of how you can customize the button component. For demostration purpose, we will keep the styling minimal. First we will create a new button component with `ButtonProps`. You can use `useDesign` hook to get the colors scheme (see more in [Custom Colors](/docs/02-customization/02-custom-colors)). You can also ignore the color scheme if you have a different way to handle colors.

```jsx
'use client';

import { ButtonProps, useDesign } from "@stackframe/stack-ui";

export default function CustomButton({
  variant = "primary",
  color,
  size = "md",
  loading = false,
  disabled = false,
  children,
  ...props
} : ButtonProps) {
  const { colors } = useDesign();

  return <button
    style={{
      padding: ({ sm: 5, md: 10, lg: 15 } as const)[size],
      backgroundColor: color || ({
        primary: colors.primaryColor,
        secondary: colors.secondaryColor,
      } as const)[variant],
    }}
    disabled={loading || disabled}
    {...props}
  >
    {children}
  </button>;
}
```

Then you can pass the custom button to the `StackUIProvider` (if you followed the get started guide, you can find it in your `layout.tsx` file) as follows:

```jsx
import { StackUIProvider } from "@stackframe/stack-ui";
import CustomButton from "./your-custom-button-path";

const theme = {
  // other theme configs
  elements: {
    Button: CustomButton,
  }
}

//...

<StackUIProvider theme={theme}>
  {/* children */}
</StackUIProvider>
```

Now if you check out your sign-in page, you will see the sign-in button there is using your custom button component. If you import `Button` from `@stackframe/stack-ui`, it will also use your custom button component as well.

## MUI Joy setup

If you use MUI Joy and want the Stack components to look consistent with MUI Joy, you can follow the following steps:

1. Install `stack-ui-joy`:
    ```bash
    npm install @stackframe/stack-ui-joy
    ```

2. Replace `StackUIProvider` with `StackUIJoyProvider`, and put it inside your `CssVarsProvider` from Joy UI. Your `layout.tsx` file should look like this:
    ```jsx
    import React from "react";
    import { CssVarsProvider, getInitColorSchemeScript } from '@mui/joy/styles';
    import CssBaseline from '@mui/joy/CssBaseline';
    import { StackProvider } from "@stackframe/stack";
    import Provider from "src/components/provider";
    import { stackServerApp } from "src/stack";


    export default function RootLayout({ children }: { children: React.ReactNode }) {
      return (
        <html lang="en" suppressHydrationWarning>
          <head />
          <body>
            {getInitColorSchemeScript()}
            <StackProvider app={stackServerApp}>
              <CssVarsProvider defaultMode="system">
                <CssBaseline />
                <StackUIJoyProvider>
                  {props.children}
                </StackUIJoyProvider>
              </CssVarsProvider>
            </StackProvider>
          </body>
        </html>
      );
    }
    ```

    Now your Stack components will look consistent with MUI Joy. Note it is important that `StackUIJoyProvider` is inside `CssVarsProvider`. It uses the color mode from `CssVarsProvider` to automatically.

    If you need more information about MUI Joy setup, you can check out the [Joy UI Next.js integration docs](https://mui.com/joy/getting-started/installation/).