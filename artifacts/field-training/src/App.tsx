import { lazy, Suspense, useCallback, useEffect, useRef, type ComponentType, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, SignIn, useAuth, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { ErrorBoundary } from '@/components/error-boundary.js';
import { Toaster } from '@/components/ui/toaster.js';
import { TooltipProvider } from '@/components/ui/tooltip.js';
import NotFound from '@/pages/not-found.js';
import { Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { WorkspaceProvider, useWorkspace } from '@/state/workspace.js';
import { PacketReviewProvider } from '@/state/packet-review.js';
import { PacketReviewGate } from '@/components/packet-review/gate.js';
import PacketSubmissionsPage from '@/pages/packet-submissions.js';
import { Shell } from '@/components/shell.js';
import Dashboard from '@/pages/dashboard.js';
import Reports from '@/pages/reports.js';
import ReportEditor from '@/pages/report-editor.js';
import Training from '@/pages/training.js';
import Settings from '@/pages/settings.js';
import WeeklyAcknowledgementPage from '@/pages/weekly-acknowledgement.js';
import WeeklyPacketPage from '@/pages/weekly-packet.js';
import WeeklySummaryPage from '@/pages/weekly-summary.js';
import MonthlySummaryPage from '@/pages/monthly-summary.js';
import ClassOverview from '@/pages/class-overview.js';
import SubstituteFtoPage from '@/pages/substitute-fto.js';
import NrtFollowUpPage from '@/pages/nrt-follow-up.js';
import NrtUaPortalPage from '@/pages/nrt-ua-portal.js';
import PhaseSetupPage from '@/pages/phase-setup.js';
import FtoForumPage from '@/pages/fto-forum.js';
import HelpPage from '@/pages/help.js';
import ResourcesLibraryPage from '@/pages/resources-library-preview.js';
import CommandReviewPage from '@/pages/command-review.js';
import WeeklyPerformanceLogPage from '@/pages/weekly-performance-log.js';
import SubstationOrientationPage from '@/pages/substation-orientation.js';
import RoleAccessPage from '@/pages/role-access.js';
import { isTechnicalRole } from '@/lib/model.js';
import { getNextReportDate } from '@/lib/training-calendar.js';
import FtoClassesPage from '@/pages/fto-classes.js';
import { PortalRouteSwitch, UiPreviewRouter } from '@/lib/portal-routing.js';
import ApprovalPreviews from '@/pages/approval-previews.js';
import RunChecklistPreview from '@/pages/run-checklist-preview.js';
import AgencyPacketsPage from '@/pages/agency-packets.js';
import { createFtoTestPacketWorkspace } from '@/lib/test-packet.js';
import { OperationalProfileProvider, useOperationalProfile } from '@/state/operational-profile.js';
import { DaisyStatusNotice } from '@/components/daisy-status-notice.js';
import type { ClerkSessionIdentity, ValidateClerkSession } from '@/lib/auth-session.js';
const TestAdminPage = import.meta.env.DEV
  ? lazy(() => import('@/features/test-admin/TestAdminPage.js'))
  : null;

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
            Fictional portal preview
          </a>
          <a
            href={`${basePath}/ui-preview/resources-preview`}
            className="inline-flex min-h-10 items-center rounded border border-primary/30 px-4 text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            Resources library preview
          </a>
          <a
            href={`${basePath}/fto-test-packet-preview/`}
            className="inline-flex min-h-10 items-center rounded border border-primary/30 px-4 text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            Open FTO test packet · fictional data only
          </a>
          <a
            href={`${basePath}/approval-preview`}
            className="text-sm font-semibold text-primary underline"
          >
            Open fictional approval-form preview
          </a>
          <a
            href="/__mockup/preview/PacketHandoffFlowPreview"
            className="inline-flex min-h-10 items-center rounded border border-primary/30 px-4 text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            Open packet handoff preview · fictional data only
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
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">An invitation is required. Training access opens after your department email, class, and starting phase are confirmed. If you do not have an invitation, follow your established department process.</p>
        <a href={`${basePath}/sign-in`} className="mt-5 inline-flex min-h-11 items-center rounded bg-primary px-4 text-sm font-bold text-primary-foreground">Return to sign in</a>
      </section>
    </div>
  );
}

function ClerkWorkspaceSessionPurger() {
  const { addListener } = useClerk();
  const cache = useQueryClient();
  const { user } = useUser();
  const workspace = useWorkspace();
  const workspaceRef = useRef(workspace); workspaceRef.current = workspace;
  const previousUserId = useRef<string | null>(user?.id ?? null);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (previousUserId.current !== userId) {
        const current = workspaceRef.current;
        const priorUserId = previousUserId.current;
        if (priorUserId && (current.dirty || current.editorDirty) && current.vault === 'unlocked') {
          void current.saveAuthRecoverySnapshot?.(priorUserId)
            .catch(() => { /* Failed local recovery is surfaced by the workspace save state. */ })
            .finally(() => { cache.clear(); current.lockNow(); });
        } else {
          cache.clear();
          current.lockNow();
        }
      }
      previousUserId.current = userId;
    });
    return () => {
      unsubscribe();
      cache.clear();
    };
  }, [addListener, cache]);

  return null;
}

// Rebuild screens (Phase Setup, Phase Sign-Up, My Probationary Officer, PO Progress) are
// preview-only until their server routes are integrated; production builds exclude them.
const loadRebuild = () => import('./features/rebuild/pages.js');
const RebuildPhaseSetup = import.meta.env.DEV ? lazy(() => loadRebuild().then(m => ({ default: m.RebuildPhaseSetup }))) : null;
const RebuildPhaseSignUp = import.meta.env.DEV ? lazy(() => loadRebuild().then(m => ({ default: m.RebuildPhaseSignUp }))) : null;
const RebuildMyProbationaryOfficer = import.meta.env.DEV ? lazy(() => loadRebuild().then(m => ({ default: m.RebuildMyProbationaryOfficer }))) : null;
const RebuildPoProgress = import.meta.env.DEV ? lazy(() => loadRebuild().then(m => ({ default: m.RebuildPoProgress }))) : null;
function RebuildRoute({ page: Page }: { page: ComponentType | null }) {
  if (!Page) return <NotFound />;
  return <Suspense fallback={null}><Page /></Suspense>;
}

function WorkspaceRoutes() {
  const { epoch, ws } = useWorkspace();
  const [path]=useLocation();
  if (path === '/test-admin') {
    if (!TestAdminPage) return <NotFound />;
    return <RoutedErrorBoundary><Suspense fallback={<div role="status" className="p-8 text-sm">Loading Test Admin…</div>}><TestAdminPage /></Suspense></RoutedErrorBoundary>;
  }
  // FTO Sergeant previews expose role-appropriate Help Desk guidance only.
  // Assignment authority remains a separate server-side capability.
  if (ws.role === 'fto_sgt') return <RoutedErrorBoundary><Switch>
    {RebuildPhaseSetup && <Route path="/rebuild-phase-setup">{() => <RebuildRoute page={RebuildPhaseSetup}/>}</Route>}
    {RebuildPoProgress && <Route path="/po-progress">{() => <RebuildRoute page={RebuildPoProgress}/>}</Route>}
    <Route path="/reports/weekly-packet" component={WeeklyPacketPage}/>
    <Route path="/resources" component={HelpPage}/>
    <Route path="/help"><Redirect to="/resources"/></Route>
    <Route>{() => <Redirect to="/resources"/>}</Route>
  </Switch></RoutedErrorBoundary>;
  // This route authorizes through the signed server role, never the local role preview.
  if(path==='/packet-submissions') return <RoutedErrorBoundary><PacketSubmissionsPage/></RoutedErrorBoundary>;
  // Fail closed in the COC preview: no draft/class route is rendered.
  // This UI boundary is not a substitute for server-side packet authorization.
  if (isTechnicalRole(ws.role)) return <RoutedErrorBoundary><Switch>
    <Route path="/resources" component={HelpPage}/>
    <Route path="/help"><Redirect to="/resources"/></Route>
    <Route path="/technical-access" component={RoleAccessPage}/>
    <Route component={RoleAccessPage}/>
  </Switch></RoutedErrorBoundary>;
  if (ws.role === 'po') return <RoutedErrorBoundary><Switch>
    <Route path="/settings" component={Settings}/>
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
        {RebuildPhaseSetup && <Route path="/rebuild-phase-setup">{() => <RebuildRoute page={RebuildPhaseSetup}/>}</Route>}
        {RebuildPoProgress && <Route path="/po-progress">{() => <RebuildRoute page={RebuildPoProgress}/>}</Route>}
        {RebuildPhaseSignUp && <Route path="/phase-sign-up">{() => <RebuildRoute page={RebuildPhaseSignUp}/>}</Route>}
        {RebuildMyProbationaryOfficer && <Route path="/my-probationary-officer">{() => <RebuildRoute page={RebuildMyProbationaryOfficer}/>}</Route>}
        <Route path="/substation-orientation" component={SubstationOrientationPage} />
        <Route path="/fto-forum" component={FtoForumPage} />
        <Route path="/reports" component={Reports} />
        <Route path="/agency-packets" component={AgencyPacketsPage} />
         <Route path="/reports/new"><ShiftStartGate/></Route>
        <Route path="/reports/weekly-packet" component={WeeklyPacketPage} />
        <Route path="/reports/weekly-summary" component={WeeklySummaryPage} />
        <Route path="/reports/monthly-summary" component={MonthlySummaryPage} />
        <Route path="/reports/weekly-log" component={WeeklyPerformanceLogPage} />
        <Route path="/reports/weekly-ack" component={WeeklyAcknowledgementPage} />
        <Route path="/nrt-ua" component={NrtUaPortalPage} />
        <Route path="/class-overview" component={ClassOverview} />
        <Route path="/substitute-fto" component={SubstituteFtoPage} />
         <Route path="/fto-classes" component={FtoClassesPage} />
        <Route path="/reports/:id/nrt-follow-up" component={NrtFollowUpPage} />
         <Route path="/reports/:id">{(params: {id:string}) => <ShiftStartGate key={params.id} reportId={params.id}/>}</Route>
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
  const { pending } = useOperationalProfile();
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
  if ((!reportId || reportId === 'new') && pending) return null;
  return <ReportEditor/>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function DemoWorkspace({ authSession, validateSession }: {
  authSession: ClerkSessionIdentity;
  validateSession: ValidateClerkSession;
}) {
  return (
    <WorkspaceProvider authSession={authSession} validateSession={validateSession}>
      <OperationalProfileProvider key={authSession.accountId} authSession={authSession} validateSession={validateSession}>
        <ClerkWorkspaceSessionPurger />
        <PacketReviewProvider>
          <PacketReviewGate/>
          <Shell><WorkspaceRoutes /></Shell>
        </PacketReviewProvider>
      </OperationalProfileProvider>
    </WorkspaceProvider>
  );
}

function DevelopmentUiPreviewContent() {
  const [path] = useLocation();
  const daisyUiPreview = import.meta.env.DEV && path === '/daisyui-component';
  const resourcesPreview = import.meta.env.DEV && path === '/resources-preview';
  return (
    <PacketReviewProvider>
      <Shell>
        {daisyUiPreview
          ? <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
              <DaisyStatusNotice
                title="Local Draft Saved"
                description="This copy is saved on this device and has not been submitted to the Coordinator."
              />
            </main>
          : resourcesPreview
          ? <ResourcesLibraryPage previewOnly />
          : <WorkspaceRoutes />}
      </Shell>
    </PacketReviewProvider>
  );
}

function DevelopmentUiPreview() {
  return (
    <UiPreviewRouter>
      <WorkspaceProvider storageNamespace="fieldready-ui-preview" previewOnly>
        <DevelopmentUiPreviewContent />
      </WorkspaceProvider>
    </UiPreviewRouter>
  );
}

function DevelopmentFtoTestPacketPreview() {
  return (
    <WouterRouter base="/fto-test-packet-preview">
      <WorkspaceProvider
        storageNamespace="fieldready-fto-test-packet-preview"
        previewOnly
        previewWorkspace={createFtoTestPacketWorkspace}
        previewLabel="FTO test packet"
      >
        <div className="min-h-screen">
          <div className="border-b-2 border-amber-500 bg-amber-50 px-4 py-3 text-center text-sm text-amber-950" role="status" data-testid="banner-fto-test-packet">
            <strong>TEST PACKET</strong>
            <span className="mx-2 hidden sm:inline">|</span>
            <span>Sample records only · no signatures, approvals, release, or agency sync.</span>
          </div>
          <PacketReviewProvider><Shell><WorkspaceRoutes /></Shell></PacketReviewProvider>
        </div>
      </WorkspaceProvider>
    </WouterRouter>
  );
}

function AuthenticatedWorkspace() {
  const { getToken, isLoaded, isSignedIn, userId, sessionId } = useAuth();
  const liveSession = useRef({ isLoaded, isSignedIn, userId, sessionId });
  liveSession.current = { isLoaded, isSignedIn, userId, sessionId };
  const validateSession = useCallback<ValidateClerkSession>(async expected => {
    const current = liveSession.current;
    if (!current.isLoaded || !current.isSignedIn || current.userId !== expected.accountId ||
      current.sessionId !== expected.sessionId) throw new Error('Clerk session changed.');
    let token: string | null = null;
    try { token = await getToken({ skipCache: true }); } catch { /* Fail closed below. */ }
    const after = liveSession.current;
    if (!token || !after.isLoaded || !after.isSignedIn || after.userId !== expected.accountId ||
      after.sessionId !== expected.sessionId) throw new Error('Clerk session is unavailable.');
  }, [getToken]);

  if (!isLoaded) return null;
  if (!isSignedIn || !userId || !sessionId) return <Redirect to="/sign-in" />;
  const authSession = { accountId: userId, sessionId };
  return <DemoWorkspace key={userId} authSession={authSession} validateSession={validateSession} />;
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
        developmentRoutes={import.meta.env.DEV ? (
          <>
            <Route path="/fto-test-packet-preview/*?">
              <DevelopmentFtoTestPacketPreview />
            </Route>
            <Route path="/run-checklist-preview">
              <RunChecklistPreview />
            </Route>
          </>
        ) : null}
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
