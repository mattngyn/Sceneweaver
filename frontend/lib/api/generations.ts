import type {
  GenerationDetail,
  GenerationListResponse,
  MomentDetail,
} from "@/lib/api/types"

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000"

export function buildBackendUrl(path: string) {
  return new URL(path, API_BASE_URL).toString()
}

async function readJson<T>(path: string): Promise<T> {
  const url = buildBackendUrl(path)
  let response: Response

  try {
    response = await fetch(url, {
      cache: "no-store",
    })
  } catch (error) {
    const detail = error instanceof Error ? ` ${error.message}` : ""
    throw new Error(`Could not reach backend at ${API_BASE_URL}.${detail}`.trim())
  }

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

export async function getMoment(genId: string, momentIndex: number) {
  return readJson<MomentDetail>(`/api/generations/${genId}/scenes/${momentIndex}`)
}
