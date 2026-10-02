// auth wale backend routes — register, login, resend verification
import api from './axios'

// POST /register — user banta hai aur verification email jaati hai
export async function register(email, password) {
  const { data } = await api.post('/register', { email, password })
  return data
}

// POST /auth/login — { token, user } lautata hai (unverified par 403)
export async function login(email, password) {
  const { data } = await api.post('/auth/login', { email, password })
  return data
}

// POST /resend-verification — naya link (purana band); { message }
export async function resendVerification(email) {
  const { data } = await api.post('/resend-verification', { email })
  return data
}
