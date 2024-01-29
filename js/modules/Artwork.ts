import common from './Common'

import * as THREE from 'three'

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import { ShadowMapViewer } from 'three/examples/jsm/utils/ShadowMapViewer.js'
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js'

export default class Artwork {
  constructor() {
    this.init()
  }

  init() {
    var scene = new THREE.Scene()

    var camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000)

    var webGLRenderer = new THREE.WebGLRenderer()
    webGLRenderer.setClearColor(new THREE.Color(0xffffff))
    webGLRenderer.setSize(window.innerWidth, window.innerHeight)

    var cube1 = createMesh(new THREE.BoxGeometry(10, 10, 10, 1, 1, 1), [0, 0, 0])
    scene.add(cube1)

    var cube2 = createMesh(new THREE.BoxGeometry(10, 10, 10, 1, 1, 1), [7, 10, 10])
    scene.add(cube2)

    camera.position.x = -20
    camera.position.y = 30
    camera.position.z = 40
    camera.lookAt(new THREE.Vector3(0, 0, 0))

    var spotLight = new THREE.SpotLight(0x000000)
    spotLight.position.set(-40, 60, -10)
    scene.add(spotLight)

    //document.getElementById('output').appendChild(webGLRenderer.domElement)

    webGLRenderer.render(scene, camera)

    function createMesh(geom: THREE.BoxGeometry, xyz: number[]) {
      var meshMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 })
      meshMaterial.side = THREE.DoubleSide
      var wireFrameMat = new THREE.MeshBasicMaterial()
      wireFrameMat.wireframe = true

      // get the buffer geometry from geom
      let bufferGeom = new THREE.BufferGeometry(geom)
      geom.computeVertexNormals()
      //create a buffer
      let mesh = new THREE.Mesh(geom, meshMaterial)

      mesh.position.x = xyz[0]
      mesh.position.y = xyz[1]
      mesh.position.z = xyz[2]

      return mesh
    }
    const controls = new OrbitControls(camera)
    controls.addEventListener('change', updateControls)

    function updateControls() {
      webGLRenderer.render(scene, camera)
    }

    const visibilityCounts = getCameraView(scene)

    //I would like this array to have a zero for each vertex that is not visible and a one for each vertex that is visible
    console.log(visibilityCounts)

    //This is the main function that I am trying to get to work
    function getCameraView(scene) {
      const depthMaterial = new THREE.MeshDepthMaterial()
      depthMaterial.depthPacking = THREE.RGBADepthPacking
      depthMaterial.blending = THREE.NoBlending
      scene.overrideMaterial = depthMaterial

      let meshes = scene.children
      meshes = meshes.filter((mesh) => mesh instanceof THREE.Mesh)

      let size = 256

      const frustum = 30
      const far = 50
      const near = 1

      //I'm creating an orthographic camera here
      const camera = new THREE.OrthographicCamera(frustum / -2, frustum / 2, frustum / 2, frustum / -2, near, far)

      camera.matrixAutoUpdate = true

      camera.position.set(15, 15, 15)
      camera.lookAt(new THREE.Vector3(0, 0, 0))

      const cameraHelper = new THREE.CameraHelper(camera)
      scene.add(cameraHelper)

      const depthRenderer = new THREE.WebGLRenderer({ alpha: true, depth: true, preserveDrawingBuffer: true })
      depthRenderer.setSize(size, size)
      depthRenderer.setClearColor(0xffffff, 0)

      //Initialize the visibilityCounts array. It is the number of meshes by the number of vertices in each mesh
      const visibilityCounts: number[][] = []
      for (let i = 0; i < meshes.length; i++) {
        length = meshes[i].geometry.attributes.position.array.length
        let visibilityCounts_i: number[] = []
        for (let j = 0; j < length; j += 3) {
          visibilityCounts_i.push(0)
        }
        visibilityCounts.push(visibilityCounts_i)
      }

      // Render depth map, this is supposed to be the depth map of the scene from the camera's perspective
      const depthTexture = new THREE.DepthTexture(size, size)
      const renderTarget = new THREE.WebGLRenderTarget(size, size, {
        depthTexture,
        depthBuffer: true,
        format: THREE.RGBAFormat
      })

      //I'm rendering the scene from the camera's perspective here
      depthRenderer.setRenderTarget(renderTarget)
      depthRenderer.render(scene, camera)
      depthRenderer.setRenderTarget(null)

      //This is probably where I go wrong. Not sure how see if each vertex is visible from the camera's perspective here.
      meshes.forEach((mesh) => {
        const vertexArray = mesh.geometry.attributes.position.array

        for (let j = 0; j < vertexArray.length; j += 3) {
          const vertex = new THREE.Vector3(vertexArray[j], vertexArray[j + 1], vertexArray[j + 2])
          const projectedVertex = vertex.clone().project(camera)

          // Convert normalized device coordinates to pixel coordinates
          projectedVertex.x = Math.round(((projectedVertex.x + 1) / 2) * size)
          projectedVertex.y = Math.round(((-projectedVertex.y + 1) / 2) * size)

          const vertexDepth = far - ((projectedVertex.z + 1) / 2) * far

          const buffer = new Uint8Array(4)
          //I'm reading the 4 elements of the buffer here because I think this is the depth value of the pixel. Is this correct?
          depthRenderer.readRenderTargetPixels(renderTarget, projectedVertex.x, projectedVertex.y, 1, 1, buffer)
          const depth = (buffer[3] / 255) * far

          if (vertexDepth < depth) {
            visibilityCounts[meshes.indexOf(mesh)][j / 3]++
          }
        }
      })

      return visibilityCounts
    }
  }
  //this function returns a list of vertices that are in the light.
  //The structure is a list of all the meshes in the scene, and for each mesh, a list with a 0 or 1 for each vertex in the mesh
  //0 means the vertex is not in the light, 1 means it is
  // calculateVerticesInLight() {}

  // createControls() {
  //   this.params = {
  //     depthmapViewer: common.isMobile ? false : true,
  //     visibleShadowCamera: true,
  //     output: 'color shading'
  //   }

  //   this.gui = new GUI()
  //   this.gui.add(this.params, 'depthmapViewer').onChange((value) => {
  //     this.depthViewer.enabled = value
  //   })
  //   this.gui.add(this.params, 'visibleShadowCamera')
  //   this.gui.add(this.params, 'output', ['color shading', 'shadow * lighting', 'shadow', 'lighting']).onChange((value) => {
  //     this.intensity_0.set(0, 0, 0, 0)

  //     switch (value) {
  //       case 'color shading':
  //         this.intensity_0.x = 1
  //         break
  //       case 'shadow * lighting':
  //         this.intensity_0.y = 1
  //         break
  //       case 'shadow':
  //         this.intensity_0.z = 1
  //         break
  //       case 'lighting':
  //         this.intensity_0.w = 1
  //         break
  //     }
  //   })
  // }

  // createMesh() {
  //   this.createGround()
  //   const sphere_s = this.createObj(new THREE.SphereGeometry(10, 32, 32), 0xfaf3f3)
  //   sphere_s.position.set(20, 10, 0)

  //   const cylinder = this.createObj(new THREE.CylinderGeometry(10, 10, 40, 32), 0xfaf3f3)
  //   cylinder.position.set(-20, 20, 40)

  //   const sphere = this.createObj(new THREE.SphereGeometry(24, 32, 32), 0xfaf3f3)
  //   sphere.position.set(-20, 24, 0)

  //   const box = this.createObj(new THREE.BoxGeometry(20, 20, 20), 0xfaf3f3)
  //   box.position.set(40, 10, -30)

  //   const cone = this.createObj(new THREE.ConeGeometry(20, 30, 32), 0xfaf3f3)
  //   cone.position.set(37, 15, 25)
  // }

  // createLight() {
  //   this.light = new THREE.DirectionalLight(0xffffff, 0)
  //   this.light.position.set(-60, 50, 40)

  //   this.scene.add(this.light)

  //   const lightHelper = new THREE.DirectionalLightHelper(this.light, 5)
  //   this.scene.add(lightHelper)

  //   this.helpers.push(lightHelper)

  //   this.frustumSize = 200

  //   this.shadowCamera = this.light.shadow.camera = new THREE.OrthographicCamera(-this.frustumSize / 2, this.frustumSize / 2, this.frustumSize / 2, -this.frustumSize / 2, 1, 200)

  //   this.scene.add(this.shadowCamera)
  //   this.shadowCamera.position.copy(this.light.position)
  //   this.shadowCamera.lookAt(this.scene.position)

  //   this.light.shadow.mapSize.x = 2048
  //   this.light.shadow.mapSize.y = 2048

  //   var pars = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat }
  //   this.light.shadow.map = new THREE.WebGLRenderTarget(this.light.shadow.mapSize.x, this.light.shadow.mapSize.y, pars)

  //   const shadowCameraHelper = new THREE.CameraHelper(this.shadowCamera)
  //   this.scene.add(shadowCameraHelper)

  //   this.helpers.push(shadowCameraHelper)

  //   this.depthViewer = new ShadowMapViewer(this.light)
  //   this.depthViewer.size.set(300, 300)
  //   if (common.isMobile) this.depthViewer.enabled = false
  // }

  // createGround() {
  //   const geometry = new THREE.BoxGeometry(250, 250, 250)
  //   // geometry.rotateX(-Math.PI / 2);

  //   const { material, shadowMaterial } = this.createMaterial(0xe1e5ea, vertexShader, fragmentShader)

  //   const mesh = new THREE.Mesh(geometry, material)

  //   mesh.position.y -= 125

  //   this.meshProps.push({
  //     mesh: mesh,
  //     material: material,
  //     shadowMaterial: shadowMaterial
  //   })

  //   this.group.add(mesh)
  // }

  // createObj(geometry, color) {
  //   const { material, shadowMaterial } = this.createMaterial(color, vertexShader, fragmentShader)

  //   const mesh = new THREE.Mesh(geometry, material)
  //   this.group.add(mesh)

  //   this.meshProps.push({
  //     mesh,
  //     material,
  //     shadowMaterial
  //   })
  //   return mesh
  // }

  // createMaterial(color, vertexShader, fragmentShader) {
  //   const uniforms = {
  //     uTime: {
  //       value: 0
  //     },
  //     uColor: {
  //       value: new THREE.Color(color)
  //     },
  //     uLightPos: {
  //       value: this.light.position
  //     },
  //     uDepthMap: {
  //       value: this.light.shadow.map.texture
  //     },
  //     uShadowCameraP: {
  //       value: this.shadowCamera.projectionMatrix
  //     },
  //     uShadowCameraV: {
  //       value: this.shadowCamera.matrixWorldInverse
  //     },
  //     uIntensity_0: {
  //       value: this.intensity_0
  //     }
  //   }

  //   const material = new THREE.ShaderMaterial({
  //     vertexShader,
  //     fragmentShader,
  //     uniforms
  //   })

  //   const shadowMaterial = new THREE.ShaderMaterial({
  //     vertexShader,
  //     fragmentShader: shadowFragmentShader,
  //     uniforms
  //     // side: THREE.BackSide
  //   })

  //   return { material, shadowMaterial }
  // }

  // resize() {
  //   common.resize()

  //   this.camera.aspect = common.dimensions.x / common.dimensions.y
  //   this.camera.updateProjectionMatrix()

  //   this.depthViewer.updateForWindowResize()
  // }

  // updateLight() {
  //   let x = this.light.position.x
  //   let z = this.light.position.z

  //   const s = Math.sin(common.delta * 0.2)
  //   const c = Math.cos(common.delta * 0.2)

  //   const nx = x * c - z * s
  //   const nz = x * s + z * c

  //   this.light.position.x = nx
  //   this.light.position.z = nz

  //   this.shadowCamera.position.copy(this.light.position)
  //   this.shadowCamera.lookAt(this.scene.position)
  // }

  // update() {
  //   common.update()

  //   // this.updateLight()

  //   for (let i = 0; i < this.meshProps.length; i++) {
  //     const meshProps = this.meshProps[i]
  //     meshProps.mesh.material = meshProps.shadowMaterial
  //   }

  //   for (let i = 0; i < this.helpers.length; i++) {
  //     this.helpers[i].visible = false
  //   }

  //   common.renderer.setRenderTarget(this.light.shadow.map)
  //   common.renderer.render(this.scene, this.shadowCamera)

  //   for (let i = 0; i < this.meshProps.length; i++) {
  //     const meshProps = this.meshProps[i]
  //     meshProps.mesh.material = meshProps.material
  //   }

  //   if (this.params.visibleShadowCamera) {
  //     for (let i = 0; i < this.helpers.length; i++) {
  //       this.helpers[i].visible = true
  //     }
  //   }

  //   common.renderer.setRenderTarget(null)
  //   common.renderer.render(this.scene, this.camera)

  //   this.depthViewer.render(common.renderer)
  // }

  // loop() {
  //   this.update()
  //   window.requestAnimationFrame(this.loop.bind(this))
  // }
}
