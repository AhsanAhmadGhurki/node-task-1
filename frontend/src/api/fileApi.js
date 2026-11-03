// uploaded files (avatar, ticket attachments) — sab GET /files/:fileId se
// <img src> aur <a href> Authorization header nahi bhej sakte — is liye pehle token ke saath 10 minute ka
// signed link maango (POST /files/:fileId/signed-url), phir wahi link seedha <img>/<a> mein (bina token)
import api from './axios'

// fileId ki shakal (24 hex) — localStorage mein purani session ka avatar "/uploads/avatars/..." ho sakta hai, use mat maango
export function isFileId(value) {
  return typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value)
}

// { url, expiresAt } — url browser ke liye "/api/files/...?expires=&sig=" (Vite proxy API key lagata hai)
// owner na ho to 403, file na ho to 404 — JSON error, toAlert seedha padh leta hai
export async function getSignedUrl(fileId, { download = false } = {}) {
  const { data } = await api.post(`/files/${fileId}/signed-url`)
  return {
    url: `/api${data.url}${download ? '&download=1' : ''}`,
    expiresAt: new Date(data.expiresAt),
  }
}

// "Save as" — signed link par chhupa <a download> click: browser khud stream kar ke disk par likhta hai,
// file pehle JS memory (blob) mein nahi aati; backend ka "Content-Disposition: attachment" naam deta hai
export async function downloadFile(fileId, filename) {
  const { url } = await getSignedUrl(fileId, { download: true })
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.append(a)
  a.click()
  a.remove()
}
