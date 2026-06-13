export default function RootLoading() {
  return (
    <div className="min-h-screen bg-warm-50 flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="text-3xl animate-pulse">⏳</div>
        <p className="text-warm-500 text-sm">読み込み中...</p>
      </div>
    </div>
  )
}
