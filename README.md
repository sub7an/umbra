# ⬡ Umbra — Interactive 3D Physics, In Real Time

**[umbrasandbox.com](https://umbrasandbox.com)** · 13 GPU-accelerated physics worlds running live in your browser. No downloads, no account.

![Umbra](public/og.png)

## What's inside

| Module | What you can do |
|---|---|
| General Relativity | Warp spacetime, watch matter spiral into a gravity well, trace geodesics |
| Quantum Mechanics | Tunneling, Bloch sphere, particle-in-a-box, double slit with measurement |
| Special Relativity | Light cones, time dilation, length contraction at up to 0.99c |
| Dynamical Systems | Lorenz, Rössler, Thomas, Aizawa attractors — 1,800 RK4-integrated particles |
| Electromagnetism | Real Biot-Savart field computation: dipoles, solenoids, Halbach arrays |
| Wave Mechanics | FDTD ripple tank, double slit, membrane normal modes |
| Thermodynamics | Gas simulation, entropy, Carnot cycles, Ising model |
| Fluid Dynamics | Kármán vortex street, SPH dam break, potential flow |
| Optics | Prism dispersion across 24 wavelengths, lens imaging, diffraction gratings |
| Frontier Physics | Galaxy rotation curves, Hubble expansion, black holes, N-body |
| Acoustic Physics | Chladni figures, harmonic series, Lissajous curves |
| Physics Sandbox | Drop attractors/repulsors/vortices onto a 900-tracer particle field |
| Wave Mechanics | Live 3D wave equation on a 128×128 mesh |

## Beyond the simulations

- **AI physics tutor** — asks about exactly what's on screen (Claude-powered)
- **Guided story journeys** — Galileo to Hawking, with XP and badges
- **Multiplayer rooms** — synced simulations for classrooms and study groups
- **Gesture control** — pinch and swipe the camera via webcam (MediaPipe)
- **Cinematic engine** — bloom, reflections, hyperspace transitions, synthesized sound
- **Embed anywhere** — every sim works as an iframe in Canvas, Moodle, Notion
- **Presentation mode** — press `P` for fullscreen classroom projection

## For educators

Every simulation embeds with one line:

```html
<iframe src="https://umbrasandbox.com/?embed=1#general-relativity"
        width="800" height="520" style="border:0" allowfullscreen></iframe>
```

School and district licensing: [hamzahatef09@gmail.com](mailto:hamzahatef09@gmail.com?subject=Umbra%20school%20license)

## Stack

React 19 · Three.js / React Three Fiber · Zustand · Tailwind · Vite · Anthropic SDK · MediaPipe · KaTeX — deployed on Vercel.

## Develop

```bash
npm install
npm run dev      # local dev server
npm run build    # production build
node scripts/make-og.mjs  # regenerate the social card
```
