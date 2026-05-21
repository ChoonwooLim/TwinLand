import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import Header from './components/layout/Header.jsx';
import Footer from './components/layout/Footer.jsx';
import ProtectedRoute from './features/auth/ProtectedRoute.jsx';

const Home = lazy(() => import('./pages/Home.jsx'));
const Vision = lazy(() => import('./pages/Vision.jsx'));
const ThemePark = lazy(() => import('./pages/ThemePark.jsx'));
const DigitalClone = lazy(() => import('./pages/DigitalClone.jsx'));
const MapPage = lazy(() => import('./pages/Map.jsx'));
const Demo = lazy(() => import('./pages/Demo.jsx'));
const Investment = lazy(() => import('./pages/Investment.jsx'));
const DataRoom = lazy(() => import('./pages/DataRoom.jsx'));
const Contact = lazy(() => import('./pages/Contact.jsx'));

const Login = lazy(() => import('./pages/Login.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'));
const ResetPassword = lazy(() => import('./pages/ResetPassword.jsx'));
const Upgrade = lazy(() => import('./pages/Upgrade.jsx'));

const AdminLayout = lazy(() => import('./features/admin/AdminLayout.jsx'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard.jsx'));
const AdminUsers = lazy(() => import('./pages/admin/Users.jsx'));
const AdminUpgrades = lazy(() => import('./pages/admin/Upgrades.jsx'));
const AdminLeads = lazy(() => import('./pages/admin/Leads.jsx'));
const AdminDataRoom = lazy(() => import('./pages/admin/DataRoom.jsx'));
const AdminContent = lazy(() => import('./pages/admin/Content.jsx'));
const AdminParcels = lazy(() => import('./pages/admin/Parcels.jsx'));
const AdminAILogs = lazy(() => import('./pages/admin/AILogs.jsx'));
const AdminEmails = lazy(() => import('./pages/admin/Emails.jsx'));
const AdminClones = lazy(() => import('./pages/admin/Clones.jsx'));
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
        <Route path="/vision" element={<PublicShell><Vision /></PublicShell>} />
        <Route path="/themepark" element={<PublicShell><ThemePark /></PublicShell>} />
        <Route path="/clone" element={<PublicShell><DigitalClone /></PublicShell>} />
        <Route path="/map" element={<PublicShell hideFooter flush><MapPage /></PublicShell>} />
        <Route path="/demo" element={<PublicShell><Demo /></PublicShell>} />
        <Route path="/investment" element={<PublicShell><Investment /></PublicShell>} />
        <Route path="/contact" element={<PublicShell><Contact /></PublicShell>} />

        <Route
          path="/dataroom"
          element={
            <ProtectedRoute requiredRole="investor">
              <PublicShell><DataRoom /></PublicShell>
            </ProtectedRoute>
          }
        />

        <Route path="/login" element={<PublicShell><Login /></PublicShell>} />
        <Route path="/register" element={<PublicShell><Register /></PublicShell>} />
        <Route path="/forgot-password" element={<PublicShell><ForgotPassword /></PublicShell>} />
        <Route path="/reset-password" element={<PublicShell><ResetPassword /></PublicShell>} />
        <Route
          path="/upgrade"
          element={
            <ProtectedRoute requiredRole="guest">
              <PublicShell><Upgrade /></PublicShell>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={<ProtectedRoute requiredRole="admin"><AdminLayout /></ProtectedRoute>}
        >
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="upgrades" element={<AdminUpgrades />} />
          <Route path="leads" element={<AdminLeads />} />
          <Route path="dataroom" element={<AdminDataRoom />} />
          <Route path="content" element={<AdminContent />} />
          <Route path="parcels" element={<AdminParcels />} />
          <Route path="ai-logs" element={<AdminAILogs />} />
          <Route path="emails" element={<AdminEmails />} />
          <Route path="clones" element={<AdminClones />} />
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
