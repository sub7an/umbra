import { EffectComposer, Bloom, ChromaticAberration, Vignette } from '@react-three/postprocessing'

/**
 * Shared film-grade post-processing stack.
 * Bloom for light bleed, faint chromatic fringing at the frame edge,
 * vignette to pull the eye centre-frame. No depth of field — it blurs
 * wide simulations where the whole scene is the subject.
 */
export default function CinematicEffects({ bloomIntensity = 0.9 }) {
  return (
    <EffectComposer multisampling={4}>
      <Bloom
        intensity={bloomIntensity}
        luminanceThreshold={0.3}
        luminanceSmoothing={0.3}
        mipmapBlur
        radius={0.6}
      />
      <ChromaticAberration offset={[0.0004, 0.0004]} radialModulation modulationOffset={0.6} />
      <Vignette eskil={false} offset={0.22} darkness={0.65} />
    </EffectComposer>
  )
}
