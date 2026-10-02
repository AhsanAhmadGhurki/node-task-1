// ek hi axios instance — saari API calls isi se, taake base URL, token aur refresh ek jagah hon
import axios from 'axios'
import { isTokenExpired, loadSession, saveSession } from '../utils/helpers'

// "/api" Vite proxy ke zariye backend tak jaata hai — proxy hi x-api-key lagata hai (browser tak kabhi nahi aati)
const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// AuthContext yahan apne functions de deta hai (axios React ke bahar hai — context seedha use nahi kar sakta)
// onRefreshed — naya token aaya, context ki state bhi update karo
// onUnauthorized — refresh bhi fail, session khatam: logout
let handlers = { onRefreshed: () => {}, onUnauthorized: () => {} }

export function setAuthHandlers(newHandlers) {
  handlers = newHandlers
}

// refresh ek waqt mein sirf EK — 3 requests ek saath 401 dein to 3 refresh nahi, sab isi ek ka intezar karein
// (warna pehla refresh token rotate kar deta aur baaki do purana token bhej kar fail hote)
let refreshPromise = null

function refreshAccessToken() {
  if (!refreshPromise) {
    // seedha axios — "api" instance nahi, warna interceptors refresh ko phir refresh karne lagte
    // refresh token httpOnly cookie mein hai, browser khud bhejta hai
    refreshPromise = axios
      .post('/api/auth/refresh')
      .then(({ data }) => {
        saveSession({ token: data.token, user: data.user })
        handlers.onRefreshed(data)
        return data.token
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

// /auth/... (login, logout) par token ya refresh ki zaroorat nahi
const isAuthRoute = (url = '') => url.startsWith('/auth/')

// har request se pehle — token lagao; expire ho chuka ho to pehle chupke se naya lo (401 ka intezar kyun)
// token seedha localStorage se — context ke effect ka intezar nahi (Dashboard ki pehli request bhi token ke saath jaye)
api.interceptors.request.use(async (config) => {
  let token = loadSession()?.token
  if (!token || isAuthRoute(config.url)) {
    return config
  }

  if (isTokenExpired(token)) {
    try {
      token = await refreshAccessToken()
    } catch (error) {
      // refresh token bhi expire/band — dobara login ke siwa koi rasta nahi
      handlers.onUnauthorized()
      throw error
    }
  }

  config.headers.Authorization = `Bearer ${token}`
  return config
})

// token ke saath gayi request par 401 (expire ya server ne qubool nahi kiya) — ek dafa refresh karke dobara try
// (login par 401 ka matlab galat password hai, wahan token hota hi nahi, isliye refresh nahi)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config
    const sentWithToken = Boolean(config?.headers?.Authorization)

    if (error.response?.status !== 401 || !sentWithToken || config._retried) {
      return Promise.reject(error)
    }

    // _retried — naye token par bhi 401 aaye to loop nahi, seedha logout
    config._retried = true
    try {
      const token = await refreshAccessToken()
      config.headers.Authorization = `Bearer ${token}`
      return api(config)
    } catch {
      handlers.onUnauthorized()
      return Promise.reject(error)
    }
  },
)

export default api
