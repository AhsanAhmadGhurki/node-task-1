// logged-in user ke apne kaam — token axios instance khud lagata hai (/user/... auth route nahi)
import api from './axios'

// POST /user/upload-avatar — multipart, field "avatar"; { message, avatar } lautata hai
export async function uploadAvatar(file) {
  const form = new FormData()
  form.append('avatar', file)
  // instance ka default "application/json" hai — us par axios FormData ko JSON bana deta (file gayab)
  // multipart batao; boundary browser khud lagata hai
  const { data } = await api.post('/user/upload-avatar', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}
