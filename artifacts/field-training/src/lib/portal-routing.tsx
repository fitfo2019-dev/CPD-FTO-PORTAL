import { createElement, type ReactNode } from 'react';
import { Route, Router as WouterRouter, Switch } from 'wouter';

export function PortalRouteSwitch({
  signIn,
  signUp,
  uiPreview,
  developmentRoutes,
  protectedPortal,
}: {
  signIn: ReactNode;
  signUp: ReactNode;
  uiPreview: ReactNode;
  developmentRoutes?: ReactNode;
  protectedPortal: ReactNode;
}) {
  return createElement(
    Switch,
    null,
    createElement(Route, { path: '/sign-in/*?' }, signIn),
    createElement(Route, { path: '/sign-up/*?' }, signUp),
    createElement(Route, { path: '/ui-preview/*?' }, uiPreview),
    developmentRoutes,
    createElement(Route, null, protectedPortal),
  );
}

export function UiPreviewRouter({ children }: { children: ReactNode }) {
  return createElement(WouterRouter, { base: '/ui-preview', children });
}
