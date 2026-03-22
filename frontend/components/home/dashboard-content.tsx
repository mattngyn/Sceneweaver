"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Plus } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { StoryGroup, SceneTransitionOverlay, type StoryMoment } from "@/components/home/generation-card"

type Story = { title: string; moments: StoryMoment[] }

type DashboardContentProps = {
  stories: Story[]
  storyCount: number
  sceneCount: number
  error: string | null
}

const ease = [0.16, 1, 0.3, 1] as const
const BASE_DELAY = 1.0

export function DashboardContent({
  stories,
  storyCount,
  sceneCount,
  error,
}: DashboardContentProps) {
  const router = useRouter()
  const [isTransitioning, setIsTransitioning] = useState(false)

  const goHome = () => {
    setIsTransitioning(true)
    setTimeout(() => router.push("/"), 1200)
  }

  return (
    <div className="relative z-10">
      <SceneTransitionOverlay />

      <AnimatePresence>
        {isTransitioning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
            className="fixed inset-0 z-[100]"
            style={{
              background:
                "linear-gradient(180deg, #A8C8F0 0%, #C4DAF5 20%, #DBE8FA 40%, #EEF2FC 65%, #FAFBFE 100%)",
            }}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: BASE_DELAY, ease }}
        className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8"
      >
        <button
          onClick={goHome}
          className="inline-flex items-center gap-2 text-sm font-medium text-white/50 transition-colors hover:text-white/80"
        >
          <ArrowLeft className="size-4" strokeWidth={1.5} />
          Home
        </button>

        <button
          onClick={goHome}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/10 px-4 text-[13px] font-semibold text-white/80 backdrop-blur-sm transition-all hover:bg-white/15 active:scale-[0.97]"
        >
          <Plus className="size-3.5" strokeWidth={2} />
          New
        </button>
      </motion.header>

      {/* Title */}
      <div className="mx-auto max-w-6xl px-5 pb-10 sm:px-8">
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: BASE_DELAY + 0.15, ease }}
          className="font-heading text-4xl tracking-[-0.5px] text-white sm:text-5xl"
          style={{ lineHeight: 1.15 }}
        >
          Your Worlds
        </motion.h1>
        {storyCount > 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: BASE_DELAY + 0.3 }}
            className="mt-2 text-[15px] text-white/40"
          >
            {storyCount} {storyCount === 1 ? "story" : "stories"},{" "}
            {sceneCount} {sceneCount === 1 ? "scene" : "scenes"}
          </motion.p>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.15 }}
        transition={{ duration: 0.5, delay: BASE_DELAY + 0.25 }}
        className="mx-auto max-w-6xl px-5 sm:px-8"
      >
        <div className="h-px bg-white" />
      </motion.div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: BASE_DELAY + 0.35, ease }}
        className="mx-auto max-w-6xl px-5 py-10 sm:px-8"
      >
        {error && (
          <div className="mb-8 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {!error && storyCount === 0 && (
          <div className="flex flex-col items-center gap-6 py-28 text-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-full opacity-40 blur-xl bg-indigo-500/20" />
              <div className="relative flex size-20 items-center justify-center rounded-3xl border border-white/10 bg-white/5">
                <span className="font-heading text-3xl text-white/20">?</span>
              </div>
            </div>
            <div>
              <p className="font-heading text-xl text-white">No worlds yet</p>
              <p className="mt-1.5 text-sm text-white/40">
                Upload a story to generate your first 3D world.
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue px-5 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.97]"
            >
              <Plus className="size-4" strokeWidth={2} />
              Upload Story
            </Link>
          </div>
        )}

        <div className="space-y-14">
          {stories.map((story, i) => (
            <motion.div
              key={story.title}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.6,
                delay: BASE_DELAY + 0.45 + i * 0.15,
                ease,
              }}
            >
              <StoryGroup
                title={story.title}
                moments={story.moments}
                darkMode
              />
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
