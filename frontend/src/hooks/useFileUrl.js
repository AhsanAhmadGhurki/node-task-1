// fileId → <img src> ke laayaq signed link (10 minute, bina token) — expire hone se pehle naya le leta hai
// taake page der tak khula rahe to bhi preview ya dobara load hone wali tasveer 403 na de
import { useEffect, useState } from 'react'
import { getSignedUrl, isFileId } from '../api/fileApi'

// expiry se itna pehle naya link — ghadi ka thoda farq (client vs server) bhi is mein aa jaata hai
const REFRESH_BEFORE_MS = 60 * 1000
// ghadi bahut aage/peeche ho to bhi lagataar requests na hon
const MIN_REFRESH_MS = 30 * 1000

export function useFileUrl(fileId) {
  // { id, url } — kis fileId ka link hai; fileId badle to purana link foran "nahi" ban jaata (neeche)
  const [state, setState] = useState(null)

  useEffect(() => {
    if (!isFileId(fileId)) return undefined
    let cancelled = false
    let timer

    // state sirf .then/.catch mein — effect mein seedha setState nahi (oxlint set-state-in-effect)
    const load = () =>
      getSignedUrl(fileId)
        .then(({ url, expiresAt }) => {
          if (cancelled) return
          setState({ id: fileId, url })
          timer = setTimeout(load, Math.max(expiresAt - Date.now() - REFRESH_BEFORE_MS, MIN_REFRESH_MS))
        })
        .catch(() => !cancelled && setState({ id: fileId, url: null }))

    load()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [fileId])

  // purane fileId ka link naye par na lage
  const current = state?.id === fileId && isFileId(fileId) ? state : null
  return { url: current?.url ?? null }
}
