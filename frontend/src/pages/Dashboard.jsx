// /dashboard — logged-in user ke tasks: dekhna, add, complete, title edit, delete
import { useCallback, useEffect, useRef, useState } from 'react'
import { createTask, deleteTask, getTasks, updateTask } from '../api/taskApi'
import Alert from '../components/Alert'
import Loader from '../components/Loader'
import TaskForm from '../components/TaskForm'
import TaskItem from '../components/TaskItem'
import { button, card, cn, muted, titleText } from '../ui/styles'
import { toAlert } from '../utils/helpers'

// kamyabi ka paigham itni der baad khud hat jaata hai — error rehta hai jab tak agla action na ho
const SUCCESS_ALERT_MS = 3000

export default function Dashboard() {
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

  return (
    <section className={card}>
      <div className="mb-5 flex items-center justify-between">
        <h1 className={titleText}>My tasks</h1>
        <button className={button({ variant: 'secondary', size: 'sm' })} onClick={loadTasks} disabled={busy}>
          Refresh
        </button>
      </div>
      <Alert alert={alert} />

      <TaskForm onAdd={handleAdd} disabled={busy} />

      {tasks === null ? (
        <Loader text="Tasks load ho rahe hain…" />
      ) : tasks.length === 0 ? (
        <p className={cn(muted, 'mt-[18px]')}>Koi task nahi hai — upar se naya add karein.</p>
      ) : (
        <ul className="mt-[18px] border-t border-border">
          {tasks.map((task) => (
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
    </section>
  )
}
