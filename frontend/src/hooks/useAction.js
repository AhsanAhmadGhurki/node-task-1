// button wale kaam (API call) ka ek tareeqa — ek waqt mein ek (useRef guard, kyunke busy state der se badalta hai),
// kamyabi/galti onResult (Toast) ko; Dashboard ke run() jaisa
import { useCallback, useRef, useState } from 'react'
import { toAlert } from '../utils/helpers'

export function useAction(onResult) {
  const inFlight = useRef(false)
  const [busy, setBusy] = useState(false)

  // success: text ya (data) => text; kamyabi par data lautata hai, galti par null
  const run = useCallback(
    async (action, success) => {
      if (inFlight.current) return null
      inFlight.current = true
      setBusy(true)
      try {
        const data = await action()
        if (success) {
          onResult({ ok: true, status: 200, text: typeof success === 'function' ? success(data) : success })
        }
        return data ?? true
      } catch (error) {
        onResult(toAlert(error))
        return null
      } finally {
        inFlight.current = false
        setBusy(false)
      }
    },
    [onResult],
  )

  return { busy, run }
}
