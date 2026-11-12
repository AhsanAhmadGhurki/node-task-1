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
import AcceptInvitation from './pages/AcceptInvitation'

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
          {/* orgs + roles (asli API) — /workspace pehli org par le jaata hai; section: members / invitations / settings */}
          {["/workspace", "/workspace/:orgId", "/workspace/:orgId/:section"].map((path) => (
            <Route
              key={path}
              path={path}
              element={
                <ProtectedRoute>
                  <Workspace />
                </ProtectedRoute>
              }
            />
          ))}
          {/* email ke invite link — login ke bina bhi khulta hai (page khud login/register par bhejta hai) */}
          <Route path="/invitations/:token" element={<AcceptInvitation />} />
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
