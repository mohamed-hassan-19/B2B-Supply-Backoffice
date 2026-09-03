import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Package, Users, ShoppingCart, FileText, Receipt, BarChart, LogOut, Settings, AlertTriangle } from 'lucide-react';

export default function DashboardLayout() {
  const { role, email, logout } = useAuth();
  const location = useLocation();

  const allRoles = ['super_admin', 'sales', 'warehouse', 'finance', 'content', 'operator'];

  const links = [
    { to: '/products', label: 'Products', icon: <Package className="w-5 h-5 mr-3" />, roles: allRoles },
    { to: '/clients', label: 'Clients', icon: <Users className="w-5 h-5 mr-3" />, roles: allRoles },
    { to: '/orders', label: 'Orders', icon: <ShoppingCart className="w-5 h-5 mr-3" />, roles: allRoles },
    { to: '/quotes', label: 'Quotes', icon: <FileText className="w-5 h-5 mr-3" />, roles: allRoles },
    { to: '/invoices', label: 'Invoices', icon: <Receipt className="w-5 h-5 mr-3" />, roles: allRoles },
    { to: '/incidents', label: 'Incidents', icon: <AlertTriangle className="w-5 h-5 mr-3" />, roles: allRoles },
    { to: '/analytics', label: 'Analytics', icon: <BarChart className="w-5 h-5 mr-3" />, roles: ['super_admin', 'finance'] },
    { to: '/admin-users', label: 'Admin Users', icon: <Settings className="w-5 h-5 mr-3" />, roles: ['super_admin'] },
  ];

  const visibleLinks = links.filter(link => role && link.roles.includes(role));

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="h-16 flex items-center px-6 text-xl font-bold border-b border-gray-800">
          B2B Portal
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-1 px-2">
            {visibleLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center px-4 py-3 rounded-md transition-colors ${
                  location.pathname.startsWith(link.to) 
                    ? 'bg-gray-800 text-white font-medium' 
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                {link.icon}
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="p-4 border-t border-gray-800">
          <div className="text-sm truncate text-gray-400 mb-4 px-2">
            {email}<br />
            <span className="text-xs uppercase bg-gray-700 text-gray-200 px-2 py-1 rounded mt-1 inline-block">
              {role}
            </span>
          </div>
          <button
            onClick={() => {
              logout();
              window.location.href = '/login';
            }}
            className="flex w-full items-center px-4 py-2 text-gray-300 hover:bg-gray-800 rounded-md transition-colors"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6 shadow-sm z-10">
          <h1 className="text-xl font-semibold text-gray-800 capitalize">
            {location.pathname.split('/')[1] || 'Dashboard'}
          </h1>
        </header>
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
