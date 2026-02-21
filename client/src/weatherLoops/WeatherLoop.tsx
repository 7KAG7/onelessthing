import React, { useEffect, useRef } from 'react'
import { fullscreenVertexShader } from './fullscreenVertex'
import { WEATHER_LOOP_SECONDS, VARIANT_TO_ID, type WeatherLoopVariant } from './types'
import { weatherFragmentShader } from './weatherFragment'

type ThreeLike = any

declare global {
  interface Window {
    THREE?: ThreeLike
  }
}

let threeLoadPromise: Promise<ThreeLike> | null = null

function loadThreeFromCdn(): Promise<ThreeLike> {
  if (typeof window === 'undefined') return Promise.reject(new Error('window is unavailable'))
  if (window.THREE) return Promise.resolve(window.THREE)
  if (threeLoadPromise) return threeLoadPromise

  threeLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-three-cdn="1"]') as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => resolve(window.THREE), { once: true })
      existing.addEventListener('error', () => reject(new Error('Failed to load Three.js')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://unpkg.com/three@0.160.0/build/three.min.js'
    script.async = true
    script.crossOrigin = 'anonymous'
    script.dataset.threeCdn = '1'
    script.onload = () => {
      if (!window.THREE) {
        reject(new Error('Three.js loaded but window.THREE is undefined'))
        return
      }
      resolve(window.THREE)
    }
    script.onerror = () => reject(new Error('Failed to load Three.js from CDN'))
    document.head.appendChild(script)
  })

  return threeLoadPromise
}

export function WeatherLoop({ variant }: { variant: WeatherLoopVariant }) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const reduceMotionRef = useRef(false)

  useEffect(() => {
    let disposed = false
    let rafId = 0
    let resizeObserver: ResizeObserver | null = null
    let mediaQuery: MediaQueryList | null = null
    let onReducedMotionChange: ((e: MediaQueryListEvent) => void) | null = null

    let renderer: ThreeLike
    let material: ThreeLike
    let geometry: ThreeLike

    const host = hostRef.current
    if (!host) return

    const boot = async () => {
      const THREE = await loadThreeFromCdn()
      if (disposed) return

      const scene = new THREE.Scene()
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

      renderer = new THREE.WebGLRenderer({
        alpha: false,
        antialias: true,
        powerPreference: 'high-performance'
      })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.setClearColor(0x000000, 0)
      host.appendChild(renderer.domElement)

      const uniforms = {
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(1, 1) },
        u_loop_seconds: { value: WEATHER_LOOP_SECONDS },
        u_variant: { value: VARIANT_TO_ID[variant] }
      }

      geometry = new THREE.PlaneGeometry(2, 2)
      material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: fullscreenVertexShader,
        fragmentShader: weatherFragmentShader,
        depthTest: false,
        depthWrite: false
      })

      const mesh = new THREE.Mesh(geometry, material)
      scene.add(mesh)

      const setSize = () => {
        const rect = host.getBoundingClientRect()
        const width = Math.max(1, Math.floor(rect.width))
        const height = Math.max(1, Math.floor(rect.height))
        renderer.setSize(width, height, false)
        uniforms.u_resolution.value.set(width, height)
      }

      const renderOnce = () => {
        uniforms.u_time.value = 0
        renderer.render(scene, camera)
      }

      setSize()
      resizeObserver = new ResizeObserver(() => {
        setSize()
        if (reduceMotionRef.current) renderOnce()
      })
      resizeObserver.observe(host)

      mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
      reduceMotionRef.current = mediaQuery.matches

      onReducedMotionChange = (e: MediaQueryListEvent) => {
        reduceMotionRef.current = e.matches
        if (e.matches) {
          if (rafId) cancelAnimationFrame(rafId)
          renderOnce()
        } else {
          startLoop()
        }
      }

      if (mediaQuery.addEventListener) mediaQuery.addEventListener('change', onReducedMotionChange)
      else mediaQuery.addListener(onReducedMotionChange)

      const fps = 24
      const frameStep = 1 / fps
      const start = performance.now() * 0.001
      let lastFrame = -1

      const tick = (nowMs: number) => {
        if (disposed) return
        if (reduceMotionRef.current) return

        const now = nowMs * 0.001
        const elapsed = now - start

        if (lastFrame < 0 || elapsed - lastFrame >= frameStep) {
          lastFrame = elapsed
          uniforms.u_time.value = elapsed
          renderer.render(scene, camera)
        }

        rafId = requestAnimationFrame(tick)
      }

      const startLoop = () => {
        if (rafId) cancelAnimationFrame(rafId)
        rafId = requestAnimationFrame(tick)
      }

      if (reduceMotionRef.current) renderOnce()
      else startLoop()
    }

    void boot().catch(() => {
      // Keep weather card readable even if shader runtime cannot initialize.
    })

    return () => {
      disposed = true
      if (rafId) cancelAnimationFrame(rafId)
      if (resizeObserver) resizeObserver.disconnect()

      if (mediaQuery && onReducedMotionChange) {
        if (mediaQuery.removeEventListener) mediaQuery.removeEventListener('change', onReducedMotionChange)
        else mediaQuery.removeListener(onReducedMotionChange)
      }

      if (material) material.dispose()
      if (geometry) geometry.dispose()
      if (renderer) {
        renderer.dispose()
        if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement)
      }
    }
  }, [variant])

  return <div ref={hostRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden />
}

export default WeatherLoop
