function init() {
  var scene = new THREE.Scene()

  var camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000)

  var webGLRenderer = new THREE.WebGLRenderer()
  webGLRenderer.setClearColor(new THREE.Color(0xffffff))
  webGLRenderer.setSize(window.innerWidth, window.innerHeight)
  webGLRenderer.shadowMapEnabled = true

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

  document.getElementById('output').appendChild(webGLRenderer.domElement)

  webGLRenderer.render(scene, camera)

  function createMesh(geom, xyz) {
    var meshMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    meshMaterial.side = THREE.DoubleSide
    var wireFrameMat = new THREE.MeshBasicMaterial()
    wireFrameMat.wireframe = true

    // get the buffer geometry from geom
    geom = new THREE.BufferGeometry().fromGeometry(geom)
    let mesh = new THREE.Mesh(geom, meshMaterial)

    mesh.position.x = xyz[0]
    mesh.position.y = xyz[1]
    mesh.position.z = xyz[2]

    return mesh
  }
  controls = new THREE.OrbitControls(camera)
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
    const visibilityCounts = []
    for (let i = 0; i < meshes.length; i++) {
      length = meshes[i].geometry.attributes.position.array.length
      visibilityCounts_i = []
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

window.onload = init
