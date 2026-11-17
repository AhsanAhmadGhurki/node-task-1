// /dashboard — tasks: personal (sirf aap ke) ya kisi workspace ke (/dashboard?org=<id>)
// ek panel: upar naya task, phir filter (All / Pending / Done) + progress ki patti, phir list
// workspace ka role buttons tay karta hai (viewer sirf dekhe; member apne task ka naam/delete) — asal rok backend ki
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { listOrgs } from '../api/orgApi'
import { createTask, deleteTask, getTasks, updateTask } from '../api/taskApi'
import EmptyState from '../components/EmptyState'
import Loader from '../components/Loader'
import TaskForm from '../components/TaskForm'
import TaskItem from '../components/TaskItem'
import Toast from '../components/Toast'
import { useAuth } from '../hooks/useAuth'
import { BuildingIcon, CheckCircleIcon, InboxIcon, ListChecksIcon, RefreshIcon } from '../ui/icons'
import { badge, button, cn, focusRing, input, link, pageHeader, pageTitle, panel, subtitle } from '../ui/styles'
import { toAlert } from '../utils/helpers'
import { can, canManageTask } from '../workspace/permissions'

const FILTERS = [
  ['all', 'All'],
  ['pending', 'Pending'],
  ['done', 'Done'],
]

// waqt ke hisaab se salaam — email ka pehla hissa naam ki jagah
function greeting(email) {
  const hour = new Date().getHours()
  const part = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  return `${part}, ${email.split('@')[0]}`
}

// kamyabi ka paigham itni der baad khud hat jaata hai — error rehta hai jab tak agla action na ho
const SUCCESS_ALERT_MS = 3000

// "Personal" ya koi workspace — chunna URL badalta hai (?org=), to link share/refresh par wahi list khulti hai
function ScopeSelect({ orgs, orgId, onChange }) {
  const id = useId()
  return (
    <div className="w-40 sm:w-48">
      <label htmlFor={id} className="sr-only">
        Kis ke tasks
      </label>
      <select id={id} className={input} value={orgId || ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">Personal</option>
        {orgs.map((org) => (
          <option key={org._id} value={org._id}>
            {org.name}
          </option>
        ))}
      </select>
    </div>
  )
}

// org ke task par "kis ne banaya" — account mit chuka ho to user null aata hai
function creatorText(task, me) {
  if (!task.user) return 'Hataya gaya account'
  if (task.user._id === me) return 'Aap ne banaya'
  return `${task.user.name || task.user.email} ne banaya`
}

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const orgId = searchParams.get('org')
  // null = abhi load nahi; switcher aur role isi se. fail ho to [] — personal tasks phir bhi chalte hain
  const [orgs, setOrgs] = useState(null)

  useEffect(() => {
    let cancelled = false
    listOrgs()
      .then((data) => !cancelled && setOrgs(data.orgs))
      .catch(() => !cancelled && setOrgs([]))
    return () => {
      cancelled = true
    }
  }, [])

  const org = orgId ? orgs?.find((o) => o._id === orgId) : null

  function chooseScope(id) {
    setSearchParams(id ? { org: id } : {})
  }

  if (orgId && orgs === null) {
    return <Loader text="Workspace load ho raha hai…" />
  }

  // purana link, ya aap is org se nikal chuke — personal par wapas ka raasta
  if (orgId && !org) {
    return (
      <div className={panel}>
        <EmptyState icon={BuildingIcon} title="Workspace nahi mili" text="Ya to yeh maujood nahi, ya aap is ke member nahi." />
        <p className="pb-6 text-center text-small">
          <Link to="/dashboard" className={link}>
            Apne tasks par wapas
          </Link>
        </p>
      </div>
    )
  }

  // key — workspace badle to board naye sire se (purani list, filter aur paigham saath na aayein)
  return <TaskBoard key={org?._id || 'personal'} org={org} orgs={orgs || []} onScopeChange={chooseScope} />
}

function TaskBoard({ org, orgs, onScopeChange }) {
  const { user } = useAuth()
  const orgId = org?._id
  const role = org?.role
  // personal task par sab ijazat; workspace mein role ke mutabiq (backend phir bhi khud check karta hai)
  const canCreate = !org || can(role, 'task:create')
  const canToggle = !org || can(role, 'task:toggle')

  const [filter, setFilter] = useState('all')
  // null = abhi load nahi hua (Loader dikhao), [] = load ho gaya lekin khaali
  const [tasks, setTasks] = useState(null)
  const [alert, setAlert] = useState(null)
  // koi request chal rahi ho to buttons band — UI ke liye (state, agle render par lagti hai)
  const [busy, setBusy] = useState(false)
  // asli roak — ref foran badalta hai; ek hi tick mein 3 submit hon to bhi sirf pehla chale
  // (busy state us waqt tak update hi nahi hoti, isliye sirf usse 3 tasks ban jaate the)
  const inFlight = useRef(false)

  // har action ka ek hi pattern — guard, purana paigham saaf, busy on, call, error ho to Toast
  // 401 par axios interceptor khud logout karta hai, ProtectedRoute /login bhej deta hai
  // onNotFound — task kisi aur tab/device se pehle hi delete ho chuka: list se hatao
  // (sirf "Task not found" par — workspace se nikale jaane ka 404 "Organization not found" hai, woh task ka qasoor nahi)
  const run = useCallback(async (action, { onNotFound } = {}) => {
    if (inFlight.current) return null
    inFlight.current = true
    setAlert(null)
    setBusy(true)
    try {
      return await action()
    } catch (error) {
      if (error.response?.status === 404 && error.response.data?.message === 'Task not found' && onNotFound) {
        onNotFound()
        setAlert({ ok: false, status: 404, text: 'Ye task pehle hi delete ho chuka tha — list se hata diya.' })
      } else {
        setAlert(toAlert(error))
      }
      return null
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }, [])

  // kamyabi ka paigham 3 second baad hat jaye — setAlert timer ke callback mein (effect mein seedha nahi)
  useEffect(() => {
    if (!alert?.ok) return undefined
    const timer = setTimeout(() => setAlert(null), SUCCESS_ALERT_MS)
    return () => clearTimeout(timer)
  }, [alert])

  const loadTasks = useCallback(async () => {
    const data = await run(() => getTasks(orgId))
    if (data) setTasks(data)
  }, [run, orgId])

  // board khulte hi tasks load — state sirf jawab aane par (effect ke andar foran setState nahi)
  // cancelled — jawab se pehle board band ho jaye (logout, ya doosra workspace chuna) to purane jawab se state na badle
  useEffect(() => {
    let cancelled = false
    getTasks(orgId)
      .then((data) => !cancelled && setTasks(data))
      .catch((error) => !cancelled && setAlert(toAlert(error)))
    return () => {
      cancelled = true
    }
  }, [orgId])

  // task kisi aur jagah se delete ho chuka — yahan bhi hata do (warna row rehti aur har click par phir 404)
  function removeLocally(task) {
    setTasks((current) => current.filter((t) => t._id !== task._id))
  }

  async function handleAdd(title) {
    const task = await run(() => createTask(title, orgId))
    if (!task) return false
    setTasks((current) => [...(current || []), task])
    setAlert({ ok: true, status: 201, text: `Task added: ${task.title}` })
    return true
  }

  async function handleToggle(task) {
    // sirf completed bhejo — backend PUT par sirf bheji hui fields badalta hai
    const updated = await run(() => updateTask(task._id, { completed: !task.completed }, orgId), {
      onNotFound: () => removeLocally(task),
    })
    if (updated) {
      setTasks((current) => current.map((t) => (t._id === task._id ? updated : t)))
      setAlert({ ok: true, status: 200, text: updated.completed ? `Done: ${updated.title}` : `Pending: ${updated.title}` })
    }
  }

  // sirf title bhejo — completed waisa hi rahe; true lautaye to TaskItem edit band kar deta hai
  async function handleRename(task, title) {
    const updated = await run(() => updateTask(task._id, { title }, orgId), { onNotFound: () => removeLocally(task) })
    if (!updated) return false
    setTasks((current) => current.map((t) => (t._id === task._id ? updated : t)))
    setAlert({ ok: true, status: 200, text: `Task renamed: ${updated.title}` })
    return true
  }

  async function handleDelete(task) {
    const result = await run(() => deleteTask(task._id, orgId), { onNotFound: () => removeLocally(task) })
    if (result) {
      removeLocally(task)
      setAlert({ ok: true, status: 200, text: `Task deleted: ${task.title}` })
    }
  }

  const doneCount = tasks?.filter((t) => t.completed).length ?? 0
  const counts = { all: tasks?.length ?? 0, pending: (tasks?.length ?? 0) - doneCount, done: doneCount }
  const visible = (tasks || []).filter((t) => (filter === 'all' ? true : filter === 'done' ? t.completed : !t.completed))
  const percent = counts.all ? Math.round((doneCount / counts.all) * 100) : 0

  return (
    <div>
      <div className={pageHeader}>
        <div className="min-w-0">
          <h1 className={cn(pageTitle, 'truncate')}>{org ? org.name : 'My tasks'}</h1>
          {org ? (
            <p className={cn(subtitle, 'flex items-center gap-1.5')}>
              Workspace tasks <span className={badge}>{role}</span>
            </p>
          ) : (
            <p className={cn(subtitle, 'truncate')}>{greeting(user.email)}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {orgs.length > 0 && <ScopeSelect orgs={orgs} orgId={orgId} onChange={onScopeChange} />}
          <button className={button({ variant: 'secondary', size: 'sm' })} onClick={loadTasks} disabled={busy} aria-label="Refresh">
            <RefreshIcon className={cn('size-4', busy && 'animate-spin motion-reduce:animate-none')} />
            <span className="max-sm:hidden">Refresh</span>
          </button>
        </div>
      </div>

      <div className={cn(panel, 'overflow-hidden')}>
        {canCreate ? (
          <div className="p-4">
            <TaskForm onAdd={handleAdd} disabled={busy} />
          </div>
        ) : (
          <p className="px-4 py-3 text-small text-muted">Aap is workspace mein viewer hain — tasks sirf dekh sakte hain.</p>
        )}

        {counts.all > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border px-4 py-2.5">
            <div className="inline-flex rounded-md bg-subtle p-0.5" role="group" aria-label="Filter tasks">
              {FILTERS.map(([key, text]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={filter === key}
                  onClick={() => setFilter(key)}
                  className={cn(
                    'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded px-2.5 text-sm font-medium transition-colors',
                    focusRing,
                    filter === key ? 'bg-card text-text ring-1 ring-border' : 'text-muted hover:text-text',
                  )}
                >
                  {text}
                  <span className="text-xs text-muted tabular-nums">{counts[key]}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2.5 text-xs text-muted">
              <span className="tabular-nums">
                <span className="font-medium text-text">{doneCount}</span> of {counts.all} done
              </span>
              <span className="h-1 w-24 overflow-hidden rounded-full bg-subtle" aria-hidden="true">
                <span
                  className="block h-full rounded-full bg-primary transition-[width] duration-300"
                  style={{ width: `${percent}%` }}
                />
              </span>
            </div>
          </div>
        )}

        <div className="border-t border-border">
          {tasks === null ? (
            <div className="p-4">
              <Loader text="Tasks load ho rahe hain…" />
            </div>
          ) : visible.length === 0 ? (
            counts.all === 0 ? (
              <EmptyState
                icon={InboxIcon}
                title="Abhi koi task nahi"
                text={canCreate ? 'Upar likh kar pehla task add karein.' : 'Is workspace mein abhi koi task nahi bana.'}
              />
            ) : filter === 'done' ? (
              <EmptyState icon={ListChecksIcon} title="Abhi kuch complete nahi hua" text="Task ke saath wala box tick karein." />
            ) : (
              <EmptyState icon={CheckCircleIcon} title="Sab kaam ho gaya!" text="Koi pending task nahi bacha." />
            )
          ) : (
            <ul className="divide-y divide-border">
              {visible.map((task) => {
                const manage = !org || canManageTask(role, task.user?._id === user._id)
                return (
                  <TaskItem
                    key={task._id}
                    task={task}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                    onRename={handleRename}
                    disabled={busy}
                    canToggle={canToggle}
                    canEdit={manage}
                    canDelete={manage}
                    creator={org ? creatorText(task, user._id) : null}
                  />
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <Toast alert={alert} onClose={() => setAlert(null)} />
    </div>
  )
}
