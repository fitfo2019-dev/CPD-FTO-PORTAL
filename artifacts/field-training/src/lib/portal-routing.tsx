import type { ReactNode } from 'react';
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
  return (
    <Switch>
      <Route path="/sign-in/*?">{signIn}</Route>
      <Route path="/sign-up/*?">{signUp}</Route>
      <Route path="/ui-preview/*?">{uiPreview}</Route>
      {developmentRoutes}
      <Route>{protectedPortal}</Route>
    </Switch>
  );
}

export function UiPreviewRouter({ children }: { children: ReactNode }) {
  return <WouterRouter base="/ui-preview">{children}</WouterRouter>;
}
