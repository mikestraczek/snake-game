import { useRef, useEffect, useState, useCallback } from 'react'
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
  const [followMode, setFollowMode] = useState(false)
  const [debugInfo, setDebugInfo] = useState({ cameraPos: '', objectCount: 0 })

  // Szene initialisieren
  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    // Szene erstellen
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a2e)

    // Kamera erstellen - näher und besser positioniert
    const camera = new THREE.PerspectiveCamera(60, width / height, 1, 1000)
    camera.position.set(
      boardSize.width * 0.6,
      boardSize.height * 0.8,
      boardSize.depth * 0.6
    )
    camera.lookAt(boardSize.width / 2, boardSize.height / 4, boardSize.depth / 2)

    // Renderer erstellen
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(renderer.domElement)

    // Orbit Controls - optimiert für bessere Steuerung
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.target.set(boardSize.width / 2, boardSize.height / 4, boardSize.depth / 2)
    controls.maxPolarAngle = Math.PI * 0.75
    controls.minDistance = 100
    controls.maxDistance = 800
    controls.enablePan = true
    controls.panSpeed = 1.2
    controls.rotateSpeed = 0.8
    controls.zoomSpeed = 1.0

    // Verbesserte Beleuchtung für bessere Sichtbarkeit
    const ambientLight = new THREE.AmbientLight(0x606060, 0.8)
    scene.add(ambientLight)

    // Hauptlicht von oben
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2)
    directionalLight.position.set(boardSize.width / 2, boardSize.height * 1.5, boardSize.depth / 2)
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.width = 2048
    directionalLight.shadow.mapSize.height = 2048
    directionalLight.shadow.camera.near = 1
    directionalLight.shadow.camera.far = 1000
    directionalLight.shadow.camera.left = -boardSize.width / 2
    directionalLight.shadow.camera.right = boardSize.width / 2
    directionalLight.shadow.camera.top = boardSize.depth / 2
    directionalLight.shadow.camera.bottom = -boardSize.depth / 2
    scene.add(directionalLight)

    // Zusätzliche Seitenlichter für bessere Ausleuchtung
    const sideLight1 = new THREE.DirectionalLight(0x8888ff, 0.4)
    sideLight1.position.set(-boardSize.width, boardSize.height, 0)
    scene.add(sideLight1)

    const sideLight2 = new THREE.DirectionalLight(0xff8888, 0.4)
    sideLight2.position.set(boardSize.width * 2, boardSize.height, boardSize.depth)
    scene.add(sideLight2)

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



    // Boden erstellen - sichtbarer und kontrastreicher
    const floorGeometry = new THREE.PlaneGeometry(boardSize.width, boardSize.depth)
    const floorMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x1a1a2e,
      transparent: false,
      opacity: 1.0
    })
    const floor = new THREE.Mesh(floorGeometry, floorMaterial)
    floor.rotation.x = -Math.PI / 2
    floor.position.set(boardSize.width / 2, 0, boardSize.depth / 2)
    floor.receiveShadow = true
    boardGroup.add(floor)

    // Wände erstellen - sichtbarer mit Wireframe-Stil
    const wallMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x6a6a8e,
      transparent: true,
      opacity: 0.6,
      wireframe: false,
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

    // Gitterlinien für bessere Orientierung - heller und sichtbarer
    const gridHelper = new THREE.GridHelper(Math.max(boardSize.width, boardSize.depth), 20, 0x666666, 0x333333)
    gridHelper.position.set(boardSize.width / 2, 0.1, boardSize.depth / 2)
    boardGroup.add(gridHelper)

    // Zusätzliche Orientierungslinien an den Achsen
    const axesHelper = new THREE.AxesHelper(Math.min(boardSize.width, boardSize.depth) / 4)
    axesHelper.position.set(5, 1, 5)
    boardGroup.add(axesHelper)
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
        const size = isHead ? boardSize.gridSize * 1.2 : boardSize.gridSize * 0.9
        const geometry = new THREE.BoxGeometry(size, size, size)
        
        const material = new THREE.MeshLambertMaterial({
          color: isHead ? 0xffffff : new THREE.Color(color),
          transparent: false,
          emissive: isHead ? 0x222222 : 0x111111,
          emissiveIntensity: 0.2
        })
        
        const cube = new THREE.Mesh(geometry, material)
        cube.position.set(
          segment.x * boardSize.gridSize + boardSize.gridSize / 2,
          size / 2,
          segment.z * boardSize.gridSize + boardSize.gridSize / 2
        )
        cube.castShadow = true
        cube.receiveShadow = true
        
        // Zusätzlicher Glow-Effekt für den Kopf
        if (isHead) {
          const glowGeometry = new THREE.SphereGeometry(size * 0.6, 16, 16)
          const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.3
          })
          const glow = new THREE.Mesh(glowGeometry, glowMaterial)
          glow.position.copy(cube.position)
          snakeGroup.add(glow)
        }
        
        snakeGroup.add(cube)
      })
    })
  }

  // Futter rendern
  const renderFood = () => {
    if (!sceneRef.current || !gameState) return

    const { foodGroup } = sceneRef.current
    foodGroup.clear()

    gameState.food.forEach(food => {
      const geometry = new THREE.SphereGeometry(boardSize.gridSize * 0.6, 16, 16)
      const material = new THREE.MeshLambertMaterial({
        color: 0xff4444,
        transparent: false,
        emissive: 0x330000,
        emissiveIntensity: 0.3
      })
      
      const sphere = new THREE.Mesh(geometry, material)
      sphere.position.set(
        food.x * boardSize.gridSize + boardSize.gridSize / 2,
        boardSize.gridSize * 0.6,
        food.z * boardSize.gridSize + boardSize.gridSize / 2
      )
      sphere.castShadow = true
      sphere.receiveShadow = true
      
      // Pulsierender Effekt für bessere Sichtbarkeit
      const time = Date.now() * 0.005
      sphere.scale.setScalar(1 + Math.sin(time) * 0.1)
      
      // Glow-Effekt um das Futter
      const glowGeometry = new THREE.SphereGeometry(boardSize.gridSize * 0.8, 16, 16)
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0xff4444,
        transparent: true,
        opacity: 0.2
      })
      const glow = new THREE.Mesh(glowGeometry, glowMaterial)
      glow.position.copy(sphere.position)
      foodGroup.add(glow)
      
      foodGroup.add(sphere)
    })
  }

  // Follow-Modus für eigene Schlange
  const toggleFollowMode = useCallback(() => {
    setFollowMode(prev => !prev)
  }, [])

  const updateCameraFollow = useCallback((playerSnake: any) => {
    if (!sceneRef.current || !followMode || !playerSnake?.snake?.[0]) return
    
    const { camera, controls } = sceneRef.current
    const head = playerSnake.snake[0]
    const targetPos = new THREE.Vector3(
      head.x * boardSize.gridSize + boardSize.gridSize / 2,
      head.y * boardSize.gridSize + boardSize.gridSize / 2 + 50,
      head.z * boardSize.gridSize + boardSize.gridSize / 2 + 50
    )
    
    camera.position.lerp(targetPos, 0.1)
    controls.target.set(
      head.x * boardSize.gridSize + boardSize.gridSize / 2,
      head.y * boardSize.gridSize + boardSize.gridSize / 2,
      head.z * boardSize.gridSize + boardSize.gridSize / 2
    )
  }, [followMode, boardSize])

  // Animation Loop
  const animate = () => {
    if (!sceneRef.current) return

    const { renderer, scene, camera, controls } = sceneRef.current
    
    controls.update()
    
    // Debug-Informationen aktualisieren
    const pos = camera.position
    setDebugInfo({
      cameraPos: `X: ${pos.x.toFixed(1)}, Y: ${pos.y.toFixed(1)}, Z: ${pos.z.toFixed(1)}`,
      objectCount: scene.children.length
    })
    
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
    scene: sceneRef.current,
    followMode,
    toggleFollowMode,
    updateCameraFollow,
    debugInfo
  }
}