import type { ReactNode } from 'react';
import { Route, Router as WouterRouter, Switch } from 'wouter';

export function PortalRouteSwitch({
  signIn,
  signUp,
  uiPreview,
  protectedPortal,
}: {
  signIn: ReactNode;
  signUp: ReactNode;
  uiPreview: ReactNode;
  protectedPortal: ReactNode;
}) {
  return (
    <Switch>
      <Route path="/sign-in/*?">{signIn}</Route>
      <Route path="/sign-up/*?">{signUp}</Route>
      <Route path="/ui-preview/*?">{uiPreview}</Route>
      <Route>{protectedPortal}</Route>
    </Switch>
  );
}

export function UiPreviewRouter({ children }: { children: ReactNode }) {
  return <WouterRouter base="/ui-preview">{children}</WouterRouter>;
}
