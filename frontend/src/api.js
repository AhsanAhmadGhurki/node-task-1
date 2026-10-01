// saari API calls yahan se — "/api" Vite proxy ke zariye backend tak jaata hai
export async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' }

  // login ke baad mila token — protected routes (/tasks) ke liye
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  try {
    const res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    // backend hamesha JSON bhejta hai — phir bhi khali/galat body par crash na ho
    const data = await res.json().catch(() => null)

    return { status: res.status, ok: res.ok, data }
  } catch {
    // backend band ho ya proxy na pahunch sake
    return { status: 0, ok: false, data: { message: 'Backend se connect nahi ho saka — kya backend chal raha hai?' } }
  }
}
