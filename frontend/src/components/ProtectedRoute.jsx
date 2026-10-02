// login ke baghair access block — token na ho to /login par bhej do
import { Navigate } from 'react-router'
import { useAuth } from '../hooks/useAuth'

export default function ProtectedRoute({ children }) {
  const { token } = useAuth()

  // replace — "back" dabane par dobara protected page par na aaye
  if (!token) {
    return <Navigate to="/login" replace />
  }

  return children
}
