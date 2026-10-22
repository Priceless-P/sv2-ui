import { lazy, type ReactNode } from 'react';
import { Switch, Route, Redirect } from 'wouter';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { AuthProvider, AuthGuard, BrokerAuthProvider, BrokerGuard } from '@/auth';
import { ToastProvider } from '@/components/ui/toast';
import { PageBoundary } from '@/components/ui/PageBoundary';

const DashboardShell = lazy(() => import('@/components/dashboard/DashboardShell').then((m) => ({ default: m.DashboardShell })));
const DashboardHome = lazy(() => import('@/pages/dashboard/DashboardHome').then((m) => ({ default: m.DashboardHome })));
const AccountSetup = lazy(() => import('@/pages/account-setup/AccountSetup').then((m) => ({ default: m.AccountSetup })));
const WorkersPage = lazy(() => import('@/pages/workers/WorkersPage').then((m) => ({ default: m.WorkersPage })));
const SubaccountsPage = lazy(() => import('@/pages/subaccounts/SubaccountsPage').then((m) => ({ default: m.SubaccountsPage })));
const GeneratedBtcPage = lazy(() => import('@/pages/generated-btc/GeneratedBtcPage').then((m) => ({ default: m.GeneratedBtcPage })));
const PayoutsPage = lazy(() => import('@/pages/payouts/PayoutsPage').then((m) => ({ default: m.PayoutsPage })));
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const BuildYourBlockPage = lazy(() => import('@/pages/build-your-block/BuildYourBlockPage').then((m) => ({ default: m.BuildYourBlockPage })));
const JobDeclarationPage = lazy(() => import('@/pages/build-your-block/JobDeclarationPage').then((m) => ({ default: m.JobDeclarationPage })));
const PrioritizeTransactionsPage = lazy(() => import('@/pages/build-your-block/PrioritizeTransactionsPage').then((m) => ({ default: m.PrioritizeTransactionsPage })));
const MergeMiningPage = lazy(() => import('@/pages/build-your-block/MergeMiningPage').then((m) => ({ default: m.MergeMiningPage })));
const WatcherLinksPage = lazy(() => import('@/pages/watcher-links/WatcherLinksPage').then((m) => ({ default: m.WatcherLinksPage })));
const PplnsProjectionPage = lazy(() => import('@/pages/pplns-projection/PplnsProjectionPage').then((m) => ({ default: m.PplnsProjectionPage })));
const WatcherView = lazy(() => import('@/pages/watcher-links/WatcherView').then((m) => ({ default: m.WatcherView })));
const MultiwatcherView = lazy(() => import('@/pages/watcher-links/MultiwatcherView').then((m) => ({ default: m.MultiwatcherView })));
const SignIn = lazy(() => import('@/pages/auth/SignIn').then((m) => ({ default: m.SignIn })));
const SignUp = lazy(() => import('@/pages/auth/SignUp').then((m) => ({ default: m.SignUp })));
const ResetPassword = lazy(() => import('@/pages/auth/ResetPassword').then((m) => ({ default: m.ResetPassword })));
const BrokerSignIn = lazy(() => import('@/pages/auth/BrokerSignIn').then((m) => ({ default: m.BrokerSignIn })));
const WatcherSignIn = lazy(() => import('@/pages/auth/WatcherSignIn').then((m) => ({ default: m.WatcherSignIn })));
const BrokerSignUp = lazy(() => import('@/pages/auth/BrokerSignUp').then((m) => ({ default: m.BrokerSignUp })));
const BrokerHome = lazy(() => import('@/pages/broker/BrokerHome').then((m) => ({ default: m.BrokerHome })));
const BrokerSettings = lazy(() => import('@/pages/broker/BrokerSettings').then((m) => ({ default: m.BrokerSettings })));

function DashboardRoute({ children }: { children: ReactNode }) {
  return <DashboardShell><PageBoundary>{children}</PageBoundary></DashboardShell>;
}

/**
 * The authenticated area, reached only after sign-in (AuthGuard).
 */
function AppRoutes() {
  return (
    <Switch>
      <Route path="/home">
        <DashboardRoute>
          <DashboardHome />
        </DashboardRoute>
      </Route>
      <Route path="/workers">
        <DashboardRoute>
          <WorkersPage />
        </DashboardRoute>
      </Route>
      <Route path="/subaccounts">
        <DashboardRoute>
          <SubaccountsPage />
        </DashboardRoute>
      </Route>
      <Route path="/payouts">
        <DashboardRoute>
          <PayoutsPage />
        </DashboardRoute>
      </Route>
      <Route path="/generated-bitcoin">
        <DashboardRoute>
          <GeneratedBtcPage />
        </DashboardRoute>
      </Route>
      <Route path="/pplns-projection">
        <DashboardRoute>
          <PplnsProjectionPage />
        </DashboardRoute>
      </Route>
      <Route path="/watcher-links">
        <DashboardRoute>
          <WatcherLinksPage />
        </DashboardRoute>
      </Route>
      <Route path="/account">
        <DashboardRoute>
          <SettingsPage />
        </DashboardRoute>
      </Route>
      <Route path="/help">
        <DashboardRoute>
          <SettingsPage />
        </DashboardRoute>
      </Route>
      <Route path="/build-your-block">
        <DashboardRoute>
          <BuildYourBlockPage />
        </DashboardRoute>
      </Route>
      <Route path="/build-your-block/job-declaration/:section?">
        <DashboardRoute>
          <JobDeclarationPage />
        </DashboardRoute>
      </Route>
      <Route path="/build-your-block/merge-mining/:section?">
        <DashboardRoute>
          <MergeMiningPage />
        </DashboardRoute>
      </Route>
      <Route path="/build-your-block/prioritize-transactions/:section?">
        <DashboardRoute>
          <PrioritizeTransactionsPage />
        </DashboardRoute>
      </Route>
      {/* Full-screen account-setup flow, reached from the home prompt. */}
      <Route path="/account-setup">
        <AccountSetup />
      </Route>
      {/* The dashboard is the authenticated landing page. */}
      <Route path="/">
        <Redirect to="/home" replace />
      </Route>
      {/* Unknown authenticated routes return to the dashboard. */}
      <Route>
        <Redirect to="/home" replace />
      </Route>
    </Switch>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/signin">
        <SignIn />
      </Route>
      <Route path="/signup">
        <SignUp />
      </Route>
      {/* Both enter the one continuous recovery flow (email -> token -> ...). */}
      <Route path="/forgot-password">
        <ResetPassword />
      </Route>
      <Route path="/reset-password">
        <ResetPassword />
      </Route>
      <Route path="/broker/signin">
        <BrokerSignIn />
      </Route>
      <Route path="/watcher/signin">
        <WatcherSignIn />
      </Route>
      <Route path="/broker/signup">
        <BrokerSignUp />
      </Route>
      <Route path="/broker/settings">
        <BrokerGuard>
          <BrokerSettings />
        </BrokerGuard>
      </Route>
      <Route path="/broker">
        <BrokerGuard>
          <BrokerHome />
        </BrokerGuard>
      </Route>
      {/* Everything else requires a signed-in miner */}
      <Route>
        <AuthGuard>
          <AppRoutes />
        </AuthGuard>
      </Route>
    </Switch>
  );
}

/** Check this boundary on every route entry, including navigation from an embedded watcher. */
function PrivateApplication() {
  if (window.self !== window.top) {
    return <p>Open the dashboard directly to manage your account.</p>;
  }
  return (
    <AuthProvider>
      <BrokerAuthProvider>
        <PageBoundary><Router /></PageBoundary>
      </BrokerAuthProvider>
    </AuthProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <PageBoundary>
          <Switch>
            <Route path="/login/watcher/:userId/:token">
              {(params) => <WatcherView userId={params.userId} token={params.token} />}
            </Route>
            <Route path="/login/multiwatcher/*">
              {(params) => <MultiwatcherView rest={params['*'] ?? ''} />}
            </Route>
            <Route>
              <PrivateApplication />
            </Route>
          </Switch>
        </PageBoundary>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;
