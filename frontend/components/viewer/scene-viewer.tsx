"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  AlertCircle,
  Box,
  Download,
  ExternalLink,
  Headset,
  LoaderCircle,
  Maximize,
  Minimize,
  MousePointer2,
  Move3D,
} from "lucide-react"

type SceneViewerProps = {
  assetUrl: string | null
  assetFormat: string | null
  sceneStatus: string
  minimal?: boolean
  noFlip?: boolean
  thumbnailKey?: string
}

import { buildBackendUrl } from "@/lib/api/generations"

type ViewerState = "idle" | "loading" | "ready" | "error"

export function SceneViewer({
  assetUrl,
  assetFormat,
  sceneStatus,
  minimal = false,
  noFlip = false,
  thumbnailKey,
}: SceneViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const [viewerState, setViewerState] = useState<ViewerState>("idle")
  const [viewerError, setViewerError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [])

  const toggleFullscreen = () => {
    if (!wrapperRef.current) return

    if (!document.fullscreenElement) {
      wrapperRef.current.requestFullscreen().catch((err) => {
        console.error(
          `Error attempting to enable fullscreen mode: ${err.message} (${err.name})`
        )
      })
    } else {
      document.exitFullscreen()
    }
  }

  useEffect(() => {
    if (!containerRef.current || !assetUrl || sceneStatus !== "complete") {
      return
    }

    let mounted = true
    const container = containerRef.current
    const sceneAssetUrl = assetUrl
    let renderer: import("three").WebGLRenderer | null = null
    let camera: import("three").PerspectiveCamera | null = null
    let scene: import("three").Scene | null = null
    let splatMesh: import("@sparkjsdev/spark").SplatMesh | null = null
    let sparkRenderer: import("@sparkjsdev/spark").SparkRenderer | null = null
    let xrButton: HTMLElement | null = null
    let resizeObserver: ResizeObserver | null = null
    const pressedKeys = new Set<string>()
    let yaw = 0
    let pitch = 0
    let previousTime = 0
    let handleKeyDown: ((event: KeyboardEvent) => void) | null = null
    let handleKeyUp: ((event: KeyboardEvent) => void) | null = null
    let handleMouseMove: ((event: MouseEvent) => void) | null = null
    let handlePointerLockChange: (() => void) | null = null
    let handleClick: (() => void) | null = null

    async function startViewer() {
      setViewerState("loading")
      setViewerError(null)

      if (!container) {
        return
      }

      const [THREE, Spark] = await Promise.all([
        import("three"),
        import("@sparkjsdev/spark"),
      ])

      const webglRenderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: true,
        preserveDrawingBuffer: !!thumbnailKey,
      })
      renderer = webglRenderer
      webglRenderer.setClearAlpha(0)
      webglRenderer.xr.enabled = true
      container.appendChild(webglRenderer.domElement)

      const perspectiveCamera = new THREE.PerspectiveCamera(
        65,
        Math.max(container.clientWidth, 1) /
        Math.max(container.clientHeight, 1),
        0.1,
        1000
      )
      perspectiveCamera.position.set(0, noFlip ? 1.2 : 0, noFlip ? 1.0 : 0)
      perspectiveCamera.rotation.order = "YXZ"
      perspectiveCamera.up.set(0, 1, 0)
      perspectiveCamera.lookAt(0, 0, 0)
      if (noFlip) {
        perspectiveCamera.rotation.x = 0
      }
      camera = perspectiveCamera

      const threeScene = new THREE.Scene()
      scene = threeScene

      sparkRenderer = new Spark.SparkRenderer({
        renderer: webglRenderer,
        preUpdate: false,
      })
      threeScene.add(sparkRenderer)

      splatMesh = new Spark.SplatMesh({
        url: sceneAssetUrl,
        fileType: Spark.SplatFileType.SPZ,
      })
      await splatMesh.initialized

      splatMesh.rotation.set(noFlip ? 0 : Math.PI, 0, 0)
      splatMesh.updateMatrix()
      threeScene.add(splatMesh)

      const applyCameraRotation = () => {
        if (!camera) return
        camera.rotation.x = pitch
        camera.rotation.y = yaw
      }

      yaw = perspectiveCamera.rotation.y
      pitch = perspectiveCamera.rotation.x

      const resize = () => {
        const width = Math.max(container.clientWidth, 1)
        const height = Math.max(container.clientHeight, 1)
        webglRenderer.setSize(width, height)
        perspectiveCamera.aspect = width / height
        perspectiveCamera.updateProjectionMatrix()
      }

      resize()
      resizeObserver = new ResizeObserver(resize)
      resizeObserver.observe(container)

      if (!minimal) {
        xrButton = Spark.VRButton.createButton(webglRenderer)
        if (xrButton) {
          xrButton.classList.add("spark-vr-button")
          container.appendChild(xrButton)
        }

        handleKeyDown = (event: KeyboardEvent) => {
          if (event.repeat) return

          if (
            event.target instanceof HTMLElement &&
            (event.target.isContentEditable ||
              event.target.tagName === "INPUT" ||
              event.target.tagName === "TEXTAREA" ||
              event.target.tagName === "SELECT")
          ) {
            return
          }

          const code = event.code
          if (
            code === "KeyW" ||
            code === "KeyA" ||
            code === "KeyS" ||
            code === "KeyD" ||
            code === "KeyQ" ||
            code === "KeyE" ||
            code === "ShiftLeft" ||
            code === "ShiftRight"
          ) {
            event.preventDefault()
            pressedKeys.add(code)
          }
        }

        handleKeyUp = (event: KeyboardEvent) => {
          pressedKeys.delete(event.code)
        }

        handleMouseMove = (event: MouseEvent) => {
          if (document.pointerLockElement !== container || !camera) return

          const sensitivity = 0.0022
          yaw -= event.movementX * sensitivity
          pitch -= event.movementY * sensitivity

          const maxPitch = Math.PI / 2 - 0.05
          pitch = Math.max(-maxPitch, Math.min(maxPitch, pitch))
          applyCameraRotation()
        }

        handlePointerLockChange = () => {
          if (document.pointerLockElement !== container) {
            pressedKeys.clear()
          }
        }

        handleClick = () => {
          if (document.pointerLockElement !== container) {
            void container.requestPointerLock()
          }
        }
      }

      const moveCamera = (deltaSeconds: number) => {
        if (!camera) return

        let moveSpeed = 3.5
        if (pressedKeys.has("ShiftLeft") || pressedKeys.has("ShiftRight")) {
          moveSpeed *= 2.5
        }

        const velocity = moveSpeed * deltaSeconds
        const forward = new THREE.Vector3()
        camera.getWorldDirection(forward)
        forward.y = 0
        if (forward.lengthSq() > 0) forward.normalize()

        const right = new THREE.Vector3()
        right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()

        if (pressedKeys.has("KeyW"))
          camera.position.addScaledVector(forward, velocity)
        if (pressedKeys.has("KeyS"))
          camera.position.addScaledVector(forward, -velocity)
        if (pressedKeys.has("KeyA"))
          camera.position.addScaledVector(right, -velocity)
        if (pressedKeys.has("KeyD"))
          camera.position.addScaledVector(right, velocity)
        if (pressedKeys.has("KeyQ")) camera.position.y += velocity
        if (pressedKeys.has("KeyE")) camera.position.y -= velocity
      }

      const renderFrame = (time: number) => {
        if (!renderer || !camera || !scene) return

        const deltaSeconds =
          previousTime === 0
            ? 0
            : Math.min((time - previousTime) / 1000, 0.05)
        previousTime = time

        moveCamera(deltaSeconds)
        renderer.render(scene, camera)
      }

      const attachListeners = () => {
        if (minimal) return

        if (handleKeyDown) window.addEventListener("keydown", handleKeyDown)
        if (handleKeyUp) window.addEventListener("keyup", handleKeyUp)
        if (handlePointerLockChange)
          document.addEventListener("pointerlockchange", handlePointerLockChange)
        if (handleMouseMove) window.addEventListener("mousemove", handleMouseMove)
        if (handleClick) container.addEventListener("click", handleClick)
      }

      attachListeners()
      webglRenderer.setAnimationLoop(renderFrame)

      if (mounted) {
        setViewerState("ready")

        // Capture thumbnail after a short delay to let the scene render
        if (thumbnailKey && !minimal) {
          setTimeout(() => {
            try {
              webglRenderer.render(threeScene, perspectiveCamera)
              const dataUrl = webglRenderer.domElement.toDataURL("image/jpeg", 0.7)
              localStorage.setItem(`scene-thumb-${thumbnailKey}`, dataUrl)
            } catch {}
          }, 2000)
        }
      }
    }

    void startViewer().catch((error) => {
      if (!mounted) return

      setViewerState("error")
      setViewerError(
        error instanceof Error
          ? error.message
          : "Failed to load the scene asset."
      )
    })

    return () => {
      mounted = false
      pressedKeys.clear()
      resizeObserver?.disconnect()

      if (handleKeyDown) window.removeEventListener("keydown", handleKeyDown)
      if (handleKeyUp) window.removeEventListener("keyup", handleKeyUp)
      if (handlePointerLockChange)
        document.removeEventListener(
          "pointerlockchange",
          handlePointerLockChange
        )
      if (handleMouseMove)
        window.removeEventListener("mousemove", handleMouseMove)
      if (container && handleClick)
        container.removeEventListener("click", handleClick)
      if (document.pointerLockElement === container) document.exitPointerLock()
      renderer?.setAnimationLoop(null)

      if (scene && splatMesh) scene.remove(splatMesh)
      splatMesh?.dispose()

      if (scene && sparkRenderer) scene.remove(sparkRenderer)

      if (xrButton && xrButton.parentElement === container)
        container.removeChild(xrButton)

      if (renderer && container) {
        renderer.dispose()
        if (renderer.domElement.parentElement === container)
          container.removeChild(renderer.domElement)
      }
    }
  }, [assetUrl, sceneStatus, noFlip])

  if (sceneStatus !== "complete") {
    if (minimal) return null
    return (
      <div className="glass flex min-h-[420px] items-center justify-center rounded-2xl p-8 text-center">
        <div className="max-w-md space-y-3">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <LoaderCircle className="size-5 animate-spin" />
          </div>
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Scene processing
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            This moment is still being generated. The viewer will load
            automatically once it&apos;s ready.
          </p>
        </div>
      </div>
    )
  }

  if (!assetUrl) {
    if (minimal) return null
    return (
      <div className="glass flex min-h-[420px] items-center justify-center rounded-2xl border-destructive/20 p-8 text-center text-destructive">
        The scene is marked complete, but no asset URL was returned.
      </div>
    )
  }

  if (minimal) {
    return (
      <div
        ref={wrapperRef}
        className="group relative h-full w-full bg-gradient-to-br from-neutral-900 to-neutral-950"
      >
        <div
          ref={containerRef}
          className="absolute inset-0 z-0 h-full w-full cursor-pointer"
        />
        {viewerState === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm">
            <LoaderCircle className="size-5 animate-spin text-white/70" />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-neutral-950">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 border-b border-white/8 px-5 py-3">
        <div />
        <div className="flex gap-2">
          <button
            onClick={() =>
              alert(
                "Please verify a VR headset is connected and WebXR is supported."
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/8 px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/12 hover:text-white"
          >
            VR
            <Headset className="size-3.5" />
          </button>
          <Link
            href={assetUrl}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/8 px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/12 hover:text-white"
          >
            Open
            <ExternalLink className="size-3.5" />
          </Link>
          <Link
            href={assetUrl}
            download
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/8 px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/12 hover:text-white"
          >
            Download
            <Download className="size-3.5" />
          </Link>
        </div>
      </div>

      {/* Viewer */}
      <div
        ref={wrapperRef}
        className="group relative h-[700px] bg-gradient-to-br from-neutral-900 to-neutral-950"
      >
        <div
          ref={containerRef}
          className="absolute inset-0 z-0 h-full w-full cursor-crosshair"
        />

        {/* Controls overlay */}
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-5 opacity-0 transition-opacity duration-300 group-hover:opacity-100 focus-within:opacity-100">
          <div className="flex items-start justify-end">
            <button
              onClick={toggleFullscreen}
              className="pointer-events-auto rounded-lg bg-black/30 p-2.5 text-white/60 backdrop-blur-xl transition-all hover:bg-black/50 hover:text-white"
              aria-label={
                isFullscreen ? "Exit fullscreen" : "Enter fullscreen"
              }
            >
              {isFullscreen ? (
                <Minimize className="size-4" />
              ) : (
                <Maximize className="size-4" />
              )}
            </button>
          </div>

          <div className="flex items-end justify-between gap-4">
            <div className="flex gap-2 text-xs font-medium text-white/60">
              <div className="flex items-center gap-1.5 rounded-lg bg-black/30 px-2.5 py-1.5 backdrop-blur-xl">
                <Move3D className="size-3" />
                WASD
              </div>
              <div className="flex items-center gap-1.5 rounded-lg bg-black/30 px-2.5 py-1.5 backdrop-blur-xl">
                <MousePointer2 className="size-3" />
                Click to look
              </div>
            </div>

            {assetFormat && (
              <div className="flex items-center gap-1.5 rounded-lg bg-black/30 px-2.5 py-1.5 text-xs font-medium uppercase text-white/50 backdrop-blur-xl">
                <Box className="size-3" />
                {assetFormat}
              </div>
            )}
          </div>
        </div>

        {viewerState === "loading" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-neutral-950/40 backdrop-blur-sm">
            <div className="rounded-xl bg-black/40 px-4 py-2 text-sm font-medium text-white/80 backdrop-blur-xl">
              Loading scene...
            </div>
          </div>
        )}

        {viewerState === "error" && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="glass max-w-md rounded-2xl p-6 text-center">
              <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <AlertCircle className="size-5" />
              </div>
              <h2 className="font-heading text-base font-semibold text-foreground">
                Failed to load
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {viewerError ??
                  "The scene asset could not be rendered in the browser."}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
