import React from 'react';
import { Redirect, type Href } from 'expo-router';

import { useAuth } from '@/hooks/useAuth';

interface RequireAuthProps {
  children: React.ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const { session, loading } = useAuth();

  if (loading) {
    // Let the root splash / existing loading handle visuals
    return null;
  }

  if (!session) {
    return <Redirect href={'/auth' as Href} />;
  }

  return <>{children}</>;
}

export default RequireAuth;
