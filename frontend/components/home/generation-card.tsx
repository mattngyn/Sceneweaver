import Link from "next/link"
import { ChevronDown, Clock3, FileText, Volume2, WandSparkles } from "lucide-react"

import type {
  GenerationDetail,
  GenerationStatus,
  MomentDetail,
} from "@/lib/api/types"

type GenerationCardProps = {
  generation: GenerationDetail
}

const generationStatusStyles: Record<
  GenerationStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Pending",
    className: "border-slate-400/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  },
  extracting: {
    label: "Extracting",
    className: "border-sky-500/30 bg-sky-500/12 text-sky-700 dark:text-sky-300",
  },
  processing: {
    label: "Processing",
    className: "border-amber-500/30 bg-amber-500/12 text-amber-700 dark:text-amber-300",
  },
  complete: {
    label: "Complete",
    className:
      "border-emerald-500/30 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  },
  failed: {
    label: "Failed",
    className: "border-rose-500/30 bg-rose-500/12 text-rose-700 dark:text-rose-300",
  },
}

const momentStatusStyles: Record<
  GenerationStatus,
  { label: string; className: string }
> = generationStatusStyles

function formatTimestamp(value: string) {
  const date = new Date(`${value}Z`)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

function MomentRow({
  generationId,
  moment,
}: {
  generationId: string
  moment: MomentDetail
}) {
  const sceneStatus = momentStatusStyles[moment.scene_status]
  const audioStatus = momentStatusStyles[moment.audio_status]

  return (
    <li className="rounded-[22px] border border-black/8 bg-white/70 p-4 dark:border-white/8 dark:bg-white/4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="text-[11px] font-semibold tracking-[0.24em] uppercase text-slate-500 dark:text-slate-400">
              Moment {moment.moment_index}
            </div>
            <h4 className="text-base font-semibold text-slate-950 dark:text-white">
              {moment.title}
            </h4>
            {moment.page_reference ? (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {moment.page_reference}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.2em] uppercase ${sceneStatus.className}`}
            >
              Scene {sceneStatus.label}
            </span>
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.2em] uppercase ${audioStatus.className}`}
            >
              Audio {audioStatus.label}
            </span>
          </div>
        </div>

        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
          {moment.narration_text}
        </p>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div className="inline-flex items-center gap-1.5">
            <WandSparkles className="size-3.5" />
            {moment.scene_asset_format ? moment.scene_asset_format.toUpperCase() : "No scene asset yet"}
          </div>
          <div className="inline-flex items-center gap-1.5">
            <Volume2 className="size-3.5" />
            {moment.audio_url ? "Audio ready" : "Audio unavailable"}
          </div>
        </div>
          <Link
            href={`/scenes/${generationId}/${moment.moment_index}`}
            className="inline-flex items-center rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold tracking-[0.18em] uppercase text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-200 dark:hover:bg-slate-950"
          >
            Open scene
          </Link>
        </div>
      </div>
    </li>
  )
}

export function GenerationCard({ generation }: GenerationCardProps) {
  const status = generationStatusStyles[generation.status]
  const safeTitle = generation.title || "Untitled generation"

  return (
    <details className="group rounded-[28px] border border-white/50 bg-white/75 p-5 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.4)] backdrop-blur open:bg-white/85 dark:border-white/10 dark:bg-white/5 dark:open:bg-white/7">
      <summary className="list-none cursor-pointer">
        <div className="flex flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.24em] uppercase ${status.className}`}
                >
                  {status.label}
                </span>
                <span className="inline-flex items-center rounded-full border border-black/10 bg-black/3 px-3 py-1 text-[11px] font-semibold tracking-[0.2em] uppercase text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                  {generation.moments.length} moments
                </span>
              </div>

              <div>
                <h3 className="text-lg font-semibold tracking-tight text-foreground">
                  {safeTitle}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <Clock3 className="size-3.5" />
                    {formatTimestamp(generation.created_at)}
                  </span>
                  {generation.source_filename ? (
                    <span className="inline-flex items-center gap-2">
                      <FileText className="size-3.5" />
                      {generation.source_filename}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
              <span>View moments</span>
              <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
            </div>
          </div>

          <p className="max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Expand to inspect the extracted moments, scene status, and narration readiness for this generation.
          </p>
        </div>
      </summary>

      <div className="mt-5 border-t border-black/8 pt-5 dark:border-white/8">
        {generation.moments.length > 0 ? (
          <ul className="space-y-3">
            {generation.moments.map((moment) => (
              <MomentRow
                key={moment.moment_index}
                generationId={generation.id}
                moment={moment}
              />
            ))}
          </ul>
        ) : (
          <div className="rounded-[22px] border border-dashed border-black/10 bg-black/3 px-4 py-5 text-sm text-slate-600 dark:border-white/10 dark:bg-white/4 dark:text-slate-300">
            No moments have been extracted for this generation yet.
          </div>
        )}
      </div>
    </details>
  )
}
