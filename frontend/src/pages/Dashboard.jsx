// /dashboard — logged-in user ke tasks: dekhna, add, complete, delete
import { useCallback, useEffect, useState } from 'react'
import { createTask, deleteTask, getTasks, updateTask } from '../api/taskApi'
import Alert from '../components/Alert'
import Loader from '../components/Loader'
import TaskForm from '../components/TaskForm'
import TaskItem from '../components/TaskItem'
import { toAlert } from '../utils/helpers'

export default function Dashboard() {
  // null = abhi load nahi hua (Loader dikhao), [] = load ho gaya lekin khaali
  const [tasks, setTasks] = useState(null)
  const [alert, setAlert] = useState(null)
  // koi request chal rahi ho to buttons band — do baar click se do requests na jayein
  const [busy, setBusy] = useState(false)

  // har action ka ek hi pattern — busy on, call, error ho to Alert
  // 401 par axios interceptor khud logout karta hai, ProtectedRoute /login bhej deta hai
  const run = useCallback(async (action) => {
    setBusy(true)
    try {
      return await action()
    } catch (error) {
      setAlert(toAlert(error))
      return null
    } finally {
      setBusy(false)
    }
  }, [])

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

  async function handleAdd(title) {
    const task = await run(() => createTask(title))
    if (!task) return false
    setTasks((current) => [...(current || []), task])
    setAlert({ ok: true, status: 201, text: `Task added: ${task.title}` })
    return true
  }

  async function handleToggle(task) {
    // sirf completed bhejo — backend PUT par sirf bheji hui fields badalta hai
    const updated = await run(() => updateTask(task._id, { completed: !task.completed }))
    if (updated) {
      setTasks((current) => current.map((t) => (t._id === task._id ? updated : t)))
    }
  }

  async function handleDelete(task) {
    const result = await run(() => deleteTask(task._id))
    if (result) {
      setTasks((current) => current.filter((t) => t._id !== task._id))
      setAlert({ ok: true, status: 200, text: `Task deleted: ${task.title}` })
    }
  }

  return (
    <section className="card">
      <div className="card-header">
        <h1>My tasks</h1>
        <button className="secondary small" onClick={loadTasks} disabled={busy}>Refresh</button>
      </div>
      <Alert alert={alert} />

      <TaskForm onAdd={handleAdd} disabled={busy} />

      {tasks === null ? (
        <Loader text="Tasks load ho rahe hain…" />
      ) : tasks.length === 0 ? (
        <p className="muted empty">Koi task nahi hai — upar se naya add karein.</p>
      ) : (
        <ul className="tasks">
          {tasks.map((task) => (
            <TaskItem key={task._id} task={task} onToggle={handleToggle} onDelete={handleDelete} disabled={busy} />
          ))}
        </ul>
      )}
    </section>
  )
}
