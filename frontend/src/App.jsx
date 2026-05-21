import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import Header from './components/layout/Header.jsx';
import Footer from './components/layout/Footer.jsx';
import ProtectedRoute from './features/auth/ProtectedRoute.jsx';

const Home = lazy(() => import('./pages/Home.jsx'));
const MapPage = lazy(() => import('./pages/Map.jsx'));

const ReportBuilder = lazy(() => import('./pages/ReportBuilder.jsx'));
const ReportViewer = lazy(() => import('./pages/ReportViewer.jsx'));
const ReportsList = lazy(() => import('./pages/ReportsList.jsx'));

const Login = lazy(() => import('./pages/Login.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'));
const ResetPassword = lazy(() => import('./pages/ResetPassword.jsx'));

const AdminLayout = lazy(() => import('./features/admin/AdminLayout.jsx'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard.jsx'));
const AdminUsers = lazy(() => import('./pages/admin/Users.jsx'));
const AdminParcels = lazy(() => import('./pages/admin/Parcels.jsx'));
const AdminAILogs = lazy(() => import('./pages/admin/AILogs.jsx'));
const AdminEmails = lazy(() => import('./pages/admin/Emails.jsx'));
const AdminSkills = lazy(() => import('./pages/admin/Skills.jsx'));
const AdminPlugins = lazy(() => import('./pages/admin/Plugins.jsx'));
const AdminDocs = lazy(() => import('./pages/admin/Docs.jsx'));
const AdminOps = lazy(() => import('./pages/admin/Ops.jsx'));

function PageLoader() {
  return (
    <div className="page-loader" role="status" aria-live="polite">
      <div className="page-loader__aurora" aria-hidden />
      <div className="page-loader__text">Loading…</div>
    </div>
  );
}

function PublicShell({ children, hideFooter = false, flush = false }) {
  return (
    <div className="app-shell">
      <Header />
      <main className={flush ? 'app-main app-main--flush' : 'app-main'}>{children}</main>
      {!hideFooter && <Footer />}
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<PublicShell><Home /></PublicShell>} />
        <Route path="/map" element={<PublicShell hideFooter flush><MapPage /></PublicShell>} />

        {/* 보고서 (로그인 필요) */}
        <Route
          path="/reports/new"
          element={
            <ProtectedRoute requiredRole="guest">
              <PublicShell><ReportBuilder /></PublicShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute requiredRole="guest">
              <PublicShell><ReportsList /></PublicShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/:id"
          element={
            <ProtectedRoute requiredRole="guest">
              <PublicShell hideFooter><ReportViewer /></PublicShell>
            </ProtectedRoute>
          }
        />

        {/* 인증 */}
        <Route path="/login" element={<PublicShell><Login /></PublicShell>} />
        <Route path="/register" element={<PublicShell><Register /></PublicShell>} />
        <Route path="/forgot-password" element={<PublicShell><ForgotPassword /></PublicShell>} />
        <Route path="/reset-password" element={<PublicShell><ResetPassword /></PublicShell>} />

        {/* 어드민 */}
        <Route
          path="/admin"
          element={<ProtectedRoute requiredRole="admin"><AdminLayout /></ProtectedRoute>}
        >
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="parcels" element={<AdminParcels />} />
          <Route path="ai-logs" element={<AdminAILogs />} />
          <Route path="emails" element={<AdminEmails />} />
          <Route path="skills" element={<AdminSkills />} />
          <Route path="plugins" element={<AdminPlugins />} />
          <Route path="docs" element={<AdminDocs />} />
          <Route path="ops" element={<AdminOps />} />
        </Route>

        <Route path="*" element={<PublicShell><Home /></PublicShell>} />
      </Routes>
    </Suspense>
  );
}
