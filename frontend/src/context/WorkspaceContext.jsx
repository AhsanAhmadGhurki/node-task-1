// workspaces ki state (mock) — orgs, active org, role preview, aur har action
// har action pehle permission dekhta hai, bilkul jaise backend ka requireRole karega — button band hone ke bawajood
// (kal backend aayega to yahi functions API call karenge, aur 403/409/400 wahan se aayenge)
import { useCallback, useEffect, useMemo, useState } from 'react'
import { WorkspaceContext } from '../hooks/useWorkspace'
import { createMockOrgs, INVITE_TTL_MS, ME_ID, newId } from '../workspace/mockData'
import {
  LAST_OWNER_MESSAGE,
  ROLES,
  assignableRoles,
  breaksLastOwner,
  can,
  canEditItem,
  canManageMember,
  invitableRoles,
} from '../workspace/permissions'

const STORAGE_KEY = 'taskdesk.mockWorkspaces'
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function initialState() {
  return { orgs: createMockOrgs(), activeOrgId: 'org-meri', previewRole: null }
}

// reload par mock ki tabdeeliyan na mitein — localStorage na chale (private window) to naya mock
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // khaali/kharab storage — naya mock
  }
  return initialState()
}

const denied = (text) => ({ ok: false, text })
const done = (text) => ({ ok: true, text })

export function WorkspaceProvider({ children }) {
  const [state, setState] = useState(loadState)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // storage band — sirf is tab tak yaad rahega
    }
  }, [state])

  const activeOrg = state.orgs.find((org) => org.id === state.activeOrgId) || state.orgs[0] || null
  // asli role (membership se) — preview sirf dekhne ke liye upar se lagta hai
  const myRole = activeOrg?.members.find((m) => m.userId === ME_ID)?.role || null
  const role = state.previewRole || myRole

  // active org par ek tabdeeli — baaki orgs waisi hi
  const updateActiveOrg = useCallback(
    (change) => {
      setState((current) => ({
        ...current,
        orgs: current.orgs.map((org) => (org.id === activeOrg.id ? change(org) : org)),
      }))
    },
    [activeOrg],
  )

  const selectOrg = useCallback((orgId) => {
    // org badli to preview band — har org ka apna asli role dikhe
    setState((current) => ({ ...current, activeOrgId: orgId, previewRole: null }))
  }, [])

  const setPreviewRole = useCallback((previewRole) => {
    setState((current) => ({ ...current, previewRole: ROLES.includes(previewRole) ? previewRole : null }))
  }, [])

  // koi bhi verified user org bana sakta hai — banane wala khud owner
  const createOrg = useCallback((name) => {
    const trimmed = name.trim()
    if (trimmed.length < 2) return denied('Org ka naam kam az kam 2 characters ka ho')
    const org = { id: newId('org'), name: trimmed, members: [{ userId: ME_ID, role: 'owner' }], invites: [], tasks: [], tickets: [] }
    setState((current) => ({ ...current, orgs: [...current.orgs, org], activeOrgId: org.id, previewRole: null }))
    return done(`"${trimmed}" ban gayi — aap owner hain`)
  }, [])

  // kind: 'tasks' | 'tickets'
  const addItem = useCallback(
    (kind, title) => {
      if (!can(role, 'item:create')) return denied(`403 — ${role} naya ${kind === 'tasks' ? 'task' : 'ticket'} nahi bana sakta`)
      const trimmed = title.trim()
      if (!trimmed) return denied('Title khaali nahi ho sakta')
      updateActiveOrg((org) => ({ ...org, [kind]: [{ id: newId(kind), title: trimmed, done: false, createdBy: ME_ID }, ...org[kind]] }))
      return done('Ban gaya')
    },
    [role, updateActiveOrg],
  )

  const toggleItem = useCallback(
    (kind, item) => {
      if (!canEditItem(role, item, ME_ID)) return denied(`403 — ${role} yeh item nahi badal sakta`)
      updateActiveOrg((org) => ({ ...org, [kind]: org[kind].map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)) }))
      return done(item.done ? 'Wapas khula' : 'Mukammal')
    },
    [role, updateActiveOrg],
  )

  const deleteItem = useCallback(
    (kind, item) => {
      if (!canEditItem(role, item, ME_ID)) return denied(`403 — ${role} yeh item delete nahi kar sakta`)
      updateActiveOrg((org) => ({ ...org, [kind]: org[kind].filter((i) => i.id !== item.id) }))
      return done('Delete ho gaya')
    },
    [role, updateActiveOrg],
  )

  // invite — pehle se member: 409; pending invite: naya token, purana band (48h phir se)
  const invite = useCallback(
    (email, inviteRole) => {
      if (!can(role, 'member:invite')) return denied(`403 — ${role} invite nahi bhej sakta`)
      if (!invitableRoles(role).includes(inviteRole)) return denied(`403 — ${role} "${inviteRole}" role ka invite nahi de sakta`)
      const normalized = email.trim().toLowerCase()
      if (!EMAIL_PATTERN.test(normalized)) return denied('Sahi email likhein')
      if (activeOrg.members.some((m) => m.email === normalized)) return denied('409 — yeh email pehle se member hai')
      const replaced = activeOrg.invites.some((i) => i.email === normalized)
      const fresh = { email: normalized, role: inviteRole, expiresAt: new Date(Date.now() + INVITE_TTL_MS).toISOString() }
      updateActiveOrg((org) => ({ ...org, invites: [fresh, ...org.invites.filter((i) => i.email !== normalized)] }))
      return done(replaced ? 'Purana invite band, naya link bheja (48 ghante)' : 'Invite bheja (48 ghante tak chalega)')
    },
    [role, activeOrg, updateActiveOrg],
  )

  const cancelInvite = useCallback(
    (email) => {
      if (!can(role, 'member:invite')) return denied(`403 — ${role} invite cancel nahi kar sakta`)
      updateActiveOrg((org) => ({ ...org, invites: org.invites.filter((i) => i.email !== email) }))
      return done('Invite cancel')
    },
    [role, updateActiveOrg],
  )

  const changeRole = useCallback(
    (member, nextRole) => {
      if (!canManageMember(role, member.role) || !assignableRoles(role).includes(nextRole)) {
        return denied(`403 — ${role} yeh role nahi badal sakta`)
      }
      if (breaksLastOwner(activeOrg.members, member.userId, nextRole)) return denied(`400 — ${LAST_OWNER_MESSAGE}`)
      updateActiveOrg((org) => ({
        ...org,
        members: org.members.map((m) => (m.userId === member.userId ? { ...m, role: nextRole } : m)),
      }))
      return done(`Role badal kar ${nextRole}`)
    },
    [role, activeOrg, updateActiveOrg],
  )

  const removeMember = useCallback(
    (member) => {
      if (!canManageMember(role, member.role)) return denied(`403 — ${role} is member ko nahi nikaal sakta`)
      if (breaksLastOwner(activeOrg.members, member.userId, null)) return denied(`400 — ${LAST_OWNER_MESSAGE}`)
      updateActiveOrg((org) => ({ ...org, members: org.members.filter((m) => m.userId !== member.userId) }))
      return done('Member nikaal diya')
    },
    [role, activeOrg, updateActiveOrg],
  )

  // khud org chhodna — har role kar sakta hai, sirf aakhri owner nahi
  const leaveOrg = useCallback(() => {
    if (breaksLastOwner(activeOrg.members, ME_ID, null)) return denied(`400 — ${LAST_OWNER_MESSAGE}`)
    setState((current) => {
      const orgs = current.orgs.filter((org) => org.id !== activeOrg.id)
      return { ...current, orgs, activeOrgId: orgs[0]?.id || null, previewRole: null }
    })
    return done(`"${activeOrg.name}" chhod di`)
  }, [activeOrg])

  const resetMock = useCallback(() => {
    setState(initialState())
    return done('Mock data shuru wali halat mein')
  }, [])

  const value = useMemo(
    () => ({
      orgs: state.orgs,
      activeOrg,
      myRole,
      role,
      previewRole: state.previewRole,
      selectOrg,
      setPreviewRole,
      createOrg,
      addItem,
      toggleItem,
      deleteItem,
      invite,
      cancelInvite,
      changeRole,
      removeMember,
      leaveOrg,
      resetMock,
    }),
    [state, activeOrg, myRole, role, selectOrg, setPreviewRole, createOrg, addItem, toggleItem, deleteItem, invite, cancelInvite, changeRole, removeMember, leaveOrg, resetMock],
  )

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}
