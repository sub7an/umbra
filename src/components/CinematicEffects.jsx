import { EffectComposer, Bloom, DepthOfField, ChromaticAberration, Vignette } from '@react-three/postprocessing'

/**
 * Shared film-grade post-processing stack.
 * Drop inside any <Canvas> — bloom for light bleed, gentle DoF focused on
 * origin, subtle chromatic fringing, vignette to pull the eye centre-frame.
 */
export default function CinematicEffects({ dof = true, bloomIntensity = 0.9 }) {
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={bloomIntensity}
        luminanceThreshold={0.25}
        luminanceSmoothing={0.35}
        mipmapBlur
        radius={0.75}
      />
      {dof ? (
        <DepthOfField target={[0, 0, 0]} focalLength={0.022} bokehScale={2.2} height={480} />
      ) : null}
      <ChromaticAberration offset={[0.0007, 0.0007]} radialModulation modulationOffset={0.5} />
      <Vignette eskil={false} offset={0.22} darkness={0.7} />
    </EffectComposer>
  )
}
