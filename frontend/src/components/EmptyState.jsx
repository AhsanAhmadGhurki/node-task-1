// khaali list ki jagah — icon, ek line heading aur chhota sa rasta
export default function EmptyState({ icon: Icon, title, text }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary-text">
        <Icon className="size-6" />
      </span>
      <p className="font-medium">{title}</p>
      {text && <p className="mt-1 max-w-xs text-sm text-muted">{text}</p>}
    </div>
  )
}
