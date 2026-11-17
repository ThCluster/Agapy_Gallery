import { OrbitControls, Sky } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'

/** Point d'entrée du monde 3D (chargé à la demande, séparé du site classique). */
export default function WorldPage() {
  return (
    <div className="h-[calc(100vh-8rem)] w-full">
      <Canvas camera={{ position: [6, 4, 8], fov: 50 }} shadows>
        <Sky sunPosition={[100, 20, 100]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1.2} castShadow />
        {/* Pelouse */}
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[50, 50]} />
          <meshStandardMaterial color="#5fa36a" />
        </mesh>
        {/* Villa provisoire */}
        <mesh position={[0, 1.5, 0]} castShadow>
          <boxGeometry args={[4, 3, 4]} />
          <meshStandardMaterial color="#ff7518" />
        </mesh>
        <OrbitControls maxPolarAngle={Math.PI / 2.1} />
      </Canvas>
    </div>
  )
}
