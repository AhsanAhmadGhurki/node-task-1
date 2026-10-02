// auth wale backend routes — register, login, logout, resend verification
// (refresh yahan nahi — axios.js khud karta hai, jab access token expire ho)
import api from './axios'

// POST /register — user banta hai aur verification email jaati hai
export async function register(email, password) {
  const { data } = await api.post('/register', { email, password })
  return data
}

// POST /auth/login — { token, user } lautata hai; refresh token httpOnly cookie mein aata hai (JS ko nazar nahi aata)
// unverified par 403
export async function login(email, password) {
  const { data } = await api.post('/auth/login', { email, password })
  return data
}

// POST /auth/logout — backend refresh token band karta hai aur cookie mitata hai
export async function logout() {
  await api.post('/auth/logout')
}

// POST /resend-verification — naya link (purana band); { message }
export async function resendVerification(email) {
  const { data } = await api.post('/resend-verification', { email })
  return data
}
