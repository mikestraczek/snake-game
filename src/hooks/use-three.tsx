import { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { GameState3D, BoardSize3D } from '../../shared/types'

type ThreeScene = {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  controls: OrbitControls
  boardGroup: THREE.Group
  snakeGroups: Map<string, THREE.Group>
  foodGroup: THREE.Group
}

type UseThreeProps = {
  containerRef: React.RefObject<HTMLDivElement>
  boardSize: BoardSize3D
  gameState: GameState3D | null
  players: Array<{ id: string; name: string; color: string }>
}

export function useThree({ containerRef, boardSize, gameState, players }: UseThreeProps) {
  const sceneRef = useRef<ThreeScene | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const animationFrameRef = useRef<number>()

  // Szene initialisieren
  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    // Szene erstellen
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a2e)

    // Kamera erstellen
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 2000)
    camera.position.set(
      boardSize.width * 0.8,
      boardSize.height * 1.2,
      boardSize.depth * 0.8
    )
    camera.lookAt(boardSize.width / 2, 0, boardSize.depth / 2)

    // Renderer erstellen
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(renderer.domElement)

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.target.set(boardSize.width / 2, 0, boardSize.depth / 2)
    controls.maxPolarAngle = Math.PI * 0.8
    controls.minDistance = 200
    controls.maxDistance = 1500

    // Beleuchtung
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(boardSize.width, boardSize.height * 2, boardSize.depth)
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.width = 2048
    directionalLight.shadow.mapSize.height = 2048
    directionalLight.shadow.camera.near = 0.5
    directionalLight.shadow.camera.far = 2000
    directionalLight.shadow.camera.left = -boardSize.width
    directionalLight.shadow.camera.right = boardSize.width
    directionalLight.shadow.camera.top = boardSize.height
    directionalLight.shadow.camera.bottom = -boardSize.height
    scene.add(directionalLight)

    // Gruppen für Spielobjekte
    const boardGroup = new THREE.Group()
    const snakeGroups = new Map<string, THREE.Group>()
    const foodGroup = new THREE.Group()
    
    scene.add(boardGroup)
    scene.add(foodGroup)

    sceneRef.current = {
      scene,
      camera,
      renderer,
      controls,
      boardGroup,
      snakeGroups,
      foodGroup
    }

    setIsInitialized(true)

    // Resize Handler
    const handleResize = () => {
      if (!sceneRef.current) return
      
      const newWidth = container.clientWidth
      const newHeight = container.clientHeight
      
      sceneRef.current.camera.aspect = newWidth / newHeight
      sceneRef.current.camera.updateProjectionMatrix()
      sceneRef.current.renderer.setSize(newWidth, newHeight)
    }

    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (sceneRef.current) {
        container.removeChild(sceneRef.current.renderer.domElement)
        sceneRef.current.renderer.dispose()
      }
    }
  }, [containerRef, boardSize])

  // Spielfeld erstellen
  const createBoard = () => {
    if (!sceneRef.current) return

    const { boardGroup } = sceneRef.current
    boardGroup.clear()

    const tileCount = boardSize.width / boardSize.gridSize
    const tileSize = boardSize.gridSize

    // Boden
    const floorGeometry = new THREE.PlaneGeometry(boardSize.width, boardSize.depth)
    const floorMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x2a2a3e,
      transparent: true,
      opacity: 0.8
    })
    const floor = new THREE.Mesh(floorGeometry, floorMaterial)
    floor.rotation.x = -Math.PI / 2
    floor.position.set(boardSize.width / 2, -tileSize / 2, boardSize.depth / 2)
    floor.receiveShadow = true
    boardGroup.add(floor)

    // Wände (transparent)
    const wallMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x4a4a6e,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    })

    // Vordere und hintere Wand
    const wallGeometry = new THREE.PlaneGeometry(boardSize.width, boardSize.height)
    
    const frontWall = new THREE.Mesh(wallGeometry, wallMaterial)
    frontWall.position.set(boardSize.width / 2, boardSize.height / 2, 0)
    boardGroup.add(frontWall)

    const backWall = new THREE.Mesh(wallGeometry, wallMaterial)
    backWall.position.set(boardSize.width / 2, boardSize.height / 2, boardSize.depth)
    backWall.rotation.y = Math.PI
    boardGroup.add(backWall)

    // Linke und rechte Wand
    const sideWallGeometry = new THREE.PlaneGeometry(boardSize.depth, boardSize.height)
    
    const leftWall = new THREE.Mesh(sideWallGeometry, wallMaterial)
    leftWall.position.set(0, boardSize.height / 2, boardSize.depth / 2)
    leftWall.rotation.y = Math.PI / 2
    boardGroup.add(leftWall)

    const rightWall = new THREE.Mesh(sideWallGeometry, wallMaterial)
    rightWall.position.set(boardSize.width, boardSize.height / 2, boardSize.depth / 2)
    rightWall.rotation.y = -Math.PI / 2
    boardGroup.add(rightWall)

    // Gitter-Linien
    const gridMaterial = new THREE.LineBasicMaterial({ 
      color: 0x6a6a8e,
      transparent: true,
      opacity: 0.3
    })

    // Horizontale Linien
    for (let i = 0; i <= tileCount; i++) {
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(i * tileSize, 0, 0),
        new THREE.Vector3(i * tileSize, 0, boardSize.depth)
      ])
      const line = new THREE.Line(geometry, gridMaterial)
      boardGroup.add(line)
    }

    // Vertikale Linien
    for (let i = 0; i <= tileCount; i++) {
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, i * tileSize),
        new THREE.Vector3(boardSize.width, 0, i * tileSize)
      ])
      const line = new THREE.Line(geometry, gridMaterial)
      boardGroup.add(line)
    }
  }

  // Schlangen rendern
  const renderSnakes = () => {
    if (!sceneRef.current || !gameState) return

    const { scene, snakeGroups } = sceneRef.current

    // Alte Schlangen entfernen
    snakeGroups.forEach((group, playerId) => {
      if (!gameState.players.find(p => p.id === playerId)) {
        scene.remove(group)
        snakeGroups.delete(playerId)
      }
    })

    gameState.players.forEach(player => {
      if (!player.alive) return

      const playerInfo = players.find(p => p.id === player.id)
      const color = playerInfo?.color || '#4ecdc4'

      let snakeGroup = snakeGroups.get(player.id)
      if (!snakeGroup) {
        snakeGroup = new THREE.Group()
        snakeGroups.set(player.id, snakeGroup)
        scene.add(snakeGroup)
      }

      snakeGroup.clear()

      player.snake.forEach((segment, index) => {
        const isHead = index === 0
        const radius = isHead ? boardSize.gridSize * 0.4 : boardSize.gridSize * 0.3
        const height = boardSize.gridSize * 0.8

        const geometry = new THREE.CylinderGeometry(radius, radius, height, 8)
        const material = new THREE.MeshLambertMaterial({ 
          color: new THREE.Color(color),
          transparent: !isHead,
          opacity: isHead ? 1 : 0.8
        })
        
        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(
          segment.x * boardSize.gridSize + boardSize.gridSize / 2,
          height / 2,
          segment.z * boardSize.gridSize + boardSize.gridSize / 2
        )
        mesh.castShadow = true
        
        // Augen für Kopf
        if (isHead) {
          const eyeGeometry = new THREE.SphereGeometry(2, 8, 8)
          const eyeMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff })
          
          const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial)
          leftEye.position.set(-radius * 0.5, height * 0.3, radius * 0.7)
          mesh.add(leftEye)
          
          const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial)
          rightEye.position.set(radius * 0.5, height * 0.3, radius * 0.7)
          mesh.add(rightEye)
        }
        
        snakeGroup.add(mesh)
      })
    })
  }

  // Futter rendern
  const renderFood = () => {
    if (!sceneRef.current || !gameState) return

    const { foodGroup } = sceneRef.current
    foodGroup.clear()

    gameState.food.forEach(food => {
      const geometry = new THREE.SphereGeometry(boardSize.gridSize * 0.3, 12, 12)
      const material = new THREE.MeshLambertMaterial({ 
        color: 0xff6b6b,
        emissive: 0x441111
      })
      
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(
        food.x * boardSize.gridSize + boardSize.gridSize / 2,
        boardSize.gridSize * 0.3,
        food.z * boardSize.gridSize + boardSize.gridSize / 2
      )
      mesh.castShadow = true
      
      foodGroup.add(mesh)
    })
  }

  // Animation Loop
  const animate = () => {
    if (!sceneRef.current) return

    const { renderer, scene, camera, controls } = sceneRef.current
    
    controls.update()
    renderer.render(scene, camera)
    
    animationFrameRef.current = requestAnimationFrame(animate)
  }

  // Spiel rendern
  useEffect(() => {
    if (!isInitialized) return

    createBoard()
    renderSnakes()
    renderFood()
    
    if (!animationFrameRef.current) {
      animate()
    }
  }, [isInitialized, gameState, players, boardSize])

  return {
    isInitialized,
    scene: sceneRef.current
  }
}