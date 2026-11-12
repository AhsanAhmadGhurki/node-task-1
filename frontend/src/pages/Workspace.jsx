// /workspace/:section — orgs (mock), sidebar se org/role badlo, aur Tasks / Tickets / Members dekho
// abhi backend nahi — data WorkspaceContext ke mock se; baad mein wahi functions API bulayenge
import { useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router'
import OrgItemList from '../components/OrgItemList'
import OrgMembers from '../components/OrgMembers'
import EmptyState from '../components/EmptyState'
import Toast from '../components/Toast'
import WorkspaceSidebar from '../components/WorkspaceSidebar'
import { WorkspaceProvider } from '../context/WorkspaceContext'
import { useWorkspace } from '../hooks/useWorkspace'
import { BuildingIcon } from '../ui/icons'
import { badge, button, cn, pageHeader, pageTitle, panel, subtitle } from '../ui/styles'
import { ROLE_INFO } from '../workspace/permissions'

const SECTIONS = { tasks: 'Tasks', tickets: 'Tickets', members: 'Members' }

// kamyabi ka toast khud chala jaye; galti (403/400/409) tab tak rahe jab tak band na karein
const SUCCESS_MS = 3000

function WorkspaceContent({ section }) {
  const { activeOrg, role, myRole, previewRole, resetMock } = useWorkspace()
  const [alert, setAlert] = useState(null)
  const timer = useRef(null)

  function showResult({ ok, text }) {
    clearTimeout(timer.current)
    setAlert({ ok, text })
    if (ok) timer.current = setTimeout(() => setAlert(null), SUCCESS_MS)
  }

  return (
    <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)] md:items-start">
      <WorkspaceSidebar onResult={showResult} />

      <div className="min-w-0">
        {activeOrg ? (
          <>
            <header className={pageHeader}>
              <div className="min-w-0">
                <h1 className={cn(pageTitle, 'truncate')}>
                  {activeOrg.name} · {SECTIONS[section]}
                </h1>
                <p className={subtitle}>
                  <span className={badge}>{role}</span> {ROLE_INFO[role]}
                </p>
                {previewRole && previewRole !== myRole && (
                  <p className="mt-1 text-xs text-muted">Preview chal raha hai — asal role {myRole} hai.</p>
                )}
              </div>
            </header>

            {section === 'members' ? <OrgMembers onResult={showResult} /> : <OrgItemList key={section} kind={section} onResult={showResult} />}
          </>
        ) : (
          <div className={panel}>
            <EmptyState icon={BuildingIcon} title="Aap kisi org mein nahi" text="Sidebar se nayi org banayein — aap khud owner honge." />
          </div>
        )}

        <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-xs text-muted">Mock data — backend abhi orgs nahi jaanta. Tabdeeliyan sirf is browser mein.</p>
          <button type="button" className={button({ variant: 'ghost', size: 'sm' })} onClick={() => showResult(resetMock())}>
            Reset mock
          </button>
        </div>
      </div>

      <Toast alert={alert} onClose={() => setAlert(null)} />
    </div>
  )
}

export default function Workspace() {
  const { section } = useParams()
  if (!SECTIONS[section]) return <Navigate to="/workspace/tasks" replace />

  return (
    <WorkspaceProvider>
      <WorkspaceContent section={section} />
    </WorkspaceProvider>
  )
}
