import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import Login from './components/Login';
import Signup from './components/Signup';
import AdminDashboard from './components/AdminDashboard';
import OperatorDashboard from './components/OperatorDashboard';
import TraceabilityDashboard from './components/TraceabilityDashboard';
import './App.css';

// Updated helper to universally extract the role
const getUserRole = (token) => {
  try {
    const decoded = jwtDecode(token);
    
    // Check if the backend agent stored it as a string
    if (decoded.role) return decoded.role;
    
    // Check if the backend agent stored it as a boolean flag
    if (decoded.system_admin) return 'system_admin';
    if (decoded.supply_chain_operator) return 'supply_chain_operator';
    if (decoded.authorized_traceability_user) return 'authorized_traceability_user';
    
    return null;
  } catch (err) {
    return null;
  }
};

// Security Wrapper: Checks authentication AND authorization
const RoleProtectedRoute = ({ children, requiredRole }) => {
  const token = sessionStorage.getItem('accessToken');
  if (!token) return <Navigate to="/" />;

  const userRole = getUserRole(token);
  if (userRole !== requiredRole) {
    alert(`Access Denied: Requires ${requiredRole} privileges.`);
    return <Navigate to="/" />;
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
            <RoleProtectedRoute requiredRole="system_admin">
              <AdminDashboard />
            </RoleProtectedRoute>
          } 
        />

        <Route 
          path="/operator" 
          element={
            <RoleProtectedRoute requiredRole="supply_chain_operator">
              <OperatorDashboard />
            </RoleProtectedRoute>
          } 
        />

        <Route 
          path="/traceability" 
          element={
            <RoleProtectedRoute requiredRole="authorized_traceability_user">
              <TraceabilityDashboard />
            </RoleProtectedRoute>
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;