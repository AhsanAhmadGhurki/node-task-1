// meri orgs (GET /orgs) — sidebar aur har workspace page isi list se; har org ke saath mera role (backend ka)
// banane/chhodne/delete/transfer ke baad reload() — role ya list badal jaati hai
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createOrg as createOrgRequest, listOrgs } from '../api/orgApi'
import { WorkspaceContext } from '../hooks/useWorkspace'
import { toAlert } from '../utils/helpers'

export function WorkspaceProvider({ children }) {
  const [orgs, setOrgs] = useState(null)
  const [error, setError] = useState(null)

  // pehli load — state sirf .then mein (oxlint set-state-in-effect), cancelled se unmount ke baad setState nahi
  useEffect(() => {
    let cancelled = false
    listOrgs()
      .then((data) => {
        if (!cancelled) setOrgs(data.orgs)
      })
      .catch((err) => {
        if (!cancelled) setError(toAlert(err))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const reload = useCallback(async () => {
    const data = await listOrgs()
    setOrgs(data.orgs)
    setError(null)
    return data.orgs
  }, [])

  // nayi org — list mein foran (banane wala owner)
  const createOrg = useCallback(async (name) => {
    const data = await createOrgRequest(name)
    setOrgs((current) => [...(current || []), { ...data.org, role: data.role }])
    return data
  }, [])

  const value = useMemo(() => ({ orgs, error, loading: orgs === null && !error, reload, createOrg }), [orgs, error, reload, createOrg])

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}
