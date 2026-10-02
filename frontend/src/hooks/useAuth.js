// AuthContext tak pahunchne ka chhota rasta — useContext(AuthContext) baar baar likhna na pade
import { createContext, useContext } from 'react'

// context ka object yahan, provider context/AuthContext.jsx mein
// (ek file mein dono hon to Vite ka fast refresh kaam nahi karta)
export const AuthContext = createContext(null)

export function useAuth() {
  const context = useContext(AuthContext)
  // AuthProvider ke bahar use hua to foran saaf error — undefined se ajeeb crash nahi
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return context
}
