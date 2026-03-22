import { FileText, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"

export function UploadPanel() {
  return (
    <section className="relative overflow-hidden rounded-[32px] border border-slate-900/10 bg-[linear-gradient(140deg,rgba(255,250,245,0.96),rgba(255,255,255,0.92)_55%,rgba(240,249,255,0.92))] p-6 shadow-[0_26px_90px_-54px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-[linear-gradient(140deg,rgba(15,23,42,0.98),rgba(15,23,42,0.94)_55%,rgba(8,47,73,0.92))] sm:p-8">
      <div className="absolute -top-16 right-0 h-56 w-56 rounded-full bg-amber-400/25 blur-3xl dark:bg-amber-300/10" />
      <div className="absolute bottom-0 left-0 h-48 w-48 rounded-full bg-sky-400/20 blur-3xl dark:bg-sky-300/10" />

      <div className="relative space-y-6">
        <div className="space-y-2">
          <div className="text-xs font-semibold tracking-[0.28em] uppercase text-slate-500 dark:text-slate-400">
            New generation
          </div>
          <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
            Upload a PDF
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Generate a new audiobook scene.
          </p>
        </div>

        <div className="rounded-[28px] border border-dashed border-slate-900/15 bg-white/75 p-5 backdrop-blur dark:border-white/15 dark:bg-slate-950/35">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-slate-950 text-white dark:bg-white dark:text-slate-950">
                <Upload className="size-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-950 dark:text-white">
                  Drag a PDF here
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Or choose a file to preview the flow.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" className="rounded-full px-5">
                Choose PDF
              </Button>
              <Button variant="outline" size="lg" className="rounded-full px-5">
                Sample
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/8">
            <FileText className="size-4" />
            PDF
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/8">
            Backend connected
          </div>
        </div>
      </div>
    </section>
  )
}
