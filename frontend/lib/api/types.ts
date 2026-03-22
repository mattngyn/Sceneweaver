export type GenerationStatus =
  | "pending"
  | "extracting"
  | "processing"
  | "complete"
  | "failed"

export type AssetFormat = "spz" | "ply" | "splat"

export type MomentDetail = {
  moment_index: number
  title: string
  scene_description: string
  narration_text: string
  emotional_tone: string
  page_reference: string | null
  scene_status: GenerationStatus
  scene_asset_url: string | null
  scene_asset_format: AssetFormat | null
  audio_status: GenerationStatus
  audio_url: string | null
}

export type GenerationSummary = {
  id: string
  title: string
  status: GenerationStatus
  source_filename: string | null
  moment_count: number
  created_at: string
  updated_at: string
}

export type GenerationDetail = {
  id: string
  title: string
  status: GenerationStatus
  source_filename: string | null
  source_text: string
  moments: MomentDetail[]
  created_at: string
  updated_at: string
}

export type GenerationListResponse = {
  generations: GenerationSummary[]
}
