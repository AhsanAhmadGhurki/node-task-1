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

// avatar — backend (config/upload.js) jaise hi rules aur messages; galat file par request hi na jaye
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024

export function avatarFileError(file) {
  if (!AVATAR_TYPES.includes(file.type)) return 'Avatar must be a JPEG, PNG or WebP image.'
  if (file.size > MAX_AVATAR_BYTES) return 'Avatar file is too large. Maximum size is 2 MB.'
  return null
}

// ticket attachments — backend (config/ticketUpload.js + ticketService) jaise hi rules aur messages
// galat selection par request hi na jaye; asal faisla (magic bytes samet) phir bhi backend karta hai
export const ATTACHMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
export const MAX_ATTACHMENTS = 3
export const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024
export const MAX_TOTAL_ATTACHMENT_BYTES = 5 * 1024 * 1024
// ticket description ki had — backend validateCreateTicket jaisi (trim ke baad 5000)
export const MAX_DESCRIPTION_LENGTH = 5000

export function attachmentFilesError(files) {
  if (files.length > MAX_ATTACHMENTS) return `You can attach at most ${MAX_ATTACHMENTS} files.`
  if (files.some((file) => !ATTACHMENT_TYPES.includes(file.type))) return 'Attachments must be JPEG, PNG, WebP or PDF files.'
  if (files.some((file) => file.size > MAX_ATTACHMENT_BYTES)) return 'Each attachment must be at most 2 MB.'
  const total = files.reduce((sum, file) => sum + file.size, 0)
  if (total > MAX_TOTAL_ATTACHMENT_BYTES) return 'All attachments combined must be at most 5 MB.'
  return null
}

// 1536 → "1.5 KB" — file ki size dikhane ke liye
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
