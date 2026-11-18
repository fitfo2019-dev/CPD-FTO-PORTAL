import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { WorkspaceProvider, useWorkspace } from '@/state/workspace';
import { Shell } from '@/components/shell';
import Dashboard from '@/pages/dashboard';
import Reports from '@/pages/reports';
import ReportEditor from '@/pages/report-editor';
import Training from '@/pages/training';
import Settings from '@/pages/settings';

const queryClient = new QueryClient();

function Router() {
  const { epoch } = useWorkspace();
  return (
    <RoutedErrorBoundary>
      <Switch key={epoch}>
        <Route path="/" component={Dashboard} />
        <Route path="/reports" component={Reports} />
        <Route path="/reports/new" component={ReportEditor} />
        <Route path="/reports/:id">{(p) => <ReportEditor key={p.id} />}</Route>
        <Route path="/training" component={Training} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}
function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <WorkspaceProvider>
            <Shell><Router /></Shell>
          </WorkspaceProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
export default App;
