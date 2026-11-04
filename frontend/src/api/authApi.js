// auth wale backend routes — register + email verify code, login, logout
// (refresh yahan nahi — axios.js khud karta hai, jab access token expire ho)
import api from './axios'

// saare auth routes backend par /auth/* — axios.js /auth/ wali requests par token/refresh nahi lagata

// POST /auth/register — naya user (201, user object) ya pehle se unverified (200, { message }); dono mein code jaata hai
// status bhi lautao — page ko pata ho ke "Account created" kehna hai ya generic paigham
export async function register(email, password) {
  const { status, data } = await api.post('/auth/register', { email, password })
  return { created: status === 201, data }
}

// POST /auth/login/request-otp — 2FA ka pehla qadam: email + password sahi hon to email par login code
// { message, expiresInSeconds }; 401 ghalat, 403 unverified, 423 lock, 429 { retryAfter } (ghante mein 3 codes)
export async function requestLoginOtp(email, password) {
  const { data } = await api.post('/auth/login/request-otp', { email, password })
  return data
}

// POST /auth/login/verify-otp — email + 6-digit code; sahi ho to { message, token, user } + refresh cookie (login jaisa)
export async function verifyLoginOtp(email, otp) {
  const { data } = await api.post('/auth/login/verify-otp', { email, otp })
  return data
}

// POST /auth/logout — backend refresh token band karta hai aur cookie mitata hai
export async function logout() {
  await api.post('/auth/logout')
}

// POST /auth/verify-email — register ke baad email wala 6-digit code + password; galat/expire code par 400
// sahi ho to login bhi: { message, token, user } — refresh token httpOnly cookie mein (login jaisa)
// password verify ke waqt hi account par lagta hai — code wala (email ka asli malik) hi aakhri password chunta hai
export async function verifyEmail(email, otp, password) {
  const { data } = await api.post('/auth/verify-email', { email, otp, password })
  return data
}

// POST /auth/resend-verification — naya code (purana band); { message } hamesha ek hi (account ho ya na ho)
export async function resendVerification(email) {
  const { data } = await api.post('/auth/resend-verification', { email })
  return data
}
