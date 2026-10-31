import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'

// Post-processing tuned for legibility: bloom only on genuinely bright
// emitters with a tight halo (5 mip levels, so one hot core can't haze the
// whole frame and thin lines, rays and grids stay crisp), a light vignette
// to focus the eye, and no chromatic aberration (it smeared fine detail).
export default function CinematicEffects({ bloomIntensity = 0.75 }) {
  return (
    <EffectComposer multisampling={4}>
      <Bloom
        intensity={bloomIntensity}
        luminanceThreshold={0.8}
        luminanceSmoothing={0.2}
        mipmapBlur
        levels={5}
        radius={0.45}
      />
      <Vignette eskil={false} offset={0.3} darkness={0.45} />
    </EffectComposer>
  )
}
