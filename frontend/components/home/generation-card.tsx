"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Play } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

import type { MomentDetail } from "@/lib/api/types"
import { buildBackendUrl } from "@/lib/api/generations"

export type StoryMoment = MomentDetail & {
  generationId: string
}

type StoryGroupProps = {
  title: string
  moments: StoryMoment[]
  darkMode?: boolean
}

// Shared transition state
let globalSetTransition: ((v: boolean) => void) | null = null

export function SceneTransitionOverlay() {
  const [active, setActive] = useState(false)

  useEffect(() => {
    globalSetTransition = setActive
    return () => { globalSetTransition = null }
  }, [])

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          className="fixed inset-0 z-[100]"
          style={{ background: "linear-gradient(180deg, #0a0e1a 0%, #111827 40%, #1a2035 70%, #1e2840 100%)" }}
        />
      )}
    </AnimatePresence>
  )
}

// ── Thumbnail capture: one at a time, render → screenshot → teardown ──

type CaptureRequest = {
  key: string
  url: string
  noFlip: boolean
  resolve: (dataUrl: string) => void
  reject: (err: Error) => void
}

const captureQueue: CaptureRequest[] = []
let capturing = false

async function processQueue() {
  if (capturing || captureQueue.length === 0) return
  capturing = true

  const req = captureQueue.shift()!

  try {
    const [THREE, Spark] = await Promise.all([
      import("three"),
      import("@sparkjsdev/spark"),
    ])

    const canvas = document.createElement("canvas")
    canvas.width = 480
    canvas.height = 360
    // Keep it off-screen but in DOM so WebGL works
    canvas.style.cssText = "position:fixed;left:-9999px;top:0;width:480px;height:360px;pointer-events:none;"
    document.body.appendChild(canvas)

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      preserveDrawingBuffer: true,
    })
    renderer.setSize(480, 360)
    renderer.setClearColor(0x111111, 1)

    const camera = new THREE.PerspectiveCamera(65, 480 / 360, 0.1, 1000)
    camera.position.set(0, req.noFlip ? 1.2 : 0, req.noFlip ? 1.0 : 0)
    camera.rotation.order = "YXZ"
    if (!req.noFlip) {
      camera.lookAt(0, 0, 0)
    }

    const scene = new THREE.Scene()
    const spark = new Spark.SparkRenderer({ renderer, preUpdate: false })
    scene.add(spark)

    const splat = new Spark.SplatMesh({
      url: req.url,
      fileType: Spark.SplatFileType.SPZ,
    })
    await splat.initialized

    splat.rotation.set(req.noFlip ? 0 : Math.PI, 0, 0)
    splat.updateMatrix()
    scene.add(splat)

    // Use setAnimationLoop for proper Spark.js rendering pipeline
    let frameCount = 0
    await new Promise<void>((resolve) => {
      renderer.setAnimationLoop(() => {
        renderer.render(scene, camera)
        frameCount++
        // Run for ~200 frames (~3.3s at 60fps)
        if (frameCount >= 200) {
          renderer.setAnimationLoop(null)
          resolve()
        }
      })
    })

    // One more synchronous render right before capture
    renderer.render(scene, camera)

    // Read pixels from WebGL to verify content
    const gl = renderer.getContext()
    const pixel = new Uint8Array(4)
    gl.readPixels(240, 180, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel)
    const hasContent = pixel[0] > 20 || pixel[1] > 20 || pixel[2] > 20

    const dataUrl = canvas.toDataURL("image/jpeg", 0.8)

    // Full teardown
    scene.remove(splat)
    splat.dispose()
    scene.remove(spark)
    renderer.setAnimationLoop(null)
    renderer.dispose()
    renderer.forceContextLoss()
    document.body.removeChild(canvas)

    // Always save — preserveDrawingBuffer ensures toDataURL works
    localStorage.setItem(`scene-thumb-${req.key}`, dataUrl)
    req.resolve(dataUrl)
  } catch (err) {
    req.reject(err instanceof Error ? err : new Error(String(err)))
  }

  capturing = false
  // Wait before processing next to let GPU fully reclaim
  setTimeout(processQueue, 200)
}

function requestThumbnail(key: string, url: string, noFlip: boolean): Promise<string> {
  // Check cache first
  const cached = localStorage.getItem(`scene-thumb-${key}`)
  if (cached) return Promise.resolve(cached)

  return new Promise((resolve, reject) => {
    captureQueue.push({ key, url, noFlip, resolve, reject })
    processQueue()
  })
}

// ── Card component ──

function isGreenDoor(m: StoryMoment): boolean {
  return m.title.toLowerCase().includes("green door") || m.title.toLowerCase().includes("mark on")
}

function MomentCard({
  moment,
  featured = false,
}: {
  moment: StoryMoment
  featured?: boolean
}) {
  const router = useRouter()
  const [thumbnail, setThumbnail] = useState<string | null>(null)
  const requestedRef = useRef(false)

  useEffect(() => {
    if (requestedRef.current) return
    if (moment.scene_status !== "complete" || !moment.scene_asset_url) return
    requestedRef.current = true

    const key = `${moment.generationId}-${moment.moment_index}`
    const url = buildBackendUrl(moment.scene_asset_url)

    requestThumbnail(key, url, isGreenDoor(moment))
      .then(setThumbnail)
      .catch(() => {})
  }, [moment])

  const handleClick = useCallback(() => {
    globalSetTransition?.(true)
    setTimeout(() => {
      router.push(`/scenes/${moment.generationId}/${moment.moment_index}`)
    }, 900)
  }, [router, moment.generationId, moment.moment_index])

  return (
    <div
      onClick={handleClick}
      className={`group relative flex w-full cursor-pointer flex-col justify-end overflow-hidden rounded-2xl transition-all duration-300 hover:shadow-xl hover:shadow-black/10 ${
        featured ? "aspect-[16/9]" : "aspect-[4/3]"
      }`}
      style={{ minHeight: featured ? 320 : 220 }}
    >
      <div className="absolute inset-0 overflow-hidden rounded-2xl bg-neutral-900">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={moment.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900">
            <div className="flex size-10 items-center justify-center rounded-full bg-white/5">
              <Play className="size-4 text-white/20" strokeWidth={1.5} />
            </div>
          </div>
        )}
      </div>

      <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/10" />

      <div className="relative z-10 bg-gradient-to-t from-black/70 via-black/35 to-transparent p-5 pt-16">
        <p className={`font-semibold leading-snug text-white drop-shadow-sm ${featured ? "text-lg" : "text-[14px]"}`}>
          {moment.title}
        </p>
        {moment.scene_description && (
          <p className={`mt-1 text-[13px] leading-relaxed text-white/55 ${featured ? "line-clamp-2" : "line-clamp-1"}`}>
            {moment.scene_description}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Story group ──

export function StoryGroup({ title, moments, darkMode = false }: StoryGroupProps) {
  const featured = moments[0]
  const rest = moments.slice(1)

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between">
        <h3 className={`font-heading text-2xl tracking-[-0.3px] sm:text-3xl ${darkMode ? "text-white" : "text-foreground"}`}>
          {title}
        </h3>
        <span className={`text-[13px] ${darkMode ? "text-white/40" : "text-muted-foreground"}`}>
          {moments.length} {moments.length === 1 ? "scene" : "scenes"}
        </span>
      </div>

      {moments.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {featured && (
            <div className={rest.length > 0 ? "lg:row-span-2" : ""}>
              <MomentCard moment={featured} featured />
            </div>
          )}
          {rest.map((moment) => (
            <MomentCard key={`${moment.generationId}-${moment.moment_index}`} moment={moment} />
          ))}
        </div>
      ) : (
        <div className={`flex items-center justify-center rounded-2xl border p-10 text-sm ${
          darkMode ? "border-white/10 bg-white/5 text-white/40" : "card-surface text-muted-foreground"
        }`}>
          No moments generated yet.
        </div>
      )}
    </div>
  )
}
