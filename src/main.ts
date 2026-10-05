/**
 * JWT Faker Plugin
 *
 * Provides JSON Web Token (JWT) generation, HMAC signing (HS256, HS384, HS512),
 * unsigned token support (alg: none), decoding, claim quick-helpers, and template management.
 */

import type { PluginContext } from '@voiden/sdk/ui';
import React from 'react';
import { JwtFakerPanel } from './components/JwtFakerPanel';

const TAB_ID = 'jwt-faker';
const TAB_TITLE = 'JWT Faker';

const jwtFakerPlugin = (context: PluginContext) => {
  const showToast = (context as any)?.ui?.showToast as
    | ((message: string, type?: 'info' | 'success' | 'warning' | 'error') => void)
    | undefined;

  // Custom tabs render their component with no props, so bind showToast here.
  const JwtFakerTab = () => React.createElement(JwtFakerPanel, { showToast });

  // Opens the JWT Faker tab in the main panel, or focuses it if already open.
  const openTab = () => {
    context.addTab('main', { id: TAB_ID, title: TAB_TITLE, icon: null, props: {} });
  };

  return {
    onload: () => {
      // Register the tab component up front, so a JWT Faker tab restored from
      // the previous session renders without the button being clicked first.
      context.registerPanel('main', { id: TAB_ID, title: TAB_TITLE, component: JwtFakerTab });

      // Expose global helper to open the tab
      (window as any).__voidenOpenJwtFaker__ = openTab;

      // Register status bar item
      if (typeof context.registerStatusBarItem === 'function') {
        context.registerStatusBarItem({
          id: 'jwt-faker-status-item',
          position: 'left',
          label: 'JWT Faker',
          icon: 'Sparkles',
          tooltip: 'Generate and decode JWT tokens for testing',
          onClick: openTab,
        });
      }
    },

    onunload: () => {
      delete (window as any).__voidenOpenJwtFaker__;
    },
  };
};

export default jwtFakerPlugin;
