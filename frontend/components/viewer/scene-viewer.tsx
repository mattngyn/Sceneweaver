"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { AlertCircle, Box, Download, ExternalLink, LoaderCircle } from "lucide-react"

type SceneViewerProps = {
  assetUrl: string | null
  assetFormat: string | null
  sceneStatus: string
}

type ViewerState = "idle" | "loading" | "ready" | "error"

type GaussianViewer = {
  addSplatScene: (
    path: string,
    options?: Record<string, unknown>
  ) => Promise<void>
  start: () => void
  stop: () => void
  dispose: () => Promise<void>
}

export function SceneViewer({
  assetUrl,
  assetFormat,
  sceneStatus,
}: SceneViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [viewerState, setViewerState] = useState<ViewerState>("idle")
  const [viewerError, setViewerError] = useState<string | null>(null)

  useEffect(() => {
    if (!containerRef.current || !assetUrl || sceneStatus !== "complete") {
      return
    }

    let mounted = true
    const container = containerRef.current
    const sceneAssetUrl = assetUrl
    let renderer: import("three").WebGLRenderer | null = null
    let viewer: GaussianViewer | null = null
    let resizeObserver: ResizeObserver | null = null

    async function startViewer() {
      setViewerState("loading")
      setViewerError(null)

      if (!container) {
        return
      }

      const [{ Viewer, SceneFormat }, THREE] = await Promise.all([
        import("@mkkellogg/gaussian-splats-3d"),
        import("three"),
      ])

      const webglRenderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: true,
      })
      renderer = webglRenderer

      webglRenderer.setClearAlpha(0)
      container.appendChild(webglRenderer.domElement)

      const resize = () => {
        const width = Math.max(container.clientWidth, 1)
        const height = Math.max(container.clientHeight, 1)
        webglRenderer.setSize(width, height)
      }

      resize()

      resizeObserver = new ResizeObserver(resize)
      resizeObserver.observe(container)

      viewer = new Viewer({
        rootElement: container,
        renderer: webglRenderer,
        sharedMemoryForWorkers: false,
        gpuAcceleratedSort: false,
        cameraUp: [0, 1, 0],
        initialCameraPosition: [3, 2, 8],
        initialCameraLookAt: [0, 0, 0],
      })

      try {
        await viewer.addSplatScene(sceneAssetUrl, {
          format: SceneFormat.Ply,
          showLoadingUI: false,
          splatAlphaRemovalThreshold: 5,
        })

        viewer.start()

        if (mounted) {
          setViewerState("ready")
        }
      } catch (error) {
        if (mounted) {
          setViewerState("error")
          setViewerError(
            error instanceof Error ? error.message : "Failed to load the scene asset."
          )
        }
      }
    }

    void startViewer()

    return () => {
      mounted = false
      resizeObserver?.disconnect()
      viewer?.stop()
      void viewer?.dispose().catch(() => {
        // The library is not robust about nested root elements; cleanup continues below.
      })
      if (renderer && container) {
        renderer.dispose()
        if (renderer.domElement.parentElement === container) {
          container.removeChild(renderer.domElement)
        }
      }
    }
  }, [assetUrl, sceneStatus])

  if (sceneStatus !== "complete") {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-[30px] border border-dashed border-slate-900/12 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.12),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.84),rgba(248,250,252,0.94))] p-8 text-center dark:border-white/10 dark:bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.95),rgba(2,6,23,0.98))]">
        <div className="max-w-md space-y-3">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-slate-950 text-white dark:bg-white dark:text-slate-950">
            <LoaderCircle className="size-5 animate-spin" />
          </div>
          <h2 className="text-xl font-semibold text-slate-950 dark:text-white">
            Scene still processing
          </h2>
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
            This moment does not have a completed scene asset yet. Once the backend finishes generating it, the viewer will be able to load the file here.
          </p>
        </div>
      </div>
    )
  }

  if (!assetUrl) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-[30px] border border-rose-500/20 bg-rose-500/8 p-8 text-center text-rose-700 dark:text-rose-300">
        The scene is marked complete, but no asset URL was returned by the backend.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-[30px] border border-slate-900/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(248,250,252,0.96))] shadow-[0_28px_90px_-55px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.95),rgba(2,6,23,0.98))]">
      <div className="flex items-center justify-between gap-4 border-b border-black/8 px-5 py-4 dark:border-white/8">
        <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold tracking-[0.22em] uppercase text-slate-600 dark:border-white/10 dark:bg-white/8 dark:text-slate-300">
          <Box className="size-4" />
          {assetFormat ? assetFormat.toUpperCase() : "Scene asset"}
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={assetUrl}
            target="_blank"
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold tracking-[0.18em] uppercase text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-200 dark:hover:bg-slate-950"
          >
            Open asset
            <ExternalLink className="size-3.5" />
          </Link>
          <Link
            href={assetUrl}
            download
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold tracking-[0.18em] uppercase text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-200 dark:hover:bg-slate-950"
          >
            Download
            <Download className="size-3.5" />
          </Link>
        </div>
      </div>

      <div className="relative min-h-[520px] bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.16),transparent_30%)]">
        <div
          ref={containerRef}
          className="h-[520px] w-full"
        />

        {viewerState === "loading" ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/12 backdrop-blur-[1px] dark:bg-slate-950/35">
            <div className="rounded-full border border-black/10 bg-white/88 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-200">
              Loading scene...
            </div>
          </div>
        ) : null}

        {viewerState === "error" ? (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="max-w-md rounded-[24px] border border-rose-500/20 bg-white/92 p-5 text-center shadow-xl dark:bg-slate-950/92">
              <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-rose-500/12 text-rose-600 dark:text-rose-300">
                <AlertCircle className="size-5" />
              </div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                Viewer failed to load
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {viewerError ?? "The scene asset could not be rendered in the browser."}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
