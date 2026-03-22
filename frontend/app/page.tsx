import { Library, Plus } from "lucide-react"

import { GenerationCard } from "@/components/home/generation-card"
import { UploadPanel } from "@/components/home/upload-panel"
import { Button } from "@/components/ui/button"
import { getGeneration, listGenerations } from "@/lib/api/generations"
import type { GenerationDetail } from "@/lib/api/types"

async function loadGenerationsWithMoments(): Promise<{
  generations: GenerationDetail[]
  error: string | null
}> {
  try {
    const summaries = await listGenerations()
    const generations = await Promise.all(
      summaries.map((generation) => getGeneration(generation.id))
    )

    return { generations, error: null }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load generations from the backend."

    return { generations: [], error: message }
  }
}

export default async function Page() {
  const { generations, error } = await loadGenerationsWithMoments()

  return (
    <main className="min-h-svh bg-[linear-gradient(180deg,rgba(248,250,252,1),rgba(241,245,249,0.92))] px-4 py-6 dark:bg-[linear-gradient(180deg,rgba(2,6,23,1),rgba(15,23,42,0.96))] sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex items-center justify-between rounded-[24px] border border-white/40 bg-white/65 px-5 py-4 shadow-[0_14px_50px_-40px_rgba(15,23,42,0.4)] backdrop-blur dark:border-white/10 dark:bg-white/5">
          <div>
            <div className="text-xs font-semibold tracking-[0.3em] uppercase text-slate-500 dark:text-slate-400">
              HooReads
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button className="rounded-full px-4">
              <Plus className="size-4" />
              Upload
            </Button>
          </div>
        </header>

        <UploadPanel />

        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <Library className="size-4 text-slate-500 dark:text-slate-400" />
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                Generations
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Expand a generation to inspect every extracted moment and its scene/audio status.
              </p>
            </div>
          </div>

          {error ? (
            <div className="rounded-[28px] border border-rose-500/20 bg-rose-500/8 p-5 text-sm text-rose-700 dark:text-rose-300">
              {error}
            </div>
          ) : null}

          {!error && generations.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-slate-900/12 bg-white/60 p-6 text-sm text-slate-600 dark:border-white/10 dark:bg-white/4 dark:text-slate-300">
              No generations found in the backend yet.
            </div>
          ) : null}

          <div className="space-y-5">
            {generations.map((generation) => (
              <GenerationCard key={generation.id} generation={generation} />
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
