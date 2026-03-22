import Link from "next/link"
import { ArrowLeft, Plus } from "lucide-react"

import { StoryGroup, type StoryMoment } from "@/components/home/generation-card"
import { DashboardBackground } from "@/components/home/dashboard-bg"
import { DashboardContent } from "@/components/home/dashboard-content"
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
      error instanceof Error
        ? error.message
        : "Failed to load generations from the backend."
    return { generations: [], error: message }
  }
}

function normalizeStoryTitle(title: string | null): string {
  return (title || "Untitled Story").trim()
}

export default async function DashboardPage() {
  const { generations, error } = await loadGenerationsWithMoments()

  const stories = generations.reduce<
    Record<string, { title: string; moments: StoryMoment[] }>
  >((acc, gen) => {
    const title = normalizeStoryTitle(gen.title)
    if (!acc[title]) acc[title] = { title, moments: [] }
    const enrichedMoments = gen.moments.map((m) => ({
      ...m,
      generationId: gen.id,
    }))
    acc[title].moments.push(...enrichedMoments)
    return acc
  }, {})

  const storyCount = Object.keys(stories).length
  const sceneCount = Object.values(stories).reduce(
    (sum, s) => sum + s.moments.length,
    0
  )

  return (
    <main className="relative min-h-svh">
      <DashboardBackground />

      <DashboardContent
        stories={Object.values(stories)}
        storyCount={storyCount}
        sceneCount={sceneCount}
        error={error}
      />
    </main>
  )
}
