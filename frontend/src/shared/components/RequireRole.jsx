import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { authApi } from '../api';

export function useAuth() {
  const [state, setState] = useState({ loading: true, user: null });

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

export function logout(navigate) {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  if (navigate) navigate('/login', { replace: true });
  else window.location.href = '/login';
}

export default function RequireRole({ roles, children }) {
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
