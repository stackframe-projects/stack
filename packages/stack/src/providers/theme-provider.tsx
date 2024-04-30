'use client';

import React from "react";
import { StackDesignProvider, DesignConfig } from "./design-provider";
import { StackComponentProvider, ComponentConfig } from "./component-provider";
import StyledComponentsRegistry from "./styled-components-registry";

export type ThemeConfig = DesignConfig & ComponentConfig;

export function StackTheme({
  theme,
  children,
} : { 
  children?: React.ReactNode,
  theme?: DesignConfig & ComponentConfig,
}) {
  const componentProps = { components: theme?.components };

  return (
    <StyledComponentsRegistry>
      <StackDesignProvider {...theme}>
        <StackComponentProvider {...componentProps}>
          {children}
        </StackComponentProvider>
      </StackDesignProvider>
    </StyledComponentsRegistry>
  );
}