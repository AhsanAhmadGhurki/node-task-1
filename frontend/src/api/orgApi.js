// orgs, members, invites, ownership — backend ke /orgs aur /invitations routes; token axios instance khud lagata hai
import api from './axios'

export async function listOrgs() {
  const { data } = await api.get('/orgs')
  return data
}

export async function createOrg(name) {
  const { data } = await api.post('/orgs', { name })
  return data
}

export async function renameOrg(orgId, name) {
  const { data } = await api.patch(`/orgs/${orgId}`, { name })
  return data
}

export async function deleteOrg(orgId) {
  const { data } = await api.delete(`/orgs/${orgId}`)
  return data
}

export async function listMembers(orgId) {
  const { data } = await api.get(`/orgs/${orgId}/members`)
  return data
}

export async function changeRole(orgId, userId, role) {
  const { data } = await api.patch(`/orgs/${orgId}/members/${userId}/role`, { role })
  return data
}

export async function removeMember(orgId, userId) {
  const { data } = await api.delete(`/orgs/${orgId}/members/${userId}`)
  return data
}

export async function leaveOrg(orgId) {
  const { data } = await api.post(`/orgs/${orgId}/leave`)
  return data
}

// password sirf is request mein jaata hai — kahin save nahi hota
export async function transferOwnership(orgId, newOwnerId, password) {
  const { data } = await api.post(`/orgs/${orgId}/transfer-ownership`, { newOwnerId, password })
  return data
}

export async function listInvitations(orgId) {
  const { data } = await api.get(`/orgs/${orgId}/invitations`)
  return data
}

export async function sendInvitation(orgId, email, role) {
  const { data } = await api.post(`/orgs/${orgId}/invitations`, { email, role })
  return data
}

export async function cancelInvitation(orgId, inviteId) {
  const { data } = await api.delete(`/orgs/${orgId}/invitations/${inviteId}`)
  return data
}

// email ke link wala token — login ke bina bhi chalta hai (sirf API key, jo proxy lagata hai)
export async function getInvitation(token) {
  const { data } = await api.get(`/invitations/${encodeURIComponent(token)}`)
  return data
}

export async function acceptInvitation(token) {
  const { data } = await api.post(`/invitations/${encodeURIComponent(token)}/accept`)
  return data
}
