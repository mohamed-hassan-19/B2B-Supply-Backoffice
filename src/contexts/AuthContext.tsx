import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';

export type Role = 'super_admin' | 'sales' | 'warehouse' | 'finance' | 'content' | 'operator';

interface JwtPayload {
  email: string;
  role: Role;
  sub: number;
  exp: number;
}

interface AuthContextType {
  token: string | null;
  role: Role | null;
  email: string | null;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('admin_token'));
  const [role, setRole] = useState<Role | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      try {
        const decoded = jwtDecode<JwtPayload>(token);
        // Simple check if expired
        if (decoded.exp * 1000 < Date.now()) {
          logout();
        } else {
          setRole(decoded.role);
          setEmail(decoded.email);
          localStorage.setItem('admin_token', token);
        }
      } catch (e) {
        logout();
      }
    } else {
      setRole(null);
      setEmail(null);
      localStorage.removeItem('admin_token');
    }
  }, [token]);

  const login = (newToken: string) => {
    setToken(newToken);
  };

  const logout = () => {
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ token, role, email, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
