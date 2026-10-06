// chhote helper functions — kisi ek component se bandhe hue nahi

// JWT ke beech wale hisse (payload) mein exp hota hai — seconds mein
export function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload.exp * 1000 < Date.now()
  } catch {
    // token parh hi na sakein to bhi expired maano
    return true
  }
}

// session (token + user) localStorage mein — refresh ke baad bhi login rahe
const SESSION_KEY = 'session'

// access token expire ho chuka ho to bhi session rakho — axios refresh token (cookie) se naya le aata hai
// refresh bhi fail ho tab hi logout (axios.js → AuthContext)
export function loadSession() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY))
    return session?.token ? session : null
  } catch {
    return null
  }
}

export function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

// axios error se user ko dikhane layak { status, text } — backend hamesha { message } bhejta hai
export function toAlert(error) {
  if (error.response) {
    return { ok: false, status: error.response.status, text: error.response.data?.message || 'Unknown error' }
  }
  // response hi nahi aaya — backend band ya proxy na pahunch saka
  return { ok: false, status: 0, text: 'Backend se connect nahi ho saka — kya backend chal raha hai?' }
}

// naye password ke rules — backend (middleware/validation.js newPasswordError) jaise hi, wahi messages
// submit se pehle check — galat password par request hi na jaye; asal faisla phir bhi backend karta hai
export const PASSWORD_RULES_HINT = '8+ characters, kam se kam ek letter aur ek number, aage/peeche space nahi'

export function passwordRuleError(password) {
  if (password.length < 8) return 'Password must be at least 8 characters'
  // bcrypt 72 bytes ke baad ka hissa nahi padhta — backend bhi isi par rokta hai
  if (new TextEncoder().encode(password).length > 72) return 'Password must be at most 72 bytes'
  if (password !== password.trim()) return 'Password must not start or end with a space'
  if (!/\p{L}/u.test(password)) return 'Password must contain at least one letter'
  if (!/\d/.test(password)) return 'Password must contain at least one number'
  return null
}

// task title ki had — backend ki tarah trim ke baad 200 (middleware/validation.js titleError)
// naya task (TaskForm) aur edit (TaskItem) dono yahi istemal karte hain
export const MAX_TITLE_LENGTH = 200
