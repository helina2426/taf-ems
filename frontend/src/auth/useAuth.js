// Any component can call useAuth() to get: user, login(), logout(), changePassword(), refreshUser().
import { useContext } from 'react';
import { AuthContext } from './authContextObject.js';

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}
