const pulse = 'animate-pulse rounded-xl bg-board-panel'

export function SummarySkeleton() {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className={`${pulse} h-[88px] sm:h-[100px]`} />
      ))}
    </div>
  )
}

export function FieldSkeleton() {
  return <div className={`${pulse} aspect-[800/475] w-full`} aria-hidden />
}

export function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-xl bg-board-panel p-5" aria-hidden>
      <div className="h-6 w-2/3 animate-pulse rounded bg-slate-700" />
      <div className="grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-700" />
        ))}
      </div>
      <div className="h-56 animate-pulse rounded-lg bg-slate-700" />
    </div>
  )
}
