import { useEffect, useRef, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, SignIn, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { ErrorBoundary } from '@/components/error-boundary.js';
import { Toaster } from '@/components/ui/toaster.js';
import { TooltipProvider } from '@/components/ui/tooltip.js';
import NotFound from '@/pages/not-found.js';
import { Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { WorkspaceProvider, useWorkspace } from '@/state/workspace.js';
import { Shell } from '@/components/shell.js';
import Dashboard from '@/pages/dashboard.js';
import Reports from '@/pages/reports.js';
import ReportEditor from '@/pages/report-editor.js';
import Training from '@/pages/training.js';
import Settings from '@/pages/settings.js';
import WeeklyAcknowledgementPage from '@/pages/weekly-acknowledgement.js';
import WeeklySummaryPage from '@/pages/weekly-summary.js';
import MonthlySummaryPage from '@/pages/monthly-summary.js';
import ClassOverview from '@/pages/class-overview.js';
import SubstituteFtoPage from '@/pages/substitute-fto.js';
import NrtFollowUpPage from '@/pages/nrt-follow-up.js';
import NrtUaPortalPage from '@/pages/nrt-ua-portal.js';
import PhaseSetupPage from '@/pages/phase-setup.js';
import FtoForumPage from '@/pages/fto-forum.js';
import HelpPage from '@/pages/help.js';
import CommandReviewPage from '@/pages/command-review.js';
import WeeklyPerformanceLogPage from '@/pages/weekly-performance-log.js';
import SubstationOrientationPage from '@/pages/substation-orientation.js';
import RoleAccessPage from '@/pages/role-access.js';
import { isTechnicalRole } from '@/lib/model.js';
import { getNextReportDate } from '@/lib/training-calendar.js';
import FtoClassesPage from '@/pages/fto-classes.js';
import { PortalRouteSwitch, UiPreviewRouter } from '@/lib/portal-routing.js';
import ApprovalPreviews from '@/pages/approval-previews.js';
import AgencyPacketsPage from '@/pages/agency-packets.js';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#004b87',
    colorForeground: '#1e293b',
    colorMutedForeground: '#475569',
    colorDanger: '#b42318',
    colorBackground: '#ffffff',
    colorInput: '#ffffff',
    colorInputForeground: '#1e293b',
    colorNeutral: '#1e293b',
    fontFamily: 'Arial, "Helvetica Neue", sans-serif',
    borderRadius: '0.375rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-white rounded-md w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-slate-900 font-bold',
    headerSubtitle: 'text-slate-600',
    socialButtonsBlockButtonText: 'text-slate-900 font-semibold',
    formFieldLabel: 'text-slate-800 font-semibold',
    footerActionLink: 'text-blue-800 font-semibold',
    footerActionText: 'text-slate-600',
    dividerText: 'text-slate-600',
    identityPreviewEditButton: 'text-blue-800',
    formFieldSuccessText: 'text-green-800',
    alertText: 'text-slate-900',
    logoBox: 'mx-auto',
    logoImage: 'max-h-10',
    socialButtonsBlockButton: 'border-slate-300 bg-white',
    formButtonPrimary: 'bg-blue-800 text-white hover:bg-blue-900',
    formFieldInput: 'border-slate-300 bg-white text-slate-900',
    footerAction: 'text-slate-600',
    dividerLine: 'bg-slate-300',
    alert: 'border-slate-300 bg-slate-50',
    otpCodeFieldInput: 'border-slate-300 bg-white text-slate-900',
    formFieldRow: 'text-slate-800',
    main: 'text-slate-900',
  },
};

function SignInPage() {
  return (
    <div className={`flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8 ${import.meta.env.DEV ? 'flex-col gap-4' : ''}`}>
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        appearance={clerkAppearance}
      />
      {import.meta.env.DEV && (
        <div className="flex flex-col items-center gap-3">
          <a
            href={`${basePath}/ui-preview`}
            className="inline-flex min-h-10 items-center rounded border border-primary/30 px-4 text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            Open UI test preview · fictional data only
          </a>
          <a
            href={`${basePath}/approval-preview`}
            className="text-sm font-semibold text-primary underline"
          >
            Open approval previews · no sign-in needed
          </a>
          <a
            href="/api/preview?component=PacketReviewPreview"
            className="inline-flex min-h-10 items-center rounded border border-primary/30 px-4 text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            Open packet approval preview · fictional data only
          </a>
        </div>
      )}
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8">
      <section className="w-full max-w-lg rounded-md border bg-card p-6" role="status">
        <p className="label-caps">Account access</p>
        <h1 className="mt-2 text-2xl font-bold">Account activation is invitation-only</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Account invitation and verification are not available here yet. Contact FTO Office Admin for account status. Training access opens after your department email, class, and starting phase are confirmed.</p>
        <a href={`${basePath}/sign-in`} className="mt-5 inline-flex min-h-11 items-center rounded bg-primary px-4 text-sm font-bold text-primary-foreground">Return to sign in</a>
      </section>
    </div>
  );
}

function ClerkWorkspaceSessionPurger() {
  const { addListener } = useClerk();
  const cache = useQueryClient();
  const { user } = useUser();
  const { lockNow } = useWorkspace();
  const previousUserId = useRef<string | null>(user?.id ?? null);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (previousUserId.current !== userId) {
        cache.clear();
        lockNow();
      }
      previousUserId.current = userId;
    });
    return () => {
      unsubscribe();
      cache.clear();
      lockNow();
    };
  }, [addListener, cache, lockNow]);

  return null;
}

function WorkspaceRoutes() {
  const { epoch, ws } = useWorkspace();
  // Fail closed in the COC preview: no draft/class route is rendered.
  // This UI boundary is not a substitute for server-side packet authorization.
  if (isTechnicalRole(ws.role)) return <RoutedErrorBoundary><Switch>
    <Route path="/resources" component={HelpPage}/>
    <Route path="/help"><Redirect to="/resources"/></Route>
    <Route path="/technical-access" component={RoleAccessPage}/>
    <Route component={RoleAccessPage}/>
  </Switch></RoutedErrorBoundary>;
  if (ws.role === 'po') return <RoutedErrorBoundary><Switch>
    <Route path="/agency-packets" component={AgencyPacketsPage}/>
    <Route path="/resources" component={HelpPage}/>
    <Route path="/help"><Redirect to="/resources"/></Route>
    <Route path="/role-access" component={RoleAccessPage}/>
    <Route component={RoleAccessPage}/>
  </Switch></RoutedErrorBoundary>;
  if (ws.role === 'fto_coc') return <RoutedErrorBoundary><Switch>
    <Route path="/resources" component={HelpPage}/>
    <Route path="/help"><Redirect to="/resources"/></Route>
    <Route component={CommandReviewPage}/>
  </Switch></RoutedErrorBoundary>;
  return (
    <RoutedErrorBoundary>
      <Switch key={epoch}>
        <Route path="/" component={Dashboard} />
        <Route path="/phase-setup" component={PhaseSetupPage} />
        <Route path="/substation-orientation" component={SubstationOrientationPage} />
        <Route path="/fto-forum" component={FtoForumPage} />
        <Route path="/reports" component={Reports} />
        <Route path="/agency-packets" component={AgencyPacketsPage} />
         <Route path="/reports/new"><ShiftStartGate/></Route>
        <Route path="/reports/weekly-summary" component={WeeklySummaryPage} />
        <Route path="/reports/monthly-summary" component={MonthlySummaryPage} />
        <Route path="/reports/weekly-log" component={WeeklyPerformanceLogPage} />
        <Route path="/reports/weekly-ack" component={WeeklyAcknowledgementPage} />
        <Route path="/nrt-ua" component={NrtUaPortalPage} />
        <Route path="/class-overview" component={ClassOverview} />
        <Route path="/substitute-fto" component={SubstituteFtoPage} />
         <Route path="/fto-classes" component={FtoClassesPage} />
        <Route path="/reports/:id/nrt-follow-up" component={NrtFollowUpPage} />
         <Route path="/reports/:id">{(params) => <ShiftStartGate key={params.id} reportId={params.id}/>}</Route>
        <Route path="/training" component={Training} />
        <Route path="/settings" component={Settings} />
        <Route path="/resources" component={HelpPage} />
        <Route path="/help"><Redirect to="/resources" /></Route>
        <Route path="/command-review" component={CommandReviewPage} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function ShiftStartGate({reportId}:{reportId?:string}) {
  const {ws}=useWorkspace();
  const folder=ws.caseFolder;
  const report=reportId&&reportId!=='new'?ws.reports.find(item=>item.id===reportId):undefined;
  const belongsToActiveFolder=!report||!!folder&&report.className===folder.className&&report.recruitBadge===folder.recruitBadge&&report.phase===folder.phase;
  const firstDay=folder?getNextReportDate(folder,[]):'';
  const orientationExists=!!folder&&ws.substationOrientations.some(item=>
    item.className===folder.className&&item.recruitBadge===folder.recruitBadge
      &&item.phaseStartDate===firstDay&&(item.phase??1)===folder.phase,
  );
  if(ws.role==='fto'&&folder&&belongsToActiveFolder&&!orientationExists) {
    return <Redirect to="/substation-orientation"/>;
  }
  return <ReportEditor/>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function DemoWorkspace() {
  return (
    <WorkspaceProvider>
      <ClerkWorkspaceSessionPurger />
      <Shell><WorkspaceRoutes /></Shell>
    </WorkspaceProvider>
  );
}

function DevelopmentUiPreview() {
  return (
    <UiPreviewRouter>
      <WorkspaceProvider storageNamespace="fieldready-ui-preview" previewOnly>
        <div className="min-h-screen">
          <div
            className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-xs font-semibold text-amber-950"
            role="status"
          >
            DISPOSABLE UI PREVIEW · Fictional assignment loaded · Changes stay in memory until refresh · No portal or record access
          </div>
          <Shell><WorkspaceRoutes /></Shell>
        </div>
      </WorkspaceProvider>
    </UiPreviewRouter>
  );
}

function AuthenticatedWorkspace() {
  const { isLoaded, isSignedIn, user } = useUser();

  if (!isLoaded) return null;
  if (!isSignedIn || !user) return <Redirect to="/sign-in" />;
  return <DemoWorkspace key={user.id} />;
}

function ClerkRoutes() {
  const [, setLocation] = useLocation();
  if (!clerkPubKey) {
    throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in the Field Training Officer Portal environment.');
  }

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: 'Sign in to Field Training Officer Portal', subtitle: 'Use your approved staff account.' } },
        signUp: { start: { title: 'Request a Field Training Officer Portal account', subtitle: 'An account does not grant report access.' } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <PortalRouteSwitch
        signIn={<SignInPage />}
        signUp={<SignUpPage />}
        uiPreview={<DevelopmentUiPreview />}
        protectedPortal={<AuthenticatedWorkspace />}
      />
    </ClerkProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={basePath}>
          <Switch>
            {import.meta.env.DEV && <Route path="/approval-preview" component={ApprovalPreviews} />}
            <Route component={ClerkRoutes} />
          </Switch>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
