import { Environment, MeshReflectorMaterial, OrbitControls, useGLTF, useTexture } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, N8AO, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { photos } from '@/mocks/photos'
import { DAYLIGHTS, displayWidth, TEMPLATES, WALL_TONES, type Slot } from './templates'
import type { Stop } from './tour'
import type { FrameKind, Hanging, VillaConfig } from './types'

export type Quality = 'high' | 'low'

// Architecture du modèle « Lagune » (seul modèle pour l'instant)
const ROOM = TEMPLATES.lagune.room
const L = ROOM.length / 2 // 14
const D = ROOM.depth / 2 // 6
const H = ROOM.height // 7
const WALL = 0.3
/** Relief très léger de l'enduit : des murs blancs de galerie, pas du béton brut */
const WALL_RELIEF = new THREE.Vector2(0.25, 0.25)

/* ───────────── Matériaux photographiés (Poly Haven, CC0) ───────────── */

/** Charge un matériau PBR : couleur, relief et ARM (occlusion, rugosité, métal), répétés à l'échelle voulue */
function usePbr(slug: string, repeat: [number, number]) {
  const [diff, nor, arm] = useTexture([`/villa/textures/${slug}/diff.jpg`, `/villa/textures/${slug}/nor.jpg`, `/villa/textures/${slug}/arm.jpg`])
  return useMemo(() => {
    const prep = (t: THREE.Texture, srgb: boolean) => {
      const c = t.clone()
      c.wrapS = c.wrapT = THREE.RepeatWrapping
      c.repeat.set(repeat[0], repeat[1])
      c.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
      c.anisotropy = 8
      c.needsUpdate = true
      return c
    }
    const armMap = prep(arm, false)
    return { map: prep(diff, true), normalMap: prep(nor, false), roughnessMap: armMap, aoMap: armMap }
  }, [diff, nor, arm, repeat])
}

/* ───────────── Architecture ───────────── */

function Room({ quality, wallColor }: { quality: Quality; wallColor: string }) {
  const floor = usePbr('laminate_floor_02', useMemo(() => [9, 4], []))
  const longWall = usePbr('white_plaster_02', useMemo(() => [9, 2.4], []))
  const shortWall = usePbr('white_plaster_02', useMemo(() => [4, 2.4], []))
  const plinth = usePbr('concrete_floor_02', useMemo(() => [0.6, 0.6], []))
  const steel = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2a2c2e', roughness: 0.45, metalness: 0.85 }), [])
  const glass = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: '#e6f4f6', roughness: 0.02, metalness: 0, transparent: true, opacity: 0.16, reflectivity: 0.6, clearcoat: 1 }),
    [],
  )
  const ceiling = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 }), [])
  const skirting = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3b3a37', roughness: 0.6 }), [])

  const beams = useMemo(() => Array.from({ length: 14 }, (_, i) => -L + 1 + i * 2), [])
  const mullions = useMemo(() => [-6, -3, -0.4, 2.6, 6], [])

  return (
    <group>
      {/* Parquet, légèrement brillant en qualité haute */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[ROOM.length, ROOM.depth]} />
        {quality === 'high' ? (
          <MeshReflectorMaterial {...floor} resolution={1024} blur={[400, 120]} mixBlur={1} mixStrength={0.45} mirror={0.35} roughness={0.85} depthScale={0.6} minDepthThreshold={0.6} maxDepthThreshold={1.2} metalness={0} />
        ) : (
          <meshStandardMaterial {...floor} roughness={0.85} />
        )}
      </mesh>

      {/* Murs en enduit blanc */}
      <mesh position={[0, H / 2, -D - WALL / 2]} receiveShadow castShadow>
        <boxGeometry args={[ROOM.length + WALL * 2, H, WALL]} />
        <meshStandardMaterial color={wallColor} normalMap={longWall.normalMap} normalScale={WALL_RELIEF} roughness={0.92} />
      </mesh>
      <mesh position={[0, H / 2, D + WALL / 2]} receiveShadow castShadow>
        <boxGeometry args={[ROOM.length + WALL * 2, H, WALL]} />
        <meshStandardMaterial color={wallColor} normalMap={longWall.normalMap} normalScale={WALL_RELIEF} roughness={0.92} />
      </mesh>
      <mesh position={[-L - WALL / 2, H / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[WALL, H, ROOM.depth]} />
        <meshStandardMaterial color={wallColor} normalMap={shortWall.normalMap} normalScale={WALL_RELIEF} roughness={0.92} />
      </mesh>
      {/* Plinthes */}
      {[-D + 0.02, D - 0.02].map((z) => (
        <mesh key={z} position={[0, 0.06, z]} material={skirting}>
          <boxGeometry args={[ROOM.length, 0.12, 0.04]} />
        </mesh>
      ))}

      {/* Plafond avec une longue verrière centrale : la lumière du soleil tombe dans le hall */}
      {[-D + 1.6, D - 1.6].map((z) => (
        <mesh key={z} position={[0, H + 0.15, z]} material={ceiling} castShadow receiveShadow>
          <boxGeometry args={[ROOM.length + WALL * 2, 0.3, 3.2]} />
        </mesh>
      ))}
      <mesh position={[0, H + 0.3, 0]} material={glass}>
        <boxGeometry args={[ROOM.length, 0.02, ROOM.depth - 6.4]} />
      </mesh>
      {beams.map((x) => (
        <mesh key={x} position={[x, H + 0.1, 0]} material={steel} castShadow>
          <boxGeometry args={[0.12, 0.22, ROOM.depth - 6.4]} />
        </mesh>
      ))}

      {/* Façade vitrée sur le jardin, avec une grande ouverture d'entrée */}
      {[
        [-D, -0.4],
        [2.6, D],
      ].map(([z0, z1]) => (
        <mesh key={z0} position={[L + 0.05, H / 2, (z0 + z1) / 2]} material={glass}>
          <boxGeometry args={[0.04, H, z1 - z0]} />
        </mesh>
      ))}
      {mullions.map((z) => (
        <mesh key={z} position={[L + 0.05, H / 2, z]} material={steel} castShadow>
          <boxGeometry args={[0.1, H, 0.1]} />
        </mesh>
      ))}
      <mesh position={[L + 0.05, H - 0.05, 0]} material={steel}>
        <boxGeometry args={[0.12, 0.1, ROOM.depth]} />
      </mesh>

      {/* Socles en pierre claire pour la sculpture et le vase */}
      <mesh position={[-6.5, 0.5, 3.4]} castShadow receiveShadow>
        <boxGeometry args={[0.9, 1, 0.9]} />
        <meshStandardMaterial color="#efece6" normalMap={plinth.normalMap} normalScale={WALL_RELIEF} roughness={0.8} />
      </mesh>
      <mesh position={[-12.6, 0.35, 4.6]} castShadow receiveShadow>
        <boxGeometry args={[0.6, 0.7, 0.6]} />
        <meshStandardMaterial color="#efece6" normalMap={plinth.normalMap} normalScale={WALL_RELIEF} roughness={0.8} />
      </mesh>

      {/* Jardin devant la façade */}
      <mesh rotation-x={-Math.PI / 2} position={[L + 40, -0.01, 0]} receiveShadow>
        <planeGeometry args={[80, 120]} />
        <meshStandardMaterial color="#6f9a58" roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[L + 3, 0.005, 1.1]} receiveShadow>
        <planeGeometry args={[6, 3.6]} />
        <meshStandardMaterial {...plinth} color="#d9d4ca" />
      </mesh>
    </group>
  )
}

/* ───────────── Œuvres encadrées, éclairées chacune par une applique ───────────── */

const FRAME_MATERIAL: Record<FrameKind, THREE.MeshStandardMaterialParameters> = {
  walnut: { color: '#4a3020', roughness: 0.45, metalness: 0 },
  gold: { color: '#c9a24a', roughness: 0.28, metalness: 0.9 },
  black: { color: '#151515', roughness: 0.35, metalness: 0.1 },
  white: { color: '#f3f1ec', roughness: 0.5, metalness: 0 },
}

function Artwork({ h: p, slot }: { h: Hanging; slot: Slot }) {
  const photo = photos[p.photo]
  const raw = useTexture(photo.src)
  // Copie préparée pour l'affichage (couleurs sRGB, netteté en vue rasante)
  const tex = useMemo(() => {
    const c = raw.clone()
    c.colorSpace = THREE.SRGBColorSpace
    c.anisotropy = 8
    c.needsUpdate = true
    return c
  }, [raw])

  const w = displayWidth(slot, p.size[1])
  const h = (w * photo.height) / photo.width
  const mat = p.frame === 'black' ? 0 : 0.14 // passe-partout blanc
  const f = 0.07 // largeur du cadre
  const fw = w + 2 * mat + 2 * f
  const fh = h + 2 * mat + 2 * f

  const { position, rotation } = useMemo(() => {
    if (slot.wall === 'back') return { position: new THREE.Vector3(slot.at, 2.15, -D + 0.04), rotation: 0 }
    if (slot.wall === 'front') return { position: new THREE.Vector3(slot.at, 2.15, D - 0.04), rotation: Math.PI }
    return { position: new THREE.Vector3(-L + 0.04, 2.5, slot.at), rotation: Math.PI / 2 }
  }, [slot])

  // Applique au-dessus du cadre, qui vise le centre de la toile
  const target = useMemo(() => new THREE.Object3D(), [])
  return (
    <group position={position} rotation-y={rotation}>
      <mesh position={[0, 0, 0.03]} castShadow receiveShadow>
        <boxGeometry args={[fw, fh, 0.06]} />
        <meshStandardMaterial {...FRAME_MATERIAL[p.frame]} />
      </mesh>
      {mat > 0 && (
        <mesh position={[0, 0, 0.061]}>
          <planeGeometry args={[w + 2 * mat, h + 2 * mat]} />
          <meshStandardMaterial color="#f7f5ef" roughness={0.95} />
        </mesh>
      )}
      <mesh position={[0, 0, 0.064]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={tex} roughness={0.6} />
      </mesh>
      {/* Applique laiton */}
      <group position={[0, fh / 2 + 0.14, 0.2]} rotation-x={0.35}>
        <mesh rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.035, 0.035, Math.min(0.9, fw * 0.6), 16]} />
          <meshStandardMaterial color="#b08d57" metalness={0.9} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.02, -0.12]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.012, 0.012, 0.24, 8]} />
          <meshStandardMaterial color="#b08d57" metalness={0.9} roughness={0.3} />
        </mesh>
      </group>
      <primitive object={target} position={[0, 0, 0]} />
      <spotLight position={[0, fh / 2 + 0.9, 1.1]} target={target} angle={0.55} penumbra={0.85} intensity={28} distance={6} decay={2} color="#fff1dc" />
    </group>
  )
}

/* ───────────── Mobilier et objets réels (modèles Poly Haven, CC0) ───────────── */

/** Modèle glTF mis à la hauteur voulue (en mètres), qui projette et reçoit les ombres */
function Model({ slug, height, position, rotation = 0 }: { slug: string; height: number; position: [number, number, number]; rotation?: number }) {
  const { scene } = useGLTF(`/villa/models/${slug}/${slug}.gltf`)
  const object = useMemo(() => {
    const c = scene.clone(true)
    c.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
    })
    const size = new THREE.Box3().setFromObject(c).getSize(new THREE.Vector3())
    c.scale.setScalar(size.y > 0 ? height / size.y : 1)
    return c
  }, [scene, height])
  return <primitive object={object} position={position} rotation-y={rotation} />
}

function Furniture() {
  return (
    <>
      <Model slug="Ottoman_01" height={0.42} position={[-1, 0, 0]} />
      <Model slug="Ottoman_01" height={0.42} position={[5, 0, 0]} rotation={Math.PI / 2} />
      <Model slug="mid_century_lounge_chair" height={0.82} position={[11.2, 0, -4.2]} rotation={-2.4} />
      <Model slug="potted_plant_02" height={1.7} position={[12.9, 0, -5.2]} />
      <Model slug="potted_plant_04" height={1.25} position={[12.9, 0, 5.2]} />
      <Model slug="potted_plant_02" height={2.1} position={[17, 0, -3.2]} rotation={1.2} />
      <Model slug="potted_plant_04" height={1.4} position={[17, 0, 4.4]} rotation={0.6} />
      <Model slug="horse_statue_01" height={0.85} position={[-6.5, 1, 3.4]} rotation={0.6} />
      <Model slug="ceramic_vase_03" height={0.55} position={[-12.6, 0.7, 4.6]} />
    </>
  )
}

/* ───────────── Avatar-guide (silhouette provisoire) ───────────── */

function Guide({ tour, stop }: { tour: Stop[]; stop: number }) {
  const group = useRef<THREE.Group>(null)
  const legL = useRef<THREE.Group>(null)
  const legR = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  // Mannequin de galerie : plâtre satiné, comme une sculpture
  const body = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#efe9df', roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.4 }), [])
  // Buste galbé (hanches, taille, poitrine, épaules) obtenu par révolution d'un profil
  const torso = useMemo(() => {
    const profile = [
      [0, 0.86], [0.15, 0.88], [0.17, 0.96], [0.135, 1.12], [0.16, 1.28], [0.19, 1.4], [0.15, 1.48], [0.05, 1.52], [0, 1.52],
    ].map(([r, y]) => new THREE.Vector2(r, y))
    return new THREE.LatheGeometry(profile, 40)
  }, [])
  const goal = useMemo(() => new THREE.Vector3(), [])
  const eye = useMemo(() => new THREE.Vector3(), [])

  useFrame((state, dt) => {
    const g = group.current
    if (!g) return
    goal.set(...tour[stop].guide)
    const dist = g.position.distanceTo(goal)
    g.position.lerp(goal, 1 - Math.exp(-dt * 0.9))
    // Regarde le visiteur
    eye.copy(state.camera.position).setY(g.position.y)
    g.lookAt(eye)
    // Marche tant que l'avatar se déplace, bras en balancier ; immobile, il respire à peine
    const t = state.clock.elapsedTime
    const walk = Math.min(dist, 1) * Math.sin(t * 6) * 0.4
    if (legL.current) legL.current.rotation.x = walk
    if (legR.current) legR.current.rotation.x = -walk
    if (armL.current) armL.current.rotation.x = -walk * 0.8
    if (armR.current) armR.current.rotation.x = walk * 0.8 - (dist < 0.2 ? 0.35 + Math.sin(t * 1.4) * 0.05 : 0)
  })

  const limb = (top: number, bottom: number, length: number) => (
    <mesh position={[0, -length / 2, 0]} material={body} castShadow>
      <cylinderGeometry args={[top, bottom, length, 16]} />
    </mesh>
  )

  return (
    <group ref={group} position={tour[0].guide}>
      <group ref={legL} position={[-0.085, 0.9, 0]}>{limb(0.07, 0.04, 0.88)}</group>
      <group ref={legR} position={[0.085, 0.9, 0]}>{limb(0.07, 0.04, 0.88)}</group>
      <mesh geometry={torso} material={body} scale={[1, 1, 0.68]} castShadow />
      <group ref={armL} position={[-0.2, 1.43, 0]} rotation-z={-0.08}>{limb(0.042, 0.03, 0.62)}</group>
      {/* Bras droit légèrement levé vers l'œuvre quand le guide commente */}
      <group ref={armR} position={[0.2, 1.43, 0]} rotation-z={0.08}>{limb(0.042, 0.03, 0.62)}</group>
      <mesh position={[0, 1.58, 0]} material={body} castShadow>
        <cylinderGeometry args={[0.04, 0.05, 0.1, 16]} />
      </mesh>
      <mesh position={[0, 1.71, 0.01]} scale={[0.85, 1.12, 0.95]} material={body} castShadow>
        <sphereGeometry args={[0.105, 32, 24]} />
      </mesh>
    </group>
  )
}

/* ───────────── Caméra : visite guidée ou libre ───────────── */

function CameraRig({ tour, stop, free }: { tour: Stop[]; stop: number; free: boolean }) {
  const { camera } = useThree()
  const look = useRef(new THREE.Vector3(...tour[0].look))
  const eye = useMemo(() => new THREE.Vector3(), [])
  const goal = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, dt) => {
    if (free) return
    const s = tour[stop]
    const k = 1 - Math.exp(-dt * 0.8) // déplacement doux, comme une marche lente
    eye.set(...s.eye)
    goal.set(...s.look)
    camera.position.lerp(eye, k)
    look.current.lerp(goal, k * 1.3)
    camera.lookAt(look.current)
  })

  return free ? <OrbitControls makeDefault target={tour[stop].look} minDistance={1.2} maxDistance={22} maxPolarAngle={Math.PI / 2 - 0.05} enableDamping /> : null
}

/* ───────────── Scène complète ───────────── */

export function VillaScene({ villa, tour, stop, free, quality }: { villa: VillaConfig; tour: Stop[]; stop: number; free: boolean; quality: Quality }) {
  const template = TEMPLATES[villa.template]
  const day = DAYLIGHTS[villa.light]
  return (
    <>
      {/* Lumière du ciel (HDRI réel) et soleil qui traverse la verrière */}
      <Environment files="/villa/hdri/kloofendal_48d_partly_cloudy_puresky.hdr" background environmentIntensity={day.sky} backgroundIntensity={1} />
      <directionalLight
        position={day.sun}
        intensity={day.intensity}
        color={day.color}
        castShadow
        shadow-mapSize={[quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-camera-far={60}
      />
      <hemisphereLight args={['#fdfbf6', day.ground, 0.6]} />

      <Room quality={quality} wallColor={WALL_TONES[villa.wallTone]} />
      {villa.hangings.map((h) => {
        const slot = template.slots.find((s) => s.id === h.slot)
        return slot ? <Artwork key={h.slot} h={h} slot={slot} /> : null
      })}
      <Furniture />
      <Guide tour={tour} stop={stop} />
      <CameraRig tour={tour} stop={stop} free={free} />

      {quality === 'high' && (
        <EffectComposer multisampling={4}>
          {/* Occlusion ambiante : les ombres de contact qui donnent le réalisme aux angles et aux objets */}
          <N8AO aoRadius={1.2} intensity={2.2} distanceFalloff={0.8} color="#2a2420" />
          <Bloom intensity={0.22} luminanceThreshold={0.92} mipmapBlur />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          <Vignette offset={0.28} darkness={0.38} />
        </EffectComposer>
      )}
    </>
  )
}

// Préchargement des modèles pendant l'écran d'attente
for (const slug of ['Ottoman_01', 'mid_century_lounge_chair', 'potted_plant_02', 'potted_plant_04', 'horse_statue_01', 'ceramic_vase_03']) {
  useGLTF.preload(`/villa/models/${slug}/${slug}.gltf`)
}
