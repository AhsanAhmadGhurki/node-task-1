// har response ka status + message — taake masla foran nazar aaye
// alert = { ok, status, text } (helpers.toAlert se ya khud banaya hua)
export default function Alert({ alert }) {
  if (!alert) return null

  return (
    <div className={`message ${alert.ok ? 'success' : 'error'}`} role={alert.ok ? 'status' : 'alert'}>
      <strong>{alert.status || 'ERR'}</strong> · {alert.text}
    </div>
  )
}
