// /workspace aur /workspace/:orgId/:section — meri asli orgs (backend), sidebar se org badlo, Members / Invitations / Settings
// role har org ka apna (GET /orgs se); koi mock data nahi
import { useCallback, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import EmptyState from '../components/EmptyState'
import Loader from '../components/Loader'
import OrgInvitations from '../components/OrgInvitations'
import OrgMembers from '../components/OrgMembers'
import OrgSettings from '../components/OrgSettings'
import Toast from '../components/Toast'
import WorkspaceSidebar from '../components/WorkspaceSidebar'
import { WorkspaceProvider } from '../context/WorkspaceContext'
import { useWorkspace } from '../hooks/useWorkspace'
import { BuildingIcon } from '../ui/icons'
import { badge, cn, link, pageHeader, pageTitle, panel, subtitle } from '../ui/styles'
import { ROLE_INFO } from '../workspace/permissions'

const SECTIONS = { members: 'Members', invitations: 'Invitations', settings: 'Settings' }
const SECTION_VIEWS = { members: OrgMembers, invitations: OrgInvitations, settings: OrgSettings }

// kamyabi ka toast khud jaye; galti tab tak rahe jab tak band na karein
const SUCCESS_MS = 3000

function WorkspaceContent({ orgId, section }) {
  const { orgs, loading, error } = useWorkspace()
  const navigate = useNavigate()
  const [alert, setAlert] = useState(null)
  const timer = useRef(null)

  // stable — child components ke effects is par depend karte hain
  const showResult = useCallback((result) => {
    clearTimeout(timer.current)
    setAlert(result)
    if (result.ok) timer.current = setTimeout(() => setAlert(null), SUCCESS_MS)
  }, [])

  const org = orgs?.find((o) => o._id === orgId)
  const View = SECTION_VIEWS[section]

  let content
  if (loading) {
    content = <Loader text="Orgs load ho rahi hain…" />
  } else if (error) {
    content = <p className="text-sm text-error-text">{error.text}</p>
  } else if (!orgId) {
    // /workspace — pehli org par, warna khaali halat
    content = orgs.length ? (
      <Navigate to={`/workspace/${orgs[0]._id}/members`} replace />
    ) : (
      <div className={panel}>
        <EmptyState icon={BuildingIcon} title="Aap kisi org mein nahi" text="Sidebar se nayi org banayein (aap owner honge), ya kisi invite link se join karein." />
      </div>
    )
  } else if (!org) {
    // org hai hi nahi, ya aap member nahi — backend bhi dono ko ek jaisa 404 deta hai
    content = (
      <div className={panel}>
        <EmptyState icon={BuildingIcon} title="Org nahi mili" text="Ya to yeh org maujood nahi, ya aap is ke member nahi." />
        <p className="pb-6 text-center text-small">
          <Link to="/workspace" className={link}>
            Meri orgs par wapas
          </Link>
        </p>
      </div>
    )
  } else {
    content = (
      <>
        <header className={pageHeader}>
          <div className="min-w-0">
            <h1 className={cn(pageTitle, 'truncate')}>
              {org.name} · {SECTIONS[section]}
            </h1>
            <p className={subtitle}>
              <span className={badge}>{org.role}</span> {ROLE_INFO[org.role]}
            </p>
          </div>
        </header>
        {/* key — org badalne par section ki state (form, list) naye sire se */}
        <View key={org._id} org={org} onResult={showResult} />
      </>
    )
  }

  return (
    <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)] md:items-start">
      <WorkspaceSidebar orgId={orgId} section={section} onResult={showResult} onCreated={(id) => navigate(`/workspace/${id}/members`)} />
      <div className="min-w-0">{content}</div>
      <Toast alert={alert} onClose={() => setAlert(null)} />
    </div>
  )
}

export default function Workspace() {
  const { orgId, section } = useParams()
  // org hai lekin section ghalat (purana /workspace/:orgId/tasks link) — members par
  if (orgId && !SECTIONS[section]) return <Navigate to={`/workspace/${orgId}/members`} replace />

  return (
    <WorkspaceProvider>
      <WorkspaceContent orgId={orgId} section={section} />
    </WorkspaceProvider>
  )
}
