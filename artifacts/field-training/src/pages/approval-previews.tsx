/** Public development-only surface: no session, workspace, vault or API calls. */
export default function ApprovalPreviews() {
  const previewUrl = new URL("/api/preview?component=PacketReviewPreview", window.location.origin).href;
  return <main className="flex min-h-screen flex-col bg-background">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-card p-3">
      <div>
        <h1 className="font-bold">Packet review approval preview</h1>
        <p className="text-sm text-muted-foreground">Fictional data only · No sign-in needed · No training-record access</p>
      </div>
      <a href={previewUrl} target="_blank" rel="noreferrer" className="rounded border px-3 py-2 text-sm font-semibold underline">
        Open preview in a separate tab
      </a>
    </header>
    <iframe title="Packet release and PO acknowledgment preview" src={previewUrl}
      className="min-h-[85vh] w-full flex-1 border-0" />
  </main>;
}
