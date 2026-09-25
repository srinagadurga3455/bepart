import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { NavigateFunction } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { authApi } from '../api/auth';
import type { Role, UserItem } from '../../app/types';

interface AuthState {
  loading: boolean;
  user: UserItem | null;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ loading: true, user: null });

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setState({ loading: false, user: null });
      return;
    }
    let cancelled = false;
    authApi
      .me()
      .then((res) => {
        if (!cancelled) setState({ loading: false, user: res.data });
      })
      .catch(() => {
        if (!cancelled) setState({ loading: false, user: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export function logout(navigate?: NavigateFunction): void {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  if (navigate) navigate('/login', { replace: true });
  else window.location.href = '/login';
}

interface RequireRoleProps {
  roles?: Role[];
  children: ReactNode;
}

export default function RequireRole({ roles, children }: RequireRoleProps): ReactNode {
  const location = useLocation();
  const { loading, user } = useAuth();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
