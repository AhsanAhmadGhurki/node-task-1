// upar ki patti — app ka naam, aur login ho to user ka email + logout
import { Link } from 'react-router'
import { useAuth } from '../hooks/useAuth'

export default function Navbar() {
  const { user, logout } = useAuth()

  return (
    <nav className="navbar">
      <Link to="/" className="brand">Tasks API</Link>
      {user && (
        <div className="navbar-user">
          <span className="muted">{user.email}</span>
          <button className="secondary small" onClick={() => logout()}>Logout</button>
        </div>
      )}
    </nav>
  )
}
