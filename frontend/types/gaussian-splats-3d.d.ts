declare module "@mkkellogg/gaussian-splats-3d" {
  export const SceneFormat: {
    Ply: number
    Splat: number
    KSplat: number
  }

  export class Viewer {
    constructor(options?: Record<string, unknown>)
    addSplatScene(
      path: string,
      options?: Record<string, unknown>
    ): Promise<void>
    start(): void
    stop(): void
    dispose(): Promise<void>
  }
}
