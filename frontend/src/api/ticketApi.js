// support tickets — token axios instance khud lagata hai (/tickets auth route nahi)
import api from './axios'

export async function getTickets() {
  const { data } = await api.get('/tickets')
  return data.tickets
}

// POST /tickets — multipart: title, description + 0–3 files (field "attachments"); naya ticket lautata hai
export async function createTicket({ title, description, files }) {
  const form = new FormData()
  // text fields pehle — backend Multer ke baad hi req.body padhta hai, order se farq nahi, bas saaf rahe
  form.append('title', title)
  form.append('description', description)
  for (const file of files) {
    form.append('attachments', file)
  }
  // instance ka default "application/json" hai — us par axios FormData ko JSON bana deta (files gayab)
  const { data } = await api.post('/tickets', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.ticket
}

// attachment download — <a href> Authorization header nahi bhej sakta, is liye axios se blob lo aur browser ko do
export async function downloadAttachment(ticketId, attachment) {
  try {
    const { data } = await api.get(`/tickets/${ticketId}/attachments/${attachment._id}`, { responseType: 'blob' })
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url
    a.download = attachment.originalName
    document.body.append(a)
    a.click()
    a.remove()
    // foran revoke karne par kuch browsers (Firefox) download shuru hi nahi karte
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (error) {
    // responseType "blob" — error ka { message } bhi Blob mein aata hai; toAlert ke liye JSON bana do
    if (error.response?.data instanceof Blob) {
      try {
        error.response.data = JSON.parse(await error.response.data.text())
      } catch {
        error.response.data = {}
      }
    }
    throw error
  }
}
