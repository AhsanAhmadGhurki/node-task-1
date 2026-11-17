// tasks ki API calls — orgId na ho to personal (/tasks), ho to us workspace ke (/orgs/:orgId/tasks)
// personal routes task seedha lautate hain, org routes { tasks } / { task } mein — dono yahan ek shakal mein
import api from './axios'

const base = (orgId) => (orgId ? `/orgs/${orgId}/tasks` : '/tasks')

export async function getTasks(orgId) {
  const { data } = await api.get(base(orgId))
  return orgId ? data.tasks : data
}

export async function createTask(title, orgId) {
  const { data } = await api.post(base(orgId), { title })
  return orgId ? data.task : data
}

export async function updateTask(id, changes, orgId) {
  const { data } = await api.put(`${base(orgId)}/${id}`, changes)
  return orgId ? data.task : data
}

export async function deleteTask(id, orgId) {
  const { data } = await api.delete(`${base(orgId)}/${id}`)
  return data
}
