"use client"

type AudioPlayerProps = {
  src: string
}

export function AudioPlayer({ src }: AudioPlayerProps) {
  return (
    <audio
      className="w-full"
      controls
      preload="metadata"
      src={src}
    >
      Your browser does not support audio playback.
    </audio>
  )
}
