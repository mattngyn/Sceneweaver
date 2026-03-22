import type {
  GenerationDetail,
  GenerationListResponse,
} from "@/lib/api/types"

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000"

function buildUrl(path: string) {
  return new URL(path, API_BASE_URL).toString()
}

async function readJson<T>(path: string): Promise<T> {
  const response = await fetch(buildUrl(path), {
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`Backend request failed: ${response.status} ${response.statusText}`)
  }

  return (await response.json()) as T
}

export async function listGenerations() {
  const payload = await readJson<GenerationListResponse>("/api/generations")
  return payload.generations
}

export async function getGeneration(genId: string) {
  return readJson<GenerationDetail>(`/api/generations/${genId}`)
}
