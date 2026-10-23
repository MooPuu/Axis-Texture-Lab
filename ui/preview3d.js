/* ============================================================
   preview3d.js — Three.js 3D Viewport
   ============================================================ */
(() => {
  'use strict';

  // ---- State -------------------------------------------------
  let scene, camera, renderer;
  let currentObject = null;
  let currentObjectType = 'sphere';
  let currentMapView = 'original';
  let isAutoRotate = false;
  let gridHelper = null;
  let rafId = null;
  let resizeObserver = null;
  let isInitialized = false;
  let initFailed = false;
  let textureCache = {
    original: null,
    normal: null,
    height: null,
    ao: null,
    specular: null,
    roughness: null,
    metallic: null,
    curvature: null,
    slope: null,
  };
  // Separate sRGB copies used only for albedo display, so data maps stay linear.
  let displayCache = {
    original: null,
    normal: null,
    height: null,
    ao: null,
    specular: null,
    roughness: null,
    metallic: null,
    curvature: null,
    slope: null,
  };
  let wireframeHelper = null;
  let showWireframe = false;
  let environmentTarget = null;
  let materialPreset = 'default';

  const MATERIAL_PRESETS = {
    default: { roughness: 0.55, metalness: 0.1, envMapIntensity: 0.4 },
    matte: { roughness: 0.92, metalness: 0.0, envMapIntensity: 0.12 },
    glossy: { roughness: 0.16, metalness: 0.0, envMapIntensity: 1.1 },
    metal: { roughness: 0.34, metalness: 1.0, envMapIntensity: 0.9 },
    chrome: { roughness: 0.04, metalness: 1.0, envMapIntensity: 1.6 },
    plastic: { roughness: 0.3, metalness: 0.0, envMapIntensity: 0.8 },
  };

  // Light references for dynamic control
  let keyLight = null;
  let fillLight = null;
  let rimLight = null;
  let ambientLight = null;

  // ---- DOM refs ----------------------------------------------
  const container = () => document.getElementById('viewport3d');

  // ---- Init --------------------------------------------------
  function init() {
    if (isInitialized || initFailed) return;
    const el = container();
    if (!el) return;

    // The tab can be hidden on startup, in which case clientWidth/Height are 0.
    const w = Math.max(1, el.clientWidth || 640);
    const h = Math.max(1, el.clientHeight || 400);

    scene = new THREE.Scene();
    updateViewportBg();

    camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
    camera.position.set(3, 2, 4);
    camera.lookAt(0, 0.6, 0);

    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true,
      });
    } catch (err) {
      console.error('WebGL initialisation failed:', err);
      initFailed = true;
      const empty = document.getElementById('preview3dEmpty');
      if (empty) empty.textContent = '3D preview is unavailable (WebGL could not start).';
      return;
    }
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);

    // Lights
    const ambient = new THREE.AmbientLight(0x404060, 0.5);
    scene.add(ambient);
    ambientLight = ambient;

    const key = new THREE.DirectionalLight(0xffffff, 2.0);
    key.position.set(5, 8, 6);
    scene.add(key);
    keyLight = key;

    const fill = new THREE.DirectionalLight(0x8888ff, 0.6);
    fill.position.set(-4, 2, -3);
    scene.add(fill);
    fillLight = fill;

    const rim = new THREE.DirectionalLight(0xffffff, 0.8);
    rim.position.set(0, -3, 5);
    scene.add(rim);
    rimLight = rim;

    // Grid (respect the persisted toggle)
    gridHelper = new THREE.GridHelper(6, 12, 0x444466, 0x333355);
    gridHelper.position.y = -0.6;
    gridHelper.visible = document.getElementById('showGrid')?.checked !== false;
    scene.add(gridHelper);

    ensureEnvironment();
    createObject();

    window.addEventListener('resize', resize);
    setupOrbitControls();

    // Re-measure when the 3D tab becomes visible.
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => resize());
      resizeObserver.observe(el);
    }

    isInitialized = true;
    animate();
  }

  // ---- Viewport Background -----------------------------------
  function updateViewportBg() {
    if (!scene) return;
    if (scene.background?.isTexture) scene.background.dispose();

    const bgSetting = document.getElementById('viewportBg')?.value || 'theme';
    const styles = getComputedStyle(document.documentElement);
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

    if (bgSetting === 'checker') {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = styles.getPropertyValue('--bg-primary').trim() || '#0a0a0b';
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = styles.getPropertyValue('--bg-tertiary').trim() || '#1a1a1e';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillRect(32, 32, 32, 32);
      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(4, 4);
      scene.background = texture;
    } else if (bgSetting === 'theme' || bgSetting === 'Follow Theme') {
      const bg = styles.getPropertyValue('--bg-primary').trim();
      scene.background = new THREE.Color(bg || (isDark ? '#0a0a0b' : '#f7f7f8'));
    } else {
      try {
        scene.background = new THREE.Color(bgSetting);
      } catch {
        scene.background = new THREE.Color(isDark ? '#0a0a0b' : '#f7f7f8');
      }
    }
  }

  // ---- Procedural environment ---------------------------------
  // A tiny sky/ground gradient gives metal and chrome presets something to
  // reflect without adding an asset or dependency.
  function ensureEnvironment() {
    if (!renderer || scene.environment || environmentTarget) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      const sky = ctx.createLinearGradient(0, 0, 0, 256);
      sky.addColorStop(0, '#e8f0ff');
      sky.addColorStop(0.42, '#93a6c7');
      sky.addColorStop(0.52, '#5b6272');
      sky.addColorStop(0.7, '#20232b');
      sky.addColorStop(1, '#09090c');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, 512, 256);

      const glow = ctx.createRadialGradient(150, 62, 4, 150, 62, 90);
      glow.addColorStop(0, 'rgba(255,255,245,1)');
      glow.addColorStop(1, 'rgba(255,255,245,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, 512, 256);

      const cool = ctx.createRadialGradient(390, 95, 4, 390, 95, 70);
      cool.addColorStop(0, 'rgba(150,190,255,0.7)');
      cool.addColorStop(1, 'rgba(150,190,255,0)');
      ctx.fillStyle = cool;
      ctx.fillRect(0, 0, 512, 256);

      const texture = new THREE.CanvasTexture(canvas);
      texture.mapping = THREE.EquirectangularReflectionMapping;
      texture.colorSpace = THREE.SRGBColorSpace;
      const pmrem = new THREE.PMREMGenerator(renderer);
      environmentTarget = pmrem.fromEquirectangular(texture);
      scene.environment = environmentTarget.texture;
      texture.dispose();
      pmrem.dispose();
    } catch (err) {
      console.warn('Could not build the preview environment:', err);
    }
  }

  // ---- Toggle Grid -------------------------------------------
  function toggleGrid(show) {
    if (gridHelper) gridHelper.visible = show;
  }

  // ---- Textures ----------------------------------------------
  const MAP_KEYS = ['original', 'normal', 'height', 'ao', 'specular', 'roughness', 'metallic', 'curvature', 'slope'];

  function disposeTextureCache(cache, seen) {
    for (const key of MAP_KEYS) {
      const tex = cache[key];
      if (tex?.isTexture && !seen.has(tex)) {
        seen.add(tex);
        tex.dispose();
      }
      cache[key] = null;
    }
  }

  function releaseTextures() {
    const seen = new Set();
    disposeTextureCache(displayCache, seen);
    disposeTextureCache(textureCache, seen);
  }

  function makeTexture(source, srgb) {
    const tex = new THREE.Texture(source);
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = renderer ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 1;
    tex.needsUpdate = true;
    return tex;
  }

  function imageDataToCanvas(imageData) {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    canvas.getContext('2d').putImageData(imageData, 0, 0);
    return canvas;
  }

  function setTextures(textures) {
    // textures: { original, normal, height, ao, specular, roughness, metallic, curvature, slope }
    if (!isInitialized) init();
    if (!isInitialized) return;

    releaseTextures();

    for (const key of MAP_KEYS) {
      const src = textures[key];
      if (!src) continue;

      const image = src instanceof ImageData ? imageDataToCanvas(src) : src;
      // Height/AO/roughness/etc. are data, not colour: keep them linear.
      textureCache[key] = makeTexture(image, key === 'original');
      // A separate sRGB copy is only used when displaying that map as albedo.
      displayCache[key] = key === 'original' ? textureCache[key] : makeTexture(image, true);
    }

    applyMapView();
  }

  function clearTextures() {
    releaseTextures();
    if (currentObject) {
      const mat = currentObject.material;
      mat.map = null;
      mat.normalMap = null;
      mat.displacementMap = null;
      mat.aoMap = null;
      mat.roughnessMap = null;
      mat.metalnessMap = null;
      mat.needsUpdate = true;
    }
  }

  function applyMapView() {
    if (!currentObject) return;
    const mat = currentObject.material;

    // Reset all map slots and scalar multipliers.
    mat.map = null;
    mat.normalMap = null;
    mat.displacementMap = null;
    mat.aoMap = null;
    mat.roughnessMap = null;
    mat.metalnessMap = null;
    mat.displacementScale = 0;
    mat.displacementBias = 0;

    // Show the selected map as albedo using its sRGB display copy.
    mat.map = displayCache[currentMapView] || null;

    if (currentMapView === 'normal') {
      mat.normalMap = textureCache.normal;
      mat.normalScale = new THREE.Vector2(1, 1);
    } else if (currentMapView === 'height') {
      mat.displacementMap = textureCache.height;
      mat.displacementScale = 0.12;
      mat.displacementBias = -0.04;
    } else if (currentMapView === 'ao') {
      mat.aoMap = textureCache.ao;
      mat.aoMapIntensity = 1;
    } else if (currentMapView === 'roughness') {
      mat.roughnessMap = textureCache.roughness;
    } else if (currentMapView === 'metallic') {
      mat.metalnessMap = textureCache.metallic;
    }

    applyMaterialScalars(mat);
    mat.needsUpdate = true;
  }

  function applyMaterialScalars(mat) {
    if (!mat) return;
    const preset = MATERIAL_PRESETS[materialPreset] || MATERIAL_PRESETS.default;
    mat.roughness = preset.roughness;
    mat.metalness = preset.metalness;
    mat.envMapIntensity = preset.envMapIntensity;
    // Data-map views still show the stored channel at full strength.
    if (currentMapView === 'roughness' && mat.roughnessMap) mat.roughness = 1;
    if (currentMapView === 'metallic' && mat.metalnessMap) mat.metalness = 1;
  }

  function setMaterialPreset(name) {
    materialPreset = Object.prototype.hasOwnProperty.call(MATERIAL_PRESETS, name) ? name : 'default';
    if (currentObject?.material) {
      applyMaterialScalars(currentObject.material);
      currentObject.material.needsUpdate = true;
    }
  }

  function setMapView(view) {
    currentMapView = view;
    applyMapView();
  }

  // ---- Object Management -------------------------------------
  function createObject(type) {
    if (currentObject) {
      scene.remove(currentObject);
      currentObject.geometry.dispose();
      currentObject.material.dispose();
      currentObject = null;
    }

    currentObjectType = type || currentObjectType;

    let geometry;
    switch (currentObjectType) {
      case 'sphere':
        geometry = new THREE.SphereGeometry(1.2, 64, 64);
        break;
      case 'cube':
        geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5, 24, 24, 24);
        break;
      case 'torus':
        geometry = new THREE.TorusGeometry(1.0, 0.4, 32, 48);
        break;
      case 'cylinder':
        geometry = new THREE.CylinderGeometry(0.9, 0.9, 1.6, 48, 24);
        break;
      case 'plane':
        // Enough segments for displacement to actually deform the plane.
        geometry = new THREE.PlaneGeometry(2.4, 2.4, 64, 64);
        break;
      default:
        geometry = new THREE.SphereGeometry(1.2, 64, 64);
    }

    // aoMap in three r160 samples the secondary UV set.
    if (geometry.attributes.uv && !geometry.attributes.uv1) {
      geometry.setAttribute('uv1', geometry.attributes.uv);
    }

    // Position each shape so its bottom rests just above the ground plane (y = -0.6)
    const groundY = -0.6;
    const aboveGround = 0.05; // small gap above ground
    let posY;
    switch (currentObjectType) {
      case 'sphere':
        posY = groundY + aboveGround + 1.2; break;  // radius 1.2
      case 'cube':
        posY = groundY + aboveGround + 0.75; break;  // half-height 0.75
      case 'torus':
        posY = groundY + aboveGround + 0.4; break;   // tube radius 0.4
      case 'cylinder':
        posY = groundY + aboveGround + 0.8; break;   // half-height 0.8
      case 'plane':
        posY = groundY + aboveGround; break;
      default:
        posY = groundY + aboveGround + 1.2;
    }

    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.5,
      metalness: 0.1,
      map: null,
      normalMap: null,
      normalScale: new THREE.Vector2(1, 1),
      displacementMap: null,
      displacementScale: 0.15,
      displacementBias: -0.05,
      aoMap: null,
      roughnessMap: null,
      side: THREE.DoubleSide,
      envMapIntensity: 0.4,
    });

    currentObject = new THREE.Mesh(geometry, material);
    currentObject.position.y = posY;
    scene.add(currentObject);

    // Recreate wireframe if active
    if (showWireframe) createWireframe();

    applyMapView();
  }

  function setObject(type) {
    if (type === currentObjectType && currentObject) return;
    createObject(type);
  }

  // ---- Wireframe ---------------------------------------------
  function createWireframe() {
    if (wireframeHelper) {
      scene.remove(wireframeHelper);
      wireframeHelper.geometry.dispose();
      wireframeHelper.material.dispose();
      wireframeHelper = null;
    }
    if (!showWireframe || !currentObject) return;
    const edges = new THREE.EdgesGeometry(currentObject.geometry);
    wireframeHelper = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x00ccff, transparent: true, opacity: 0.5 })
    );
    wireframeHelper.position.copy(currentObject.position);
    wireframeHelper.rotation.copy(currentObject.rotation);
    scene.add(wireframeHelper);
  }

  function toggleWireframe(on) {
    showWireframe = on;
    if (on) createWireframe();
    else if (wireframeHelper) {
      scene.remove(wireframeHelper);
      wireframeHelper.geometry.dispose();
      wireframeHelper.material.dispose();
      wireframeHelper = null;
    }
  }

  // ---- Lighting Controls --------------------------------------
  function setLighting(settings) {
    if (keyLight && settings.keyPosition) {
      keyLight.position.set(settings.keyPosition.x, settings.keyPosition.y, settings.keyPosition.z);
    }
    if (keyLight && settings.keyIntensity !== undefined) {
      keyLight.intensity = settings.keyIntensity;
    }
    if (fillLight && settings.fillPosition) {
      fillLight.position.set(settings.fillPosition.x, settings.fillPosition.y, settings.fillPosition.z);
    }
    if (fillLight && settings.fillIntensity !== undefined) {
      fillLight.intensity = settings.fillIntensity;
    }
    if (ambientLight && settings.ambientIntensity !== undefined) {
      ambientLight.intensity = settings.ambientIntensity;
    }
    if (rimLight && settings.rimIntensity !== undefined) {
      rimLight.intensity = settings.rimIntensity;
    }
  }

  // ---- Screenshot --------------------------------------------
  function takeScreenshot() {
    if (!isInitialized) return null;
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL('image/png');
  }

  // ---- Camera Controls (Fixed) -------------------------------
  let isDragging = false;
  let previousMouse = { x: 0, y: 0 };

  // "spherical" is the actual camera position used each frame
  // "target*" is where the user moves via drag / scroll
  // Animate() interpolates spherical toward targets for smooth motion
  let spherical = { theta: 0.7, phi: 0.5, radius: 5.5 };
  let targetTheta = 0.7;
  let targetPhi = 0.5;
  let targetRadius = 5.5;

  function onOrbitMouseMove(e) {
    if (!isDragging) return;
    const dx = e.clientX - previousMouse.x;
    const dy = e.clientY - previousMouse.y;

    targetTheta -= dx * 0.008;
    targetPhi = Math.max(0.1, Math.min(Math.PI - 0.1, targetPhi + dy * 0.008));

    previousMouse.x = e.clientX;
    previousMouse.y = e.clientY;
  }

  function onOrbitMouseUp() {
    isDragging = false;
    if (renderer) renderer.domElement.style.cursor = 'grab';
  }

  function setupOrbitControls() {
    const el = renderer.domElement;

    el.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        isDragging = true;
        previousMouse.x = e.clientX;
        previousMouse.y = e.clientY;
        el.style.cursor = 'grabbing';
      }
    });

    window.addEventListener('mousemove', onOrbitMouseMove);

    window.addEventListener('mouseup', onOrbitMouseUp);

    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      targetRadius = Math.max(2, Math.min(12, targetRadius + e.deltaY * 0.008));
    }, { passive: false });

    el.style.cursor = 'grab';

    // Touch support
    let touchStart = null;
    let touchDist = 0;

    el.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        touchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: true });

    el.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && touchStart) {
        const dx = e.touches[0].clientX - touchStart.x;
        const dy = e.touches[0].clientY - touchStart.y;
        targetTheta -= dx * 0.008;
        targetPhi = Math.max(0.1, Math.min(Math.PI - 0.1, targetPhi + dy * 0.008));
        touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        targetRadius = Math.max(2, Math.min(12, targetRadius - (dist - touchDist) * 0.02));
        touchDist = dist;
      }
    }, { passive: true });

    el.addEventListener('touchend', () => {
      touchStart = null;
    }, { passive: true });
  }

  function resetCamera() {
    targetTheta = 0.7;
    targetPhi = 0.5;
    targetRadius = 5.5;
    isAutoRotate = false;
    document.getElementById('btnAutoRotate')?.classList.remove('active');
  }

  function toggleAutoRotate() {
    isAutoRotate = !isAutoRotate;
  }

  // ---- Animation Loop ----------------------------------------
  function animate() {
    if (!isInitialized) return;
    rafId = requestAnimationFrame(animate);

    // Smooth camera interpolation toward drag targets
    const lerp = 0.1;
    spherical.theta += (targetTheta - spherical.theta) * lerp;
    spherical.phi += (targetPhi - spherical.phi) * lerp;
    spherical.radius += (targetRadius - spherical.radius) * lerp;

    // Auto rotate — move the target so rotation persists
    if (isAutoRotate) {
      targetTheta += 0.008;
    }

    const lookY = 0.6;
    const x = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
    const y = spherical.radius * Math.cos(spherical.phi);
    const z = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);

    camera.position.set(x, y + lookY, z);
    camera.lookAt(0, lookY, 0);

    renderer.render(scene, camera);
  }

  // ---- Resize ------------------------------------------------
  function resize() {
    if (!isInitialized) return;
    const el = container();
    if (!el) return;
    const w = Math.max(1, el.clientWidth);
    const h = Math.max(1, el.clientHeight || 400);

    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  // ---- Cleanup -----------------------------------------------
  function destroy() {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
    resizeObserver?.disconnect();
    resizeObserver = null;
    window.removeEventListener('resize', resize);
    window.removeEventListener('mousemove', onOrbitMouseMove);
    window.removeEventListener('mouseup', onOrbitMouseUp);

    releaseTextures();
    if (wireframeHelper) {
      wireframeHelper.geometry.dispose();
      wireframeHelper.material.dispose();
      wireframeHelper = null;
    }
    if (currentObject) {
      currentObject.geometry.dispose();
      currentObject.material.dispose();
      currentObject = null;
    }
    if (gridHelper) {
      gridHelper.geometry.dispose();
      gridHelper.material.dispose();
      gridHelper = null;
    }
    if (scene?.background?.isTexture) scene.background.dispose();
    if (environmentTarget) {
      environmentTarget.dispose();
      environmentTarget = null;
      if (scene) scene.environment = null;
    }

    if (renderer) {
      renderer.domElement.remove();
      renderer.dispose();
      renderer = null;
    }
    scene = null;
    camera = null;
    isInitialized = false;
  }

  // ---- Public API --------------------------------------------
  window.preview3d = {
    init,
    setTextures,
    clearTextures,
    setObject,
    setMapView,
    resetCamera,
    toggleAutoRotate,
    updateViewportBg,
    toggleGrid,
    toggleWireframe,
    setLighting,
    setMaterialPreset,
    takeScreenshot,
    resize,
    destroy,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
