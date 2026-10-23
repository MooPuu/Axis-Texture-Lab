/* ============================================================
   randomizer.js — seeded terrain height-map preview
   Fixed orthographic top-down camera. There are intentionally no
   orbit, pan, zoom, or pointer listeners in this viewport.
   ============================================================ */
(() => {
  'use strict';

  let scene = null;
  let camera = null;
  let renderer = null;
  let mesh = null;
  let shadedMaterial = null;
  let heightMaterial = null;
  let shadedTexture = null;
  let heightTexture = null;
  let resizeObserver = null;
  let isInitialized = false;
  let initFailed = false;
  let currentView = 'shaded';
  let lastPayload = null;

  const SEGMENT_LIMIT = 384;
  const VIEW_HALF_SIZE = 1.16;
  const HEIGHT_AMPLITUDE = 0.52;

  // Muted terrain ramp, expressed as sRGB display colours. Three.js expects
  // vertex colours in linear space, so they are converted before upload.
  const RAMP = [
    [0.00, [0.086, 0.145, 0.125]],
    [0.28, [0.196, 0.302, 0.224]],
    [0.52, [0.439, 0.451, 0.325]],
    [0.74, [0.694, 0.663, 0.553]],
    [1.00, [0.925, 0.914, 0.871]],
  ];

  // Low north-west light gives the flat top-down view readable relief.
  const LIGHT = { x: -0.6448, y: 0.6448, z: -0.4103 };

  const container = () => document.getElementById('terrainViewport');

  function init() {
    if (isInitialized || initFailed) return;
    const el = container();
    if (!el) return;
    if (typeof THREE === 'undefined') {
      failPreview('Terrain preview is unavailable because Three.js did not load.');
      return;
    }

    // The tab can be hidden at startup, so clientWidth/Height may be zero.
    const w = Math.max(1, el.clientWidth || 640);
    const h = Math.max(1, el.clientHeight || 400);

    scene = new THREE.Scene();

    // A true top-down orthographic camera. up = -Z keeps north at the top.
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
    camera.position.set(0, 5, 0);
    camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, 0);

    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch (err) {
      console.error('Terrain preview failed to start:', err);
      failPreview('Terrain preview is unavailable (WebGL could not start).');
      return;
    }

    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.style.pointerEvents = 'none';
    renderer.domElement.setAttribute('aria-hidden', 'true');
    el.insertBefore(renderer.domElement, el.firstChild);

    // The shaded view bakes hill shading into a texture. This keeps the fixed
    // top view crisp and readable without low-angle scene-light artefacts.
    shadedMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      toneMapped: false,
      side: THREE.FrontSide,
    });

    heightMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      toneMapped: false,
      side: THREE.FrontSide,
    });

    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(el);

    isInitialized = true;
    resize();
  }

  function failPreview(message) {
    initFailed = true;
    const empty = document.getElementById('terrainEmpty');
    if (!empty) return;
    const heading = empty.querySelector('h3');
    const copy = empty.querySelector('p');
    if (heading) heading.textContent = 'Preview unavailable';
    if (copy) copy.textContent = message;
  }

  function setHeightmap(payload) {
    if (!payload || !payload.data || !payload.size) return;
    lastPayload = payload;
    if (!isInitialized) init();
    if (!isInitialized) return;
    buildTerrain(payload);
  }

  function buildTerrain(payload) {
    const { data, size, imageData } = payload;
    if (data.length < size * size) return;

    const segments = Math.min(SEGMENT_LIMIT, Math.max(16, size - 1));
    const geometry = new THREE.PlaneGeometry(2, 2, segments, segments);
    const positions = geometry.attributes.position;

    for (let iy = 0; iy <= segments; iy++) {
      const sy = Math.min(size - 1, Math.round((iy / segments) * (size - 1)));
      for (let ix = 0; ix <= segments; ix++) {
        const sx = Math.min(size - 1, Math.round((ix / segments) * (size - 1)));
        const index = iy * (segments + 1) + ix;
        const h = Math.max(0, Math.min(1, data[sy * size + sx]));

        // Local Z becomes world Y after the mesh is laid flat.
        positions.setZ(index, h * HEIGHT_AMPLITUDE);
      }
    }

    positions.needsUpdate = true;
    geometry.computeBoundingSphere();

    if (mesh) {
      scene.remove(mesh);
      mesh.geometry.dispose();
    }

    mesh = new THREE.Mesh(
      geometry,
      currentView === 'height' ? heightMaterial : shadedMaterial
    );
    mesh.rotation.x = -Math.PI / 2;
    scene.add(mesh);

    updateShadedTexture(data, size);
    updateHeightTexture(imageData, size);
    hideEmpty();
    render();
  }

  function updateShadedTexture(data, size) {
    if (shadedTexture) {
      shadedTexture.dispose();
      shadedTexture = null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(size, size);
    const pixels = image.data;
    const spacing = 2 / Math.max(1, size - 1);
    // Sample a wider baseline for slopes so fine noise does not become
    // speckled black pins in the shaded relief.
    const step = Math.max(1, Math.round(size / 256));
    const color = [0, 0, 0];

    for (let y = 0; y < size; y++) {
      const up = Math.max(0, y - step);
      const down = Math.min(size - 1, y + step);
      for (let x = 0; x < size; x++) {
        const left = Math.max(0, x - step);
        const right = Math.min(size - 1, x + step);
        const h = data[y * size + x];
        const dx =
          ((data[y * size + right] - data[y * size + left]) *
            HEIGHT_AMPLITUDE) /
          (2 * spacing * step);
        const dz =
          ((data[down * size + x] - data[up * size + x]) *
            HEIGHT_AMPLITUDE) /
          (2 * spacing * step);
        const inv = 1 / Math.sqrt(dx * dx + 1 + dz * dz);
        const light = (-dx * LIGHT.x + LIGHT.y - dz * LIGHT.z) * inv;
        const shade = Math.max(0.58, Math.min(1.03, 0.55 + 0.55 * light));

        sampleRamp(h, color);
        const i = (y * size + x) * 4;
        pixels[i] = Math.round(Math.max(0, Math.min(1, color[0] * shade)) * 255);
        pixels[i + 1] = Math.round(
          Math.max(0, Math.min(1, color[1] * shade)) * 255
        );
        pixels[i + 2] = Math.round(
          Math.max(0, Math.min(1, color[2] * shade)) * 255
        );
        pixels[i + 3] = 255;
      }
    }

    ctx.putImageData(image, 0, 0);
    shadedTexture = new THREE.CanvasTexture(canvas);
    shadedTexture.colorSpace = THREE.SRGBColorSpace;
    shadedTexture.minFilter = THREE.LinearFilter;
    shadedTexture.magFilter = THREE.LinearFilter;
    if (renderer) {
      shadedTexture.anisotropy = Math.min(
        4,
        renderer.capabilities.getMaxAnisotropy()
      );
    }
    shadedMaterial.map = shadedTexture;
    shadedMaterial.needsUpdate = true;
  }

  function updateHeightTexture(imageData, size) {
    if (heightTexture) {
      heightTexture.dispose();
      heightTexture = null;
    }
    if (!imageData) return;

    const canvas = document.createElement('canvas');
    canvas.width = imageData.width || size;
    canvas.height = imageData.height || size;
    canvas.getContext('2d').putImageData(imageData, 0, 0);

    heightTexture = new THREE.CanvasTexture(canvas);
    heightTexture.colorSpace = THREE.SRGBColorSpace;
    heightTexture.minFilter = THREE.LinearFilter;
    heightTexture.magFilter = THREE.LinearFilter;
    heightMaterial.map = heightTexture;
    heightMaterial.needsUpdate = true;
  }

  function sampleRamp(h, out) {
    let a = RAMP[0];
    let b = RAMP[RAMP.length - 1];
    for (let i = 0; i < RAMP.length - 1; i++) {
      if (h >= RAMP[i][0] && h <= RAMP[i + 1][0]) {
        a = RAMP[i];
        b = RAMP[i + 1];
        break;
      }
    }
    const span = Math.max(0.0001, b[0] - a[0]);
    const t = Math.max(0, Math.min(1, (h - a[0]) / span));
    out[0] = a[1][0] + (b[1][0] - a[1][0]) * t;
    out[1] = a[1][1] + (b[1][1] - a[1][1]) * t;
    out[2] = a[1][2] + (b[1][2] - a[1][2]) * t;
  }

  function setViewMode(mode) {
    currentView = mode === 'height' ? 'height' : 'shaded';
    if (mesh) {
      mesh.material = currentView === 'height' ? heightMaterial : shadedMaterial;
    }
    render();
  }

  function resize() {
    if (!renderer || !camera) return;
    const el = container();
    if (!el) return;

    const w = Math.max(1, el.clientWidth || 640);
    const h = Math.max(1, el.clientHeight || 400);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);

    const aspect = w / h;
    camera.left = -VIEW_HALF_SIZE * aspect;
    camera.right = VIEW_HALF_SIZE * aspect;
    camera.top = VIEW_HALF_SIZE;
    camera.bottom = -VIEW_HALF_SIZE;
    camera.updateProjectionMatrix();
    render();
  }

  function hideEmpty() {
    const empty = document.getElementById('terrainEmpty');
    if (empty) empty.style.display = 'none';
  }

  function render() {
    if (renderer && scene && camera) renderer.render(scene, camera);
  }

  function destroy() {
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    if (shadedTexture) {
      shadedTexture.dispose();
      shadedTexture = null;
    }
    if (heightTexture) {
      heightTexture.dispose();
      heightTexture = null;
    }
    if (mesh) {
      scene?.remove(mesh);
      mesh.geometry.dispose();
      mesh = null;
    }
    shadedMaterial?.dispose();
    heightMaterial?.dispose();
    renderer?.dispose();
    if (renderer?.domElement?.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
    scene = null;
    camera = null;
    renderer = null;
    isInitialized = false;
  }

  window.terrainPreview = {
    init,
    setHeightmap,
    setViewMode,
    resize,
    getViewMode: () => currentView,
    destroy,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
