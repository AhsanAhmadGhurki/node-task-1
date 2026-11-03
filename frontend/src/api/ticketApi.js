// support tickets — token axios instance khud lagata hai (/tickets auth route nahi)
import api from './axios'

export async function getTickets() {
  const { data } = await api.get('/tickets')
  return data.tickets
}

// POST /tickets — multipart: title, description + 0–3 files (field "attachments"); naya ticket lautata hai
// onProgress(0–100) — 5 MB tak upload mein waqt lagta hai, user ko pata chale kitna gaya
export async function createTicket({ title, description, files }, onProgress) {
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
    onUploadProgress: (event) => event.total && onProgress?.(Math.round((event.loaded / event.total) * 100)),
  })
  return data.ticket
}

// attachment ka preview/download — api/fileApi.js (attachment._id hi fileId hai)
