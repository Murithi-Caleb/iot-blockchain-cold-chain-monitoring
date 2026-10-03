import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Login from './components/Login';
import Signup from './components/Signup';
import AdminDashboard from './components/AdminDashboard';
import OperatorDashboard from './components/OperatorDashboard';
import TraceabilityDashboard from './components/TraceabilityDashboard';
import { getStoredToken, getUserRole, isTokenExpired, ROLES, ROLE_LABELS } from './lib/auth';
import './App.css';

// Security wrapper: checks authentication AND authorization on the client.
// This only controls what the UI shows. Every API call is independently authorized
// by the backend (requireSystemAdmin / requireOperator / requireBatchViewer).
//
// Pass `requiredRole` for a single role, or `allowedRoles` for several.
const RoleProtectedRoute = ({ children, requiredRole, allowedRoles }) => {
  const location = useLocation();
  const token = getStoredToken();

  if (!token) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  if (isTokenExpired(token)) {
    return (
      <Navigate
        to="/"
        replace
        state={{ from: location, notice: 'Your session has expired. Please sign in again.' }}
      />
    );
  }

  const permitted = allowedRoles || [requiredRole];
  const userRole = getUserRole(token);
  if (!permitted.includes(userRole)) {
    const needed = permitted.map((role) => ROLE_LABELS[role] || role).join(' or ');
    return <Navigate to="/" replace state={{ notice: `Access denied: this area requires ${needed} privileges.` }} />;
  }

  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        <Route
          path="/admin"
          element={
            <RoleProtectedRoute requiredRole={ROLES.ADMIN}>
              <AdminDashboard />
            </RoleProtectedRoute>
          }
        />

        <Route
          path="/operator"
          element={
            <RoleProtectedRoute requiredRole={ROLES.OPERATOR}>
              <OperatorDashboard />
            </RoleProtectedRoute>
          }
        />

        <Route
          path="/traceability"
          element={
            <RoleProtectedRoute requiredRole={ROLES.TRACEABILITY}>
              <TraceabilityDashboard />
            </RoleProtectedRoute>
          }
        />

        {/* Target of the QR codes printed on batch labels. Any signed-in application
            role may look up a batch; unauthenticated visitors are sent to login first
            and returned here afterwards. */}
        <Route
          path="/trace/:batchId"
          element={
            <RoleProtectedRoute allowedRoles={Object.values(ROLES)}>
              <TraceabilityDashboard />
            </RoleProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
