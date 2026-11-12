// WorkspaceContext tak chhota rasta — useAuth jaisa (provider context/WorkspaceContext.jsx mein, fast refresh ke liye alag)
import { createContext, useContext } from 'react'

export const WorkspaceContext = createContext(null)

export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (!context) {
    throw new Error('useWorkspace must be used inside <WorkspaceProvider>')
  }
  return context
}
