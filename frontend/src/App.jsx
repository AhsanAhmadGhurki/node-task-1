// routes yahan — kaunsa URL kaunsa page (backend ke app.js jaisa)
import { Navigate, Route, Routes } from 'react-router'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import Register from './pages/Register'
import Tickets from './pages/Tickets'

export default function App() {
  return (
    <>
      <Navbar />
      {/* har page apni chaudai khud rakhta hai (auth: split card, dashboard: patli, tickets: chaudi) */}
      <main className="px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
        <Routes>
          {/* "/" par seedha dashboard — login na ho to ProtectedRoute /login bhej dega */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tickets"
            element={
              <ProtectedRoute>
                <Tickets />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </>
  )
}
