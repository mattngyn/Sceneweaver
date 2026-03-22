"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

import { AudioPlayer } from "@/components/viewer/audio-player"
import { SceneViewer } from "@/components/viewer/scene-viewer"

const ease = [0.16, 1, 0.3, 1] as const

type ScenePageContentProps = {
  genId: string
  momentIndex: number
  bookTitle: string
  momentTitle: string
  sceneUrl: string | null
  assetFormat: string | null
  sceneStatus: string
  noFlip: boolean
  audioUrl: string | null
  previousMomentIndex: number | null
  nextMomentIndex: number | null
}

export function ScenePageContent({
  genId,
  momentIndex,
  bookTitle,
  momentTitle,
  sceneUrl,
  assetFormat,
  sceneStatus,
  noFlip,
  audioUrl,
  previousMomentIndex,
  nextMomentIndex,
}: ScenePageContentProps) {
  const router = useRouter()
  const [isTransitioning, setIsTransitioning] = useState(false)

  const goBack = () => {
    setIsTransitioning(true)
    setTimeout(() => router.push("/dashboard"), 900)
  }

  return (
    <div className="relative z-10">
      {/* Transition overlay back to dashboard */}
      <AnimatePresence>
        {isTransitioning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
            className="fixed inset-0 z-[100]"
            style={{
              background: "linear-gradient(180deg, #0a0e1a 0%, #111827 40%, #1a2035 70%, #1e2840 100%)",
            }}
          />
        )}
      </AnimatePresence>

      {/* Nav bar */}
      <motion.nav
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3, ease }}
        className="flex items-center justify-between px-5 py-5 sm:px-8"
      >
        <button
          onClick={goBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-white/50 transition-colors hover:text-white/80"
        >
          <ArrowLeft className="size-4" strokeWidth={1.5} />
          Back
        </button>

        <div className="flex gap-2">
          {previousMomentIndex !== null && (
            <Link
              href={`/scenes/${genId}/${previousMomentIndex}`}
              className="inline-flex items-center gap-1 text-sm font-medium text-white/50 transition-colors hover:text-white/80"
            >
              <ChevronLeft className="size-4" strokeWidth={1.5} />
              Previous
            </Link>
          )}
          {previousMomentIndex !== null && nextMomentIndex !== null && (
            <span className="text-white/15">|</span>
          )}
          {nextMomentIndex !== null && (
            <Link
              href={`/scenes/${genId}/${nextMomentIndex}`}
              className="inline-flex items-center gap-1 text-sm font-medium text-white/50 transition-colors hover:text-white/80"
            >
              Next
              <ChevronRight className="size-4" strokeWidth={1.5} />
            </Link>
          )}
        </div>
      </motion.nav>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 pt-4 pb-10 sm:px-8">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4, ease }}
          className="space-y-3 text-center"
        >
          <h1 className="font-heading text-4xl tracking-[-0.5px] text-white sm:text-5xl">
            {bookTitle}
          </h1>
          <p className="text-[15px] text-white/40">
            {momentTitle}
          </p>
        </motion.div>

        {/* Viewer */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5, ease }}
          className="space-y-4"
        >
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <SceneViewer
              assetUrl={sceneUrl}
              assetFormat={assetFormat}
              sceneStatus={sceneStatus}
              noFlip={noFlip}
              thumbnailKey={`${genId}-${momentIndex}`}
            />
          </div>

          {audioUrl && (
            <div className="mx-auto w-full max-w-lg rounded-xl border border-white/10 bg-white/5 px-5 py-3">
              <AudioPlayer src={audioUrl} />
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
