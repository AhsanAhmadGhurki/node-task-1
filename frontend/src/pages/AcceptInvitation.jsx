// /invitations/:token — email ka link yahan khulta hai (login ke bina bhi)
// pehle link ki jaanch (GET), phir: login nahi → login/register (wapas yahin aayenge); login hai → Accept
// email match, expire, pehle accept — sab backend batata hai (403/410/409/404)
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { acceptInvitation, getInvitation } from '../api/orgApi'
import Alert from '../components/Alert'
import AuthLayout from '../components/AuthLayout'
import Loader from '../components/Loader'
import { useAuth } from '../hooks/useAuth'
import { badge, button, link } from '../ui/styles'
import { toAlert } from '../utils/helpers'

export default function AcceptInvitation() {
  const { token: inviteToken } = useParams()
  const { token, user, logout } = useAuth()
  const navigate = useNavigate()
  const [invitation, setInvitation] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [alert, setAlert] = useState(null)
  const [busy, setBusy] = useState(false)
  const next = encodeURIComponent(`/invitations/${inviteToken}`)

  useEffect(() => {
    let cancelled = false
    getInvitation(inviteToken)
      .then((data) => {
        if (!cancelled) setInvitation(data.invitation)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(toAlert(err))
      })
    return () => {
      cancelled = true
    }
  }, [inviteToken])

  async function handleAccept() {
    setBusy(true)
    setAlert(null)
    try {
      const data = await acceptInvitation(inviteToken)
      navigate(`/workspace/${data.org._id}/members`, { replace: true })
    } catch (err) {
      setAlert(toAlert(err))
      setBusy(false)
    }
  }

  if (loadError) {
    return (
      <AuthLayout heading="Invite nahi chal raha" description="Yeh link ab kaam nahi karta." footer={<Link to="/workspace" className={link}>Workspaces par jayein</Link>}>
        <Alert alert={loadError} />
      </AuthLayout>
    )
  }

  if (!invitation) {
    return (
      <AuthLayout heading="Invite" description="Link check ho raha hai…">
        <Loader text="Invite load ho raha hai…" rows={2} />
      </AuthLayout>
    )
  }

  const wrongAccount = user && user.email !== invitation.email

  return (
    <AuthLayout
      heading={`${invitation.org.name} join karein`}
      description={invitation.invitedBy ? `${invitation.invitedBy} ne aap ko is org mein bulaya hai.` : 'Aap ko is org mein bulaya gaya hai.'}
    >
      <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted">Role</dt>
          <dd>
            <span className={badge}>{invitation.role}</span>
          </dd>
          <dt className="text-muted">Email</dt>
          <dd className="break-all">{invitation.email}</dd>
          <dt className="text-muted">Expire</dt>
          <dd>{new Date(invitation.expiresAt).toLocaleString()}</dd>
        </dl>

        {alert && <Alert alert={alert} />}

        {token ? (
          <>
            {wrongAccount && (
              <p className="text-small text-muted">
                Aap <strong>{user.email}</strong> se login hain — yeh invite <strong>{invitation.email}</strong> ke liye hai. Us account se login karein.
              </p>
            )}
            <button type="button" className={button({ weight: 'semibold' })} onClick={handleAccept} disabled={busy}>
              Accept karein
            </button>
            {wrongAccount && (
              <button type="button" className={button({ variant: 'secondary' })} onClick={() => logout()}>
                Logout kar ke doosre account se
              </button>
            )}
          </>
        ) : (
          <>
            <p className="text-small text-muted">Accept karne ke liye {invitation.email} se login karein (ya account banayein). Uske baad aap wapas yahin aayenge.</p>
            <Link to={`/login?next=${next}`} className={button({ weight: 'semibold' })}>
              Login
            </Link>
            <Link to={`/register?next=${next}`} className={button({ variant: 'secondary' })}>
              Account banayein
            </Link>
          </>
        )}
      </div>
    </AuthLayout>
  )
}
