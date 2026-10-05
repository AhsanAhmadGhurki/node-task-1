// routes yahan — kaunsa URL kaunsa page (backend ke app.js jaisa)
import { Navigate, Route, Routes } from 'react-router'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import Register from './pages/Register'

export default function App() {
  return (
    <>
      <Navbar />
      {/* 57px = navbar ki unchai — card upar se thoda neeche, beech mein */}
      <main className="flex min-h-[calc(100vh-57px)] items-start justify-center px-4 py-10">
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
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </>
  )
}
