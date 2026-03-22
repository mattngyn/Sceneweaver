import Link from "next/link"
import { ArrowLeft, ChevronLeft, ChevronRight, FileAudio2, Layers3 } from "lucide-react"
import { notFound } from "next/navigation"

import { AudioPlayer } from "@/components/viewer/audio-player"
import { SceneViewer } from "@/components/viewer/scene-viewer"
import {
  buildBackendUrl,
  getGeneration,
  getMoment,
} from "@/lib/api/generations"

type ScenePageProps = {
  params: Promise<{
    genId: string
    momentIndex: string
  }>
}

function statusTone(status: string) {
  switch (status) {
    case "complete":
      return "border-emerald-500/30 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
    case "failed":
      return "border-rose-500/30 bg-rose-500/12 text-rose-700 dark:text-rose-300"
    case "processing":
    case "extracting":
      return "border-amber-500/30 bg-amber-500/12 text-amber-700 dark:text-amber-300"
    default:
      return "border-slate-400/30 bg-slate-500/10 text-slate-700 dark:text-slate-300"
  }
}

export default async function ScenePage({ params }: ScenePageProps) {
  const { genId, momentIndex } = await params
  const momentNumber = Number(momentIndex)

  if (!Number.isInteger(momentNumber) || momentNumber < 1) {
    notFound()
  }

  const [generation, moment] = await Promise.all([
    getGeneration(genId),
    getMoment(genId, momentNumber),
  ]).catch(() => [null, null] as const)

  if (!generation || !moment) {
    notFound()
  }

  const currentIndex = generation.moments.findIndex(
    (candidate) => candidate.moment_index === momentNumber
  )
  const previousMoment = currentIndex > 0 ? generation.moments[currentIndex - 1] : null
  const nextMoment =
    currentIndex >= 0 && currentIndex < generation.moments.length - 1
      ? generation.moments[currentIndex + 1]
      : null

  const sceneUrl = moment.scene_asset_url
    ? buildBackendUrl(moment.scene_asset_url)
    : null
  const audioUrl = buildBackendUrl(
    `/api/generations/${genId}/scenes/${momentNumber}/audio`
  )

  return (
    <main className="min-h-svh bg-[linear-gradient(180deg,rgba(248,250,252,1),rgba(241,245,249,0.92))] px-4 py-6 dark:bg-[linear-gradient(180deg,rgba(2,6,23,1),rgba(15,23,42,0.96))] sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/75 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-white dark:border-white/10 dark:bg-white/6 dark:text-slate-200 dark:hover:bg-white/10"
          >
            <ArrowLeft className="size-4" />
            Back to generations
          </Link>

          <div className="flex flex-wrap gap-2">
            {previousMoment ? (
              <Link
                href={`/scenes/${genId}/${previousMoment.moment_index}`}
                className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/75 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-white dark:border-white/10 dark:bg-white/6 dark:text-slate-200 dark:hover:bg-white/10"
              >
                <ChevronLeft className="size-4" />
                Previous
              </Link>
            ) : null}
            {nextMoment ? (
              <Link
                href={`/scenes/${genId}/${nextMoment.moment_index}`}
                className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/75 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-white dark:border-white/10 dark:bg-white/6 dark:text-slate-200 dark:hover:bg-white/10"
              >
                Next
                <ChevronRight className="size-4" />
              </Link>
            ) : null}
          </div>
        </div>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_380px]">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-xs font-semibold tracking-[0.28em] uppercase text-slate-500 dark:text-slate-400">
                {generation.title || "Untitled generation"}
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                {moment.title}
              </h1>
            </div>

            <SceneViewer
              assetUrl={moment.scene_status === "complete" ? sceneUrl : null}
              assetFormat={moment.scene_asset_format}
              sceneStatus={moment.scene_status}
            />
          </div>

          <aside className="space-y-4">
            <section className="rounded-[28px] border border-white/50 bg-white/75 p-5 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.4)] backdrop-blur dark:border-white/10 dark:bg-white/5">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.22em] uppercase ${statusTone(moment.scene_status)}`}
                  >
                    Scene {moment.scene_status}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.22em] uppercase ${statusTone(moment.audio_status)}`}
                  >
                    Audio {moment.audio_status}
                  </span>
                </div>

                <div className="space-y-2">
                  <h2 className="text-sm font-semibold tracking-[0.22em] uppercase text-slate-500 dark:text-slate-400">
                    Scene description
                  </h2>
                  <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {moment.scene_description}
                  </p>
                </div>

                <div className="space-y-2">
                  <h2 className="text-sm font-semibold tracking-[0.22em] uppercase text-slate-500 dark:text-slate-400">
                    Narration
                  </h2>
                  <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {moment.narration_text}
                  </p>
                </div>

                <div className="grid gap-3 rounded-[22px] border border-black/8 bg-black/3 p-4 text-sm dark:border-white/8 dark:bg-white/4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400">
                      <Layers3 className="size-4" />
                      Moment index
                    </span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {moment.moment_index}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500 dark:text-slate-400">Tone</span>
                    <span className="font-medium capitalize text-slate-900 dark:text-white">
                      {moment.emotional_tone}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500 dark:text-slate-400">Page reference</span>
                    <span className="text-right font-medium text-slate-900 dark:text-white">
                      {moment.page_reference ?? "Unavailable"}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-white/50 bg-white/75 p-5 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.4)] backdrop-blur dark:border-white/10 dark:bg-white/5">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <FileAudio2 className="size-4 text-slate-500 dark:text-slate-400" />
                  <h2 className="text-base font-semibold text-slate-950 dark:text-white">
                    Audio
                  </h2>
                </div>

                {moment.audio_status === "complete" ? (
                  <AudioPlayer src={audioUrl} />
                ) : (
                  <div className="rounded-[20px] border border-dashed border-black/10 bg-black/3 px-4 py-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/4 dark:text-slate-300">
                    {moment.audio_status === "failed"
                      ? "Narration generation failed for this moment."
                      : "Narration is not ready yet."}
                  </div>
                )}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  )
}
