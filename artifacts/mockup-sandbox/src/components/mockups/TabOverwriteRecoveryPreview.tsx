import { useState } from "react";
import { Clock3, FileClock, RotateCcw, ShieldCheck, X } from "lucide-react";

export default function TabOverwriteRecoveryPreview() {
  const [open, setOpen] = useState(true);
  const [restored, setRestored] = useState(false);

  return (
    <main className="min-h-screen bg-[#eef1f5] px-4 py-8 text-[#1d2733] sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 border-t-[3px] border-[#0070c0] bg-white px-5 py-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-[#526173]">
            Field Training Officer Portal
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 rounded-sm border border-red-300 bg-red-50 p-3 text-sm text-red-900">
            <FileClock className="h-5 w-5 shrink-0" />
            <span className="flex-1">
              <b>This workspace was replaced in another tab.</b> A local recovery
              copy is available for review.
            </span>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-sm border border-red-800 px-3 py-2 font-semibold underline"
            >
              Review recovery copy
            </button>
          </div>
          <div className="mt-6 h-10 w-48 rounded-sm bg-[#dfe5ec]" />
          <div className="mt-4 h-32 rounded-sm border border-[#d6dce4] bg-[#f8f9fb]" />
        </div>

        {open && !restored && (
          <div className="fixed inset-0 z-10 flex items-center justify-center bg-[#172b46]/45 p-4">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="recovery-title"
              className="w-full max-w-lg rounded-sm border border-[#cbd3dc] bg-white shadow-xl"
            >
              <header className="flex items-start gap-3 border-b border-[#d9dfe6] px-5 py-4">
                <div className="mt-0.5 rounded-sm bg-[#e8f2fb] p-2 text-[#075a9c]">
                  <FileClock className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 id="recovery-title" className="text-lg font-bold">
                    Review the previous version
                  </h1>
                  <p className="mt-1 text-sm text-[#526173]">
                    This encrypted copy was saved before the other tab was replaced.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close recovery review"
                  className="rounded-sm p-1 text-[#526173] hover:bg-[#eef1f5]"
                >
                  <X className="h-5 w-5" />
                </button>
              </header>

              <div className="space-y-4 px-5 py-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-sm border border-[#d9dfe6] p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-[#526173]">
                      Captured
                    </div>
                    <div className="mt-1 font-semibold">Today, 10:42 AM</div>
                  </div>
                  <div className="rounded-sm border border-[#d9dfe6] p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-[#526173]">
                      Contents
                    </div>
                    <div className="mt-1 font-semibold">Unsaved local changes</div>
                  </div>
                </div>

                <div className="rounded-sm border border-[#bad6ed] bg-[#f2f8fd] p-3 text-sm leading-5 text-[#233b51]">
                  <div className="flex gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#075a9c]" />
                    <p>
                      Restoring replaces the current local workspace with this
                      version. It does not upload records or change agency-sync
                      status.
                    </p>
                  </div>
                </div>

                <p className="flex gap-2 text-sm leading-5 text-[#526173]">
                  <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    This recovery copy expires in 7 days. It is deleted sooner if
                    you restore it.
                  </span>
                </p>
              </div>

              <footer className="flex flex-col-reverse gap-2 border-t border-[#d9dfe6] px-5 py-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="min-h-10 rounded-sm border border-[#8995a3] px-4 text-sm font-semibold hover:bg-[#f4f6f8]"
                >
                  Keep current version
                </button>
                <button
                  type="button"
                  onClick={() => setRestored(true)}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-sm bg-[#075a9c] px-4 text-sm font-semibold text-white hover:bg-[#064a80]"
                >
                  <RotateCcw className="h-4 w-4" />
                  Restore this version
                </button>
              </footer>
            </section>
          </div>
        )}

        {restored && (
          <div
            role="status"
            className="fixed inset-x-4 bottom-6 z-20 mx-auto max-w-xl rounded-sm border border-green-700 bg-white p-4 text-sm shadow-lg"
          >
            Recovery copy restored locally. Agency-sync status was not changed.
          </div>
        )}

        <p className="mx-auto mt-5 max-w-2xl text-center text-xs text-[#526173]">
          Preview only · fictional data · this screen does not read or restore portal records
        </p>
      </div>
    </main>
  );
}
