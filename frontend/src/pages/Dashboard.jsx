// /dashboard — logged-in user ke tasks: dekhna, add, complete, title edit, delete
// ek panel: upar naya task, phir filter (All / Pending / Done) + progress ki patti, phir list
import { useCallback, useEffect, useRef, useState } from 'react'
import { createTask, deleteTask, getTasks, updateTask } from '../api/taskApi'
import EmptyState from '../components/EmptyState'
import Loader from '../components/Loader'
import TaskForm from '../components/TaskForm'
import TaskItem from '../components/TaskItem'
import Toast from '../components/Toast'
import { useAuth } from '../hooks/useAuth'
import { CheckCircleIcon, InboxIcon, ListChecksIcon, RefreshIcon } from '../ui/icons'
import { button, cn, focusRing, pageHeader, pageTitle, panel, subtitle } from '../ui/styles'
import { toAlert } from '../utils/helpers'

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

export default function Dashboard() {
  const { user } = useAuth()
  const [filter, setFilter] = useState('all')
  // null = abhi load nahi hua (Loader dikhao), [] = load ho gaya lekin khaali
  const [tasks, setTasks] = useState(null)
  const [alert, setAlert] = useState(null)
  // koi request chal rahi ho to buttons band — UI ke liye (state, agle render par lagti hai)
  const [busy, setBusy] = useState(false)
  // asli roak — ref foran badalta hai; ek hi tick mein 3 submit hon to bhi sirf pehla chale
  // (busy state us waqt tak update hi nahi hoti, isliye sirf usse 3 tasks ban jaate the)
  const inFlight = useRef(false)

  // har action ka ek hi pattern — guard, purana paigham saaf, busy on, call, error ho to Alert
  // 401 par axios interceptor khud logout karta hai, ProtectedRoute /login bhej deta hai
  // onNotFound — 404 (task kisi aur tab/device se pehle hi delete) par list se hatao
  const run = useCallback(async (action, { onNotFound } = {}) => {
    if (inFlight.current) return null
    inFlight.current = true
    setAlert(null)
    setBusy(true)
    try {
      return await action()
    } catch (error) {
      if (error.response?.status === 404 && onNotFound) {
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
    const data = await run(getTasks)
    if (data) setTasks(data)
  }, [run])

  // page khulte hi tasks load — state sirf jawab aane par (effect ke andar foran setState nahi)
  // cancelled — page jawab se pehle band ho jaye (jaise logout) to purane jawab se state na badle
  useEffect(() => {
    let cancelled = false
    getTasks()
      .then((data) => !cancelled && setTasks(data))
      .catch((error) => !cancelled && setAlert(toAlert(error)))
    return () => {
      cancelled = true
    }
  }, [])

  // task kisi aur jagah se delete ho chuka — yahan bhi hata do (warna row rehti aur har click par phir 404)
  function removeLocally(task) {
    setTasks((current) => current.filter((t) => t._id !== task._id))
  }

  async function handleAdd(title) {
    const task = await run(() => createTask(title))
    if (!task) return false
    setTasks((current) => [...(current || []), task])
    setAlert({ ok: true, status: 201, text: `Task added: ${task.title}` })
    return true
  }

  async function handleToggle(task) {
    // sirf completed bhejo — backend PUT par sirf bheji hui fields badalta hai
    const updated = await run(() => updateTask(task._id, { completed: !task.completed }), {
      onNotFound: () => removeLocally(task),
    })
    if (updated) {
      setTasks((current) => current.map((t) => (t._id === task._id ? updated : t)))
      setAlert({ ok: true, status: 200, text: updated.completed ? `Done: ${updated.title}` : `Pending: ${updated.title}` })
    }
  }

  // title badlo — sirf title bhejo (completed waisa hi rehta hai); true = kamyab, TaskItem edit band kare
  async function handleRename(task, title) {
    const updated = await run(() => updateTask(task._id, { title }), { onNotFound: () => removeLocally(task) })
    if (!updated) return false
    setTasks((current) => current.map((t) => (t._id === task._id ? updated : t)))
    setAlert({ ok: true, status: 200, text: `Task renamed: ${updated.title}` })
    return true
  }

  async function handleDelete(task) {
    const result = await run(() => deleteTask(task._id), { onNotFound: () => removeLocally(task) })
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
          <h1 className={pageTitle}>My tasks</h1>
          <p className={cn(subtitle, 'truncate')}>{greeting(user.email)}</p>
        </div>
        <button className={button({ variant: 'secondary', size: 'sm' })} onClick={loadTasks} disabled={busy}>
          <RefreshIcon className={cn('size-4', busy && 'animate-spin motion-reduce:animate-none')} />
          <span className="max-sm:hidden">Refresh</span>
        </button>
      </div>

      {/* ek hi panel — upar naya task, phir filter + progress ki patti, phir list (pehle teen alag dabbe the) */}
      <div className={cn(panel, 'overflow-hidden')}>
        <div className="p-4">
          <TaskForm onAdd={handleAdd} disabled={busy} />
        </div>

        {/* filter aur kitna kaam ho gaya — tasks hon tabhi (khaali list par sab ginti 0, dikhane ka faida nahi) */}
        {counts.all > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border px-4 py-2.5">
            {/* aria-pressed buttons — tablist nahi, kyunki neeche alag tab panels nahi, ek hi list chhanti hai */}
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
                    // chuna hua — safed satah aur patli line (saaya nahi)
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
              <EmptyState icon={InboxIcon} title="Abhi koi task nahi" text="Upar likh kar apna pehla task add karein." />
            ) : filter === 'done' ? (
              <EmptyState icon={ListChecksIcon} title="Abhi kuch complete nahi hua" text="Task ke saath wala box tick karein." />
            ) : (
              <EmptyState icon={CheckCircleIcon} title="Sab kaam ho gaya!" text="Koi pending task nahi bacha." />
            )
          ) : (
            <ul className="divide-y divide-border">
              {visible.map((task) => (
                <TaskItem
                  key={task._id}
                  task={task}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  onRename={handleRename}
                  disabled={busy}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      <Toast alert={alert} onClose={() => setAlert(null)} />
    </div>
  )
}
