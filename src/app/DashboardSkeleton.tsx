export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="h-8 w-48 bg-court-border/50 rounded animate-pulse" />
        <div className="flex gap-4">
          <div className="h-10 w-32 bg-court-border/50 rounded animate-pulse" />
          <div className="h-10 w-32 bg-court-border/50 rounded animate-pulse" />
          <div className="h-10 w-40 bg-court-border/50 rounded animate-pulse" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="card">
            <div className="flex items-center justify-between">
              <div className="h-5 w-32 bg-court-border/50 rounded animate-pulse" />
              <div className="h-8 w-8 bg-court-border/50 rounded animate-pulse" />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="p-3 bg-court-bg/50 rounded-lg">
                  <div className="h-6 w-16 bg-court-border/50 rounded animate-pulse mx-auto mb-1" />
                  <div className="h-3 w-20 bg-court-border/50 rounded animate-pulse mx-auto" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <div className="h-6 w-40 bg-court-border/50 rounded animate-pulse" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card">
              <div className="h-4 w-full bg-court-border/50 rounded animate-pulse mb-2" />
              <div className="h-6 w-3/4 bg-court-border/50 rounded animate-pulse mb-4" />
              <div className="grid grid-cols-3 gap-3">
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="p-3 bg-court-bg/50 rounded-lg">
                    <div className="h-8 w-full bg-court-border/50 rounded animate-pulse mb-1" />
                    <div className="h-3 w-20 bg-court-border/50 rounded animate-pulse mx-auto" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="h-6 w-48 bg-court-border/50 rounded animate-pulse" />
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-4 w-24 bg-court-border/50 rounded animate-pulse" />
                  <div className="h-5 w-12 bg-court-border/50 rounded animate-pulse" />
                </div>
                <div className="h-6 w-20 bg-court-border/50 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}