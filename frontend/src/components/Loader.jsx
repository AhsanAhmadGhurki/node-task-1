// load hote waqt chhota spinner
export default function Loader({ text = 'Loading…' }) {
  return (
    <div className="loader" role="status">
      <span className="spinner" aria-hidden="true" />
      <span className="muted">{text}</span>
    </div>
  )
}
