// ek hi axios instance — saari API calls isi se, taake base URL aur token ek jagah lagein
import axios from 'axios'
import { loadSession } from '../utils/helpers'

// "/api" Vite proxy ke zariye backend tak jaata hai — proxy hi x-api-key lagata hai (browser tak kabhi nahi aati)
const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// AuthContext yahan "session khatam" wala function de deta hai
// (axios React ke bahar hai — isliye context seedha use nahi kar sakta)
let onUnauthorized = () => {}

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

// har request se pehle — token ho to Authorization header lagao
// token seedha localStorage se — context ke effect ka intezar nahi (Dashboard ki pehli request bhi token ke saath jaye)
api.interceptors.request.use((config) => {
  const token = loadSession()?.token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// token ke saath gayi request par 401 = token expire/invalid — logout karao
// (login par 401 ka matlab galat password hai, wahan token hota hi nahi, isliye logout nahi)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && error.config?.headers?.Authorization) {
      onUnauthorized()
    }
    return Promise.reject(error)
  },
)

export default api
