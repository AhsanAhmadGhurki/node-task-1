// routes yahan — kaunsa URL kaunsa page (backend ke app.js jaisa)
import { Navigate, Route, Routes } from 'react-router'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import Profile from './pages/Profile'
import Register from './pages/Register'
import Tickets from './pages/Tickets'
import Workspace from './pages/Workspace'

export default function App() {
  return (
    <>
      <Navbar />
      {/* sab pages ki ek hi chaudai (navbar jaisi) — tab badalne par logo, title aur content ka baayan kinara nahi hilta */}
      <main className="mx-auto w-full max-w-4xl px-4 pt-8 pb-16 sm:px-6">
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
          {/* orgs + roles (abhi mock data) — section: tasks / tickets / members; ghalat section par Workspace khud /tasks bhejta hai */}
          <Route path="/workspace" element={<Navigate to="/workspace/tasks" replace />} />
          <Route
            path="/workspace/:section"
            element={
              <ProtectedRoute>
                <Workspace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </>
  )
}
