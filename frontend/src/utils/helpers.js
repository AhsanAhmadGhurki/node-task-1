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

// expire ho chuka token wapas na lao — warna "Logged in" dikhega aur har request 401
export function loadSession() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY))
    if (!session || isTokenExpired(session.token)) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return session
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
