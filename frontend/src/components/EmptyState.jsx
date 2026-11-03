// khaali list ki jagah — halka icon (rangeen dabbe ke baghair), ek line heading aur chhota sa rasta
export default function EmptyState({ icon: Icon, title, text }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <Icon className="mb-3 size-5 text-muted" />
      <p className="text-sm font-medium">{title}</p>
      {text && <p className="mt-1 max-w-xs text-small text-muted">{text}</p>}
    </div>
  )
}
