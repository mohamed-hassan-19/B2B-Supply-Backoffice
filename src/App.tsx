import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import DashboardLayout from './components/DashboardLayout';
import ProductsPage from './pages/Products';
import ClientsPage from './pages/Clients';
import OrdersPage from './pages/Orders';
import QuotesPage from './pages/Quotes';
import InvoicesPage from './pages/Invoices';
import AnalyticsPage from './pages/Analytics';
import IncidentsPage from './pages/Incidents';
import AdminUsersPage from './pages/AdminUsers';

function ProtectedRoute({ allowedRoles }: { allowedRoles?: string[] }) {
  const { token, role } = useAuth();
  
  if (!token) return <Navigate to="/login" replace />;
  
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />; // or to a 403 page
  }
  
  return <Outlet />;
}

function AppContent() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<Navigate to="/products" replace />} />
          
          <Route element={<ProtectedRoute allowedRoles={['super_admin', 'sales', 'warehouse']} />}>
            <Route path="/products" element={<ProductsPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['super_admin', 'sales', 'finance']} />}>
            <Route path="/clients" element={<ClientsPage />} />
          </Route>

          {/* All authenticated users can access orders */}
          <Route path="/orders" element={<OrdersPage />} />

          <Route element={<ProtectedRoute allowedRoles={['super_admin', 'sales']} />}>
            <Route path="/quotes" element={<QuotesPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['super_admin', 'finance']} />}>
            <Route path="/invoices" element={<InvoicesPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/incidents" element={<IncidentsPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['super_admin', 'finance']} />}>
            <Route path="/analytics" element={<AnalyticsPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['super_admin']} />}>
            <Route path="/admin-users" element={<AdminUsersPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
