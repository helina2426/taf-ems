// The shared "box" that holds the login state. AuthProvider fills it; useAuth() reads it.
import { createContext } from 'react';

export const AuthContext = createContext(null);
