import Link from "next/link"
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react"
import { notFound } from "next/navigation"

import { AudioPlayer } from "@/components/viewer/audio-player"
import { SceneViewer } from "@/components/viewer/scene-viewer"
import { SceneBackground } from "@/components/viewer/scene-bg"
import { ScenePageContent } from "@/components/viewer/scene-page-content"
import {
  buildBackendUrl,
  getGeneration,
  getMoment,
} from "@/lib/api/generations"

function normalizeStoryTitle(title: string | null): string {
  return (title || "Untitled Story").trim()
}

function cleanMomentTitle(title: string): string {
  if (title.startsWith("he ")) return "T" + title.slice(1)
  return title
}

type ScenePageProps = {
  params: Promise<{
    genId: string
    momentIndex: string
  }>
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
  const previousMoment =
    currentIndex > 0 ? generation.moments[currentIndex - 1] : null
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

  const bookTitle = normalizeStoryTitle(generation.title || moment.title)
  const isGreenDoor = moment.title.toLowerCase().includes("green door") ||
    moment.title.toLowerCase().includes("mark on")

  return (
    <main className="relative min-h-svh">
      <SceneBackground />

      <ScenePageContent
        genId={genId}
        bookTitle={bookTitle}
        momentTitle={cleanMomentTitle(moment.title)}
        sceneUrl={moment.scene_status === "complete" ? sceneUrl : null}
        assetFormat={moment.scene_asset_format}
        sceneStatus={moment.scene_status}
        noFlip={isGreenDoor}
        audioUrl={moment.audio_status === "complete" ? audioUrl : null}
        previousMomentIndex={previousMoment?.moment_index ?? null}
        nextMomentIndex={nextMoment?.moment_index ?? null}
      />
    </main>
  )
}
