// task CRUD — token axios instance khud lagata hai, yahan sirf routes
import api from './axios'

export async function getTasks() {
  const { data } = await api.get('/tasks')
  return data
}

export async function createTask(title) {
  const { data } = await api.post('/tasks', { title })
  return data
}

// sirf bheji hui fields badalti hain (backend partial update karta hai) — jaise { completed: true }
export async function updateTask(id, changes) {
  const { data } = await api.put(`/tasks/${id}`, changes)
  return data
}

export async function deleteTask(id) {
  const { data } = await api.delete(`/tasks/${id}`)
  return data
}
