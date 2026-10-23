/* ============================================================
   renderer.js — UI Controller & Image Processing
   Features: Normal/Height/AO/Specular/Roughness/Metallic/Curvature maps,
   image adjustments, seamless tiling, presets, export options, recent files, histogram, pixel info
   ============================================================ */
(() => {
  'use strict';

  // ---- State -------------------------------------------------
  const state = {
    textureData: null,
    normalMapData: null,
    heightMapData: null,
    aoMapData: null,
    specularMapData: null,
    roughnessMapData: null,
    metallicMapData: null,
    curvatureMapData: null,
    slopeMapData: null,
    heightFloatData: null,
    workingInput: null,
    baseMaps: {},
    baseHeightFloat: null,
    mapAdjustments: createDefaultMapAdjustments(),
    isGenerating: false,
    pendingGenerate: false,
    objectUrl: null,
    recentFiles: loadRecentFiles(),
    settings: loadSettings(),
    terrainSettings: loadTerrainSettings(),
    terrainData: null,
    terrainImageData: null,
    terrainSeed: '',
    terrainGenerating: false,
    terrainPending: false,
    terrainReady: false,
  };

  // ---- DOM refs ----------------------------------------------
  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => [...p.querySelectorAll(s)];
  const dom = {};

  function cacheDom() {
    // Sidebar
    dom.dropZone = $('#dropZone'); dom.fileInput = $('#fileInput');
    dom.dropZoneContent = $('#dropZoneContent'); dom.inputPreview = $('#inputPreview');
    dom.inputImage = $('#inputImage'); dom.fileName = $('#fileName'); dom.fileSize = $('#fileSize');
    dom.btnRemoveTexture = $('#btnRemoveTexture');
    dom.btnGenerate = $('#btnGenerate'); dom.btnExport = $('#btnExport');
    dom.btnBatch = $('#btnBatch'); dom.batchInput = $('#batchInput');
    dom.generatorSidebar = $$('.generator-sidebar');
    dom.randomizerSidebar = $$('.randomizer-sidebar');

    // Map generation sliders
    dom.strengthSlider = $('#strengthSlider'); dom.strengthValue = $('#strengthValue');
    dom.blurSlider = $('#blurSlider'); dom.blurValue = $('#blurValue');
    dom.invertCheck = $('#invertCheck');
    dom.aoIntensitySlider = $('#aoIntensitySlider'); dom.aoIntensityValue = $('#aoIntensityValue');
    dom.specularIntensitySlider = $('#specularIntensitySlider'); dom.specularIntensityValue = $('#specularIntensityValue');
    dom.roughnessIntensitySlider = $('#roughnessIntensitySlider'); dom.roughnessIntensityValue = $('#roughnessIntensityValue');
    dom.metallicIntensitySlider = $('#metallicIntensitySlider'); dom.metallicIntensityValue = $('#metallicIntensityValue');
    dom.curvatureIntensitySlider = $('#curvatureIntensitySlider'); dom.curvatureIntensityValue = $('#curvatureIntensityValue');

    // Image adjustments
    dom.brightnessSlider = $('#brightnessSlider'); dom.brightnessValue = $('#brightnessValue');
    dom.contrastSlider = $('#contrastSlider'); dom.contrastValue = $('#contrastValue');
    dom.gammaSlider = $('#gammaSlider'); dom.gammaValue = $('#gammaValue');

    // Seamless tiling
    dom.seamlessCheck = $('#seamlessCheck');
    dom.seamlessWidthSlider = $('#seamlessWidthSlider'); dom.seamlessWidthValue = $('#seamlessWidthValue');

    // Presets
    dom.presetSelect = $('#presetSelect'); dom.btnSavePreset = $('#btnSavePreset');
    dom.btnLoadPreset = $('#btnLoadPreset'); dom.btnDeletePreset = $('#btnDeletePreset');
    dom.btnImportPreset = $('#btnImportPreset'); dom.btnExportPreset = $('#btnExportPreset');
    dom.presetImportInput = $('#presetImportInput');

    // Recent files
    dom.recentFilesContainer = $('#recentFilesContainer');

    // Map preview canvases
    dom.mapsGrid = $('#mapsGrid'); dom.mapsEmpty = $('#mapsEmpty');
    dom.mapsContainer = $('#mapsContainer');
    dom.mapsToolbar = $('#mapsToolbar'); dom.tilePreviewGroup = $('#tilePreviewGroup');
    dom.seamSummary = $('#seamSummary');
    dom.canvasOriginal = $('#canvasOriginal'); dom.canvasNormal = $('#canvasNormal');
    dom.canvasHeight = $('#canvasHeight'); dom.canvasAO = $('#canvasAO');
    dom.canvasSpecular = $('#canvasSpecular'); dom.canvasRoughness = $('#canvasRoughness');
    dom.canvasMetallic = $('#canvasMetallic'); dom.canvasCurvature = $('#canvasCurvature');
    dom.canvasSlope = $('#canvasSlope');

    // Histograms
    dom.histogramCanvases = {
      original: $('#histogramOriginal'), normal: $('#histogramNormal'),
      height: $('#histogramHeight'), ao: $('#histogramAO'),
      specular: $('#histogramSpecular'), roughness: $('#histogramRoughness'),
      metallic: $('#histogramMetallic'), curvature: $('#histogramCurvature'),
      slope: $('#histogramSlope'),
    };

    // Pixel info
    dom.pixelInfo = $('#pixelInfo');

    // Tabs
    dom.tabBtns = $$('.tab-btn[data-tab]');
    dom.tabContents = {
      maps: $('#tab-maps'),
      '3d': $('#tab-3d'),
      randomizer: $('#tab-randomizer'),
    };

    // Terrain randomizer
    dom.terrainSeed = $('#terrainSeed'); dom.btnTerrainRandomSeed = $('#btnTerrainRandomSeed');
    dom.terrainStyle = $('#terrainStyle'); dom.terrainResolution = $('#terrainResolution');
    dom.terrainOctaves = $('#terrainOctaves'); dom.terrainOctavesValue = $('#terrainOctavesValue');
    dom.terrainFrequency = $('#terrainFrequency'); dom.terrainFrequencyValue = $('#terrainFrequencyValue');
    dom.terrainPersistence = $('#terrainPersistence'); dom.terrainPersistenceValue = $('#terrainPersistenceValue');
    dom.terrainLacunarity = $('#terrainLacunarity'); dom.terrainLacunarityValue = $('#terrainLacunarityValue');
    dom.terrainSmoothing = $('#terrainSmoothing'); dom.terrainSmoothingValue = $('#terrainSmoothingValue');
    dom.terrainResolutionLabel = $('#terrainResolutionLabel');
    dom.terrainSeedBadge = $('#terrainSeedBadge');
    dom.terrainViewButtons = $$('[data-terrain-view]');
    dom.terrainEmpty = $('#terrainEmpty');
    dom.btnTerrainGenerate = $('#btnTerrainGenerate');
    dom.btnTerrainUse = $('#btnTerrainUse');
    dom.btnTerrainExport = $('#btnTerrainExport');

    // Settings
    dom.btnSettings = $('#btnSettings'); dom.settingsOverlay = $('#settingsOverlay');
    dom.btnSettingsClose = $('#btnSettingsClose');
    dom.themeOptions = $$('.theme-option'); dom.compactSidebar = $('#compactSidebar');
    dom.exportFormat = $('#exportFormat'); dom.exportRes = $('#exportRes');
    dom.normalFormat = $('#normalFormat');
    dom.exportNaming = $('#exportNaming'); dom.exportCustomName = $('#exportCustomName');
    dom.jpegQuality = $('#jpegQuality'); dom.jpegQualityValue = $('#jpegQualityValue');
    dom.includeOriginal = $('#includeOriginal'); dom.includeAo = $('#includeAo');
    dom.includeSpecular = $('#includeSpecular'); dom.includeRoughness = $('#includeRoughness');
    dom.includeMetallic = $('#includeMetallic'); dom.includeCurvature = $('#includeCurvature');
    dom.includeSlope = $('#includeSlope'); dom.channelPacking = $('#channelPacking');
    dom.exportHeight16 = $('#exportHeight16'); dom.exportBundle = $('#exportBundle');
    dom.exportAtlas = $('#exportAtlas'); dom.atlasColumns = $('#atlasColumns');
    dom.materialPreset = $('#materialPreset'); dom.lightingPreset = $('#lightingPreset');
    dom.adjustTarget = $('#adjustTarget');
    dom.adjustBrightness = $('#adjustBrightness'); dom.adjustBrightnessValue = $('#adjustBrightnessValue');
    dom.adjustContrast = $('#adjustContrast'); dom.adjustContrastValue = $('#adjustContrastValue');
    dom.adjustGamma = $('#adjustGamma'); dom.adjustGammaValue = $('#adjustGammaValue');
    dom.btnApplyAdjust = $('#btnApplyAdjust'); dom.btnResetAdjust = $('#btnResetAdjust');
    dom.adjustHint = $('#adjustHint');
    dom.viewportBg = $('#viewportBg'); dom.showGrid = $('#showGrid');
    dom.appVersion = $('#appVersion'); dom.toastContainer = $('#toastContainer');

    // 3D toolbar
    dom.btnObjectSphere = $('#btnObjectSphere'); dom.btnObjectCube = $('#btnObjectCube');
    dom.btnObjectTorus = $('#btnObjectTorus'); dom.btnObjectCylinder = $('#btnObjectCylinder');
    dom.btnObjectPlane = $('#btnObjectPlane');
    dom.mapViewGroup = $('#mapViewGroup');
    dom.btnResetCamera = $('#btnResetCamera'); dom.btnAutoRotate = $('#btnAutoRotate');
    dom.btnScreenshot = $('#btnScreenshot'); dom.btnWireframe = $('#btnWireframe');
    dom.preview3dEmpty = $('#preview3dEmpty');
    dom.btnLighting = $('#btnLighting'); dom.lightingPopover = $('#lightingPopover');
    dom.lightKeyX = $('#lightKeyX'); dom.lightKeyY = $('#lightKeyY'); dom.lightKeyZ = $('#lightKeyZ');
    dom.lightKeyIntensity = $('#lightKeyIntensity');
    dom.lightKeyXVal = $('#lightKeyXVal'); dom.lightKeyYVal = $('#lightKeyYVal'); dom.lightKeyZVal = $('#lightKeyZVal');
    dom.lightKeyIntensityVal = $('#lightKeyIntensityVal');
    dom.lightFillX = $('#lightFillX'); dom.lightFillY = $('#lightFillY'); dom.lightFillZ = $('#lightFillZ');
    dom.lightFillIntensity = $('#lightFillIntensity');
    dom.lightFillXVal = $('#lightFillXVal'); dom.lightFillYVal = $('#lightFillYVal'); dom.lightFillZVal = $('#lightFillZVal');
    dom.lightFillIntensityVal = $('#lightFillIntensityVal');
    dom.lightAmbient = $('#lightAmbient'); dom.lightRimIntensity = $('#lightRimIntensity');
    dom.lightAmbientVal = $('#lightAmbientVal'); dom.lightRimIntensityVal = $('#lightRimIntensityVal');
    dom.btnLightReset = $('#btnLightReset');

    // Context menu
    dom.contextMenu = $('#contextMenu');
  }

  // ---- Settings ----------------------------------------------
  function loadSettings() {
    try { return JSON.parse(localStorage.getItem('nmg_settings')) || {}; } catch { return {}; }
  }
  function saveSettings() {
    try { localStorage.setItem('nmg_settings', JSON.stringify(state.settings)); } catch {}
  }

  function loadRecentFiles() {
    try { return JSON.parse(localStorage.getItem('nmg_recent')) || []; } catch { return []; }
  }
  function saveRecentFiles() {
    try { localStorage.setItem('nmg_recent', JSON.stringify(state.recentFiles.slice(0, 12))); } catch {}
  }

  function loadTerrainSettings() {
    const defaults = {
      seed: '',
      style: 'hills',
      resolution: 512,
      octaves: 5,
      frequency: 3,
      persistence: 50,
      lacunarity: 2,
      smoothing: 1,
      viewMode: 'shaded',
    };
    try {
      const saved = JSON.parse(localStorage.getItem('nmg_terrain')) || {};
      return { ...defaults, ...saved };
    } catch {
      return defaults;
    }
  }
  function saveTerrainSettings() {
    try { localStorage.setItem('nmg_terrain', JSON.stringify(state.terrainSettings)); } catch {}
  }

  // ---- 3D material & lighting presets ------------------------
  const MATERIAL_PRESET_NAMES = ['default', 'matte', 'glossy', 'metal', 'chrome', 'plastic'];

  const LIGHTING_PRESETS = {
    studio: {
      keyPosition: { x: 5, y: 8, z: 6 }, keyIntensity: 2.0,
      fillPosition: { x: -4, y: 2, z: -3 }, fillIntensity: 0.6,
      ambientIntensity: 0.5, rimIntensity: 0.8,
    },
    soft: {
      keyPosition: { x: 3, y: 6, z: 7 }, keyIntensity: 1.3,
      fillPosition: { x: -5, y: 4, z: 4 }, fillIntensity: 0.9,
      ambientIntensity: 0.85, rimIntensity: 0.35,
    },
    dramatic: {
      keyPosition: { x: 6, y: 7, z: -2 }, keyIntensity: 3.2,
      fillPosition: { x: -6, y: -1, z: 3 }, fillIntensity: 0.25,
      ambientIntensity: 0.12, rimIntensity: 1.4,
    },
    outdoor: {
      keyPosition: { x: -3, y: 9, z: 4 }, keyIntensity: 2.6,
      fillPosition: { x: 5, y: 3, z: 6 }, fillIntensity: 0.5,
      ambientIntensity: 1.1, rimIntensity: 0.25,
    },
  };

  const MAP_ADJUSTMENT_KEYS = ['original', 'normal', 'height', 'ao', 'specular', 'roughness', 'metallic', 'curvature', 'slope'];

  function createDefaultMapAdjustments() {
    return {
      original: { brightness: 0, contrast: 0, gamma: 0 },
      normal: { brightness: 0, contrast: 0, gamma: 0 },
      height: { brightness: 0, contrast: 0, gamma: 0 },
      ao: { brightness: 0, contrast: 0, gamma: 0 },
      specular: { brightness: 0, contrast: 0, gamma: 0 },
      roughness: { brightness: 0, contrast: 0, gamma: 0 },
      metallic: { brightness: 0, contrast: 0, gamma: 0 },
      curvature: { brightness: 0, contrast: 0, gamma: 0 },
      slope: { brightness: 0, contrast: 0, gamma: 0 },
    };
  }

  function applyMaterialPreset(name) {
    const preset = MATERIAL_PRESET_NAMES.includes(name) ? name : 'default';
    state.settings.materialPreset = preset;
    if (dom.materialPreset) dom.materialPreset.value = preset;
    if (window.preview3d) window.preview3d.setMaterialPreset(preset);
  }

  function lightingValuesFromControls() {
    return {
      keyPosition: {
        x: parseFloat(dom.lightKeyX.value),
        y: parseFloat(dom.lightKeyY.value),
        z: parseFloat(dom.lightKeyZ.value),
      },
      keyIntensity: parseFloat(dom.lightKeyIntensity.value),
      fillPosition: {
        x: parseFloat(dom.lightFillX.value),
        y: parseFloat(dom.lightFillY.value),
        z: parseFloat(dom.lightFillZ.value),
      },
      fillIntensity: parseFloat(dom.lightFillIntensity.value),
      ambientIntensity: parseFloat(dom.lightAmbient.value),
      rimIntensity: parseFloat(dom.lightRimIntensity.value),
    };
  }

  function setLightingControls(values) {
    if (!values) return;
    const key = values.keyPosition || {};
    const fill = values.fillPosition || {};
    const assign = (input, value, fallback) => {
      if (!input) return;
      input.value = String(Number.isFinite(Number(value)) ? Number(value) : fallback);
    };
    assign(dom.lightKeyX, key.x, 5); assign(dom.lightKeyY, key.y, 8); assign(dom.lightKeyZ, key.z, 6);
    assign(dom.lightKeyIntensity, values.keyIntensity, 2);
    assign(dom.lightFillX, fill.x, -4); assign(dom.lightFillY, fill.y, 2); assign(dom.lightFillZ, fill.z, -3);
    assign(dom.lightFillIntensity, values.fillIntensity, 0.6);
    assign(dom.lightAmbient, values.ambientIntensity, 0.5);
    assign(dom.lightRimIntensity, values.rimIntensity, 0.8);
    updateLightValueDisplay();
    $$('.lighting-slider').forEach(updateSliderFill);
  }

  function applyLightingSettings() {
    const presetName = dom.lightingPreset?.value;
    let values;
    if (presetName === 'custom' && state.settings.lighting) {
      values = state.settings.lighting;
    } else {
      values = LIGHTING_PRESETS[presetName] || LIGHTING_PRESETS.studio;
    }
    setLightingControls(values);
    if (window.preview3d) window.preview3d.setLighting(values);
    state.settings.lighting = values;
    state.settings.lightingPreset = presetName || 'studio';
  }

  function applyLightingFromControls() {
    const values = lightingValuesFromControls();
    if (window.preview3d) window.preview3d.setLighting(values);
    state.settings.lighting = values;
    saveSettings();
  }

  function updateLightValueDisplay() {
    const set = (el, value) => { if (el) el.textContent = Number(value).toFixed(1); };
    set(dom.lightKeyXVal, dom.lightKeyX?.value);
    set(dom.lightKeyYVal, dom.lightKeyY?.value);
    set(dom.lightKeyZVal, dom.lightKeyZ?.value);
    set(dom.lightKeyIntensityVal, dom.lightKeyIntensity?.value);
    set(dom.lightFillXVal, dom.lightFillX?.value);
    set(dom.lightFillYVal, dom.lightFillY?.value);
    set(dom.lightFillZVal, dom.lightFillZ?.value);
    set(dom.lightFillIntensityVal, dom.lightFillIntensity?.value);
    set(dom.lightAmbientVal, dom.lightAmbient?.value);
    set(dom.lightRimIntensityVal, dom.lightRimIntensity?.value);
  }

  // ---- Per-map adjustment helpers ----------------------------
  function adjustmentLut(brightness, contrast, gamma) {
    const b = brightness / 100;
    const c = Math.max(0, (contrast + 100) / 100);
    const g = Math.max(0.1, 1 + gamma / 10);
    const lut = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      let v = i / 255;
      v = (v - 0.5) * c + 0.5;
      v += b;
      v = Math.pow(Math.max(0, v), 1 / g);
      lut[i] = Math.round(Math.max(0, Math.min(255, v * 255)));
    }
    return lut;
  }

  function adjustImageData(input, brightness, contrast, gamma) {
    const out = new ImageData(new Uint8ClampedArray(input.data), input.width, input.height);
    if (!brightness && !contrast && !gamma) return out;
    const lut = adjustmentLut(brightness, contrast, gamma);
    for (let i = 0; i < out.data.length; i += 4) {
      out.data[i] = lut[out.data[i]];
      out.data[i + 1] = lut[out.data[i + 1]];
      out.data[i + 2] = lut[out.data[i + 2]];
    }
    return out;
  }

  function adjustFloatHeight(input, brightness, contrast, gamma) {
    const out = new Float32Array(input.length);
    const b = brightness / 100;
    const c = Math.max(0, (contrast + 100) / 100);
    const g = Math.max(0.1, 1 + gamma / 10);
    for (let i = 0; i < input.length; i++) {
      let v = input[i];
      v = (v - 0.5) * c + 0.5 + b;
      v = Math.pow(Math.max(0, v), 1 / g);
      out[i] = Math.max(0, Math.min(1, v));
    }
    return out;
  }

  function adjustmentFor(target) {
    return state.mapAdjustments[target] || { brightness: 0, contrast: 0, gamma: 0 };
  }

  function syncAdjustmentControls() {
    if (!dom.adjustTarget) return;
    const target = MAP_ADJUSTMENT_KEYS.includes(dom.adjustTarget.value) ? dom.adjustTarget.value : 'original';
    const values = adjustmentFor(target);
    dom.adjustBrightness.value = values.brightness;
    dom.adjustBrightnessValue.textContent = values.brightness;
    dom.adjustContrast.value = values.contrast;
    dom.adjustContrastValue.textContent = values.contrast;
    dom.adjustGamma.value = values.gamma;
    dom.adjustGammaValue.textContent = values.gamma;
    [dom.adjustBrightness, dom.adjustContrast, dom.adjustGamma].forEach(updateSliderFill);
    if (dom.adjustHint) {
      const label = MAP_LABELS[target] || 'Map';
      const adjusted = values.brightness || values.contrast || values.gamma;
      dom.adjustHint.textContent = adjusted
        ? `${label} has adjustments applied. Reset restores the generated version.`
        : `Adjust ${label.toLowerCase()} without regenerating other maps.`;
    }
  }

  function applySettings() {
    const s = state.settings;
    const theme = s.theme || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    dom.themeOptions.forEach(el => el.classList.toggle('active', el.dataset.theme === theme));

    const sidebar = $('#sidebar');
    sidebar.classList.toggle('compact', !!s.compactSidebar);
    dom.compactSidebar.checked = !!s.compactSidebar;

    dom.exportFormat.value = s.exportFormat || 'png';
    dom.normalFormat.value = s.normalFormat === 'directx' ? 'directx' : 'opengl';
    // Legacy builds stored '1x'; the select now uses numeric values.
    const resValue = s.exportRes === '1x' ? '1' : String(s.exportRes ?? '1');
    dom.exportRes.value = ['0.25', '0.5', '1', '2', '4'].includes(resValue) ? resValue : '1';
    dom.exportNaming.value = s.exportNaming || '{name}_{map}';
    dom.exportCustomName.value = s.exportCustomName || 'texture';
    dom.jpegQuality.value = s.jpegQuality ?? 92;
    dom.jpegQualityValue.textContent = s.jpegQuality ?? 92;

    dom.includeOriginal.checked = s.includeOriginal !== false;
    dom.includeAo.checked = s.includeAo !== false;
    dom.includeSpecular.checked = s.includeSpecular !== false;
    dom.includeRoughness.checked = s.includeRoughness !== false;
    dom.includeMetallic.checked = s.includeMetallic !== false;
    dom.includeCurvature.checked = s.includeCurvature !== false;
    dom.includeSlope.checked = s.includeSlope !== false;

    dom.channelPacking.value = ['none', 'orm', 'rma'].includes(s.channelPacking) ? s.channelPacking : 'none';
    dom.exportHeight16.checked = s.exportHeight16 === true;
    dom.exportBundle.checked = s.exportBundle === true;
    dom.exportAtlas.checked = s.exportAtlas === true;
    dom.atlasColumns.value = ['2', '3', '4'].includes(String(s.atlasColumns)) ? String(s.atlasColumns) : '3';

    const materialPreset = typeof s.materialPreset === 'string' ? s.materialPreset : 'default';
    dom.materialPreset.value = MATERIAL_PRESET_NAMES.includes(materialPreset) ? materialPreset : 'default';
    const lightingPreset = typeof s.lightingPreset === 'string' ? s.lightingPreset : 'studio';
    dom.lightingPreset.value = Object.prototype.hasOwnProperty.call(LIGHTING_PRESETS, lightingPreset) || lightingPreset === 'custom'
      ? lightingPreset
      : 'studio';
    applyMaterialPreset(dom.materialPreset.value);
    applyLightingSettings();

    dom.viewportBg.value = s.viewportBg || 'theme';
    dom.showGrid.checked = s.showGrid !== false;

    dom.strengthSlider.value = s.strength ?? 5;
    dom.strengthValue.textContent = s.strength ?? 5;
    dom.blurSlider.value = s.blur ?? 1;
    dom.blurValue.textContent = s.blur ?? 1;
    dom.invertCheck.checked = s.invertHeight ?? false;

    dom.aoIntensitySlider.value = s.aoIntensity ?? 5;
    dom.aoIntensityValue.textContent = s.aoIntensity ?? 5;
    dom.specularIntensitySlider.value = s.specularIntensity ?? 5;
    dom.specularIntensityValue.textContent = s.specularIntensity ?? 5;
    dom.roughnessIntensitySlider.value = s.roughnessIntensity ?? 5;
    dom.roughnessIntensityValue.textContent = s.roughnessIntensity ?? 5;
    dom.metallicIntensitySlider.value = s.metallicIntensity ?? 5;
    dom.metallicIntensityValue.textContent = s.metallicIntensity ?? 5;
    dom.curvatureIntensitySlider.value = s.curvatureIntensity ?? 5;
    dom.curvatureIntensityValue.textContent = s.curvatureIntensity ?? 5;

    dom.brightnessSlider.value = s.brightness ?? 0;
    dom.brightnessValue.textContent = s.brightness ?? 0;
    dom.contrastSlider.value = s.contrast ?? 0;
    dom.contrastValue.textContent = s.contrast ?? 0;
    dom.gammaSlider.value = s.gamma ?? 0;
    dom.gammaValue.textContent = s.gamma ?? 0;

    dom.seamlessCheck.checked = s.seamless ?? false;
    dom.seamlessWidthSlider.value = s.seamlessWidth ?? 10;
    dom.seamlessWidthValue.textContent = s.seamlessWidth ?? 10;

    syncSliderFills();
    syncTilePreviewButtons();
    syncAdjustmentControls();

    updateRecentFilesUI();

    // Keep the 3D viewport and histogram colours in sync with the theme.
    if (window.preview3d) window.preview3d.updateViewportBg();
    if (state.textureData) drawHistograms();
  }

  // ---- Toast -------------------------------------------------
  function showToast(message, type = 'info', duration = 3000) {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    dom.toastContainer.appendChild(el);
    setTimeout(() => { el.classList.add('toast-out'); setTimeout(() => el.remove(), 300); }, duration);
  }

  // ---- Image Loading & Recent Files --------------------------
  const IMAGE_EXT_RE = /\.(png|jpe?g|webp|bmp)$/i;

  function isImageFile(file) {
    return !!file && (
      (file.type && file.type.startsWith('image/')) ||
      IMAGE_EXT_RE.test(file.name || '')
    );
  }

  function inferMime(name) {
    const ext = (name.split('.').pop() || '').toLowerCase();
    return {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      webp: 'image/webp', bmp: 'image/bmp',
    }[ext] || 'application/octet-stream';
  }

  async function loadTexture(file, pathOverride, options = {}) {
    if (!isImageFile(file)) {
      showToast('Please select a PNG, JPG, WEBP or BMP image.', 'error');
      return;
    }

    try {
      const bitmap = await createImageBitmap(file);
      if (!bitmap.width || !bitmap.height) throw new Error('Image has no readable pixels');

      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext('2d').drawImage(bitmap, 0, 0);
      bitmap.close?.();

      state.textureData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);

      if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
      state.objectUrl = URL.createObjectURL(file);
      dom.inputImage.src = state.objectUrl;

      // Swap the dashed drop zone for the source preview.
      dom.dropZone.style.display = 'none';
      dom.inputPreview.style.display = 'block';
      dom.fileName.textContent = file.name;
      dom.fileName.title = file.name;
      dom.fileSize.textContent = formatFileSize(file.size);
      dom.btnGenerate.disabled = false;

      if (options.addToRecent !== false) addRecentFile(file, pathOverride);
      generateMaps();
    } catch (err) {
      console.error('Failed to load texture:', err);
      showToast('Could not read that image. Try PNG, JPG, WEBP or BMP.', 'error');
    }
  }

  function addRecentFile(file, pathOverride) {
    const path = pathOverride
      || window.electronAPI?.getPathForFile?.(file)
      || file.path
      || '';
    const entry = { name: file.name, path, time: Date.now() };
    state.recentFiles = state.recentFiles.filter(f => f.name !== file.name && (!path || f.path !== path));
    state.recentFiles.unshift(entry);
    if (state.recentFiles.length > 12) state.recentFiles.length = 12;
    saveRecentFiles();
    updateRecentFilesUI();
  }

  function updateRecentFilesUI() {
    const container = dom.recentFilesContainer;
    if (!container) return;
    container.innerHTML = '';
    if (state.recentFiles.length === 0) {
      container.innerHTML = '<span class="recent-empty">No recent files</span>';
      return;
    }
    state.recentFiles.slice(0, 8).forEach(entry => {
      const btn = document.createElement('button');
      btn.className = 'recent-file-btn';
      btn.innerHTML = `<svg class="icon icon-12" aria-hidden="true" focusable="false"><use href="#iconsax-gallery"></use></svg><span></span>`;
      btn.querySelector('span').textContent = entry.name;
      btn.title = entry.path || entry.name;
      btn.addEventListener('click', () => openRecentFile(entry));
      container.appendChild(btn);
    });
  }

  async function openRecentFile(entry) {
    if (!entry.path) {
      showToast(`"${entry.name}" has no saved path — open it from disk once more.`, 'info');
      return;
    }
    if (!window.electronAPI?.fs?.readFile) {
      showToast('Re-open the file from disk to restore it.', 'info');
      return;
    }
    try {
      const buffer = await window.electronAPI.fs.readFile(entry.path);
      const file = new File([buffer], entry.name, { type: inferMime(entry.name) });
      await loadTexture(file, entry.path);
    } catch (err) {
      console.error('Failed to reopen recent file:', err);
      showToast(`Could not open "${entry.name}" — it may have moved.`, 'error');
    }
  }

  function removeTexture() {
    state.textureData = null;
    state.normalMapData = null; state.heightMapData = null;
    state.aoMapData = null; state.specularMapData = null; state.roughnessMapData = null;
    state.metallicMapData = null; state.curvatureMapData = null;
    state.slopeMapData = null; state.heightFloatData = null;
    state.workingInput = null;
    state.baseMaps = {}; state.baseHeightFloat = null;
    state.mapAdjustments = createDefaultMapAdjustments();

    if (state.objectUrl) {
      URL.revokeObjectURL(state.objectUrl);
      state.objectUrl = null;
    }
    dom.inputImage.removeAttribute('src');
    dom.dropZone.style.display = '';
    dom.inputPreview.style.display = 'none';
    dom.fileInput.value = '';
    dom.fileName.textContent = '';
    dom.fileSize.textContent = '—';
    dom.btnGenerate.disabled = true;
    dom.btnExport.disabled = true;
    dom.mapsContainer.style.display = 'none';
    dom.mapsGrid.style.display = '';
    dom.mapsEmpty.style.display = '';
    if (dom.mapsToolbar) dom.mapsToolbar.hidden = true;
    updateSeamDisplay();
    dom.pixelInfo.textContent = '';

    if (window.preview3d) window.preview3d.clearTextures();
    dom.preview3dEmpty.style.display = '';
    syncAdjustmentControls();
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  // ---- Terrain Randomizer ------------------------------------
  const TERRAIN_GENERATE_LABEL =
    '<svg class="icon" aria-hidden="true" focusable="false"><use href="#solar-map"></use></svg><span>Generate Terrain</span>';

  function randomTerrainSeed() {
    const bytes = new Uint8Array(4);
    if (window.crypto?.getRandomValues) {
      window.crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    const token = Array.from(bytes, b => b.toString(36).padStart(2, '0')).join('').slice(0, 6);
    return `AX-${token.toUpperCase()}`;
  }

  function applyTerrainSettings() {
    const t = state.terrainSettings;
    if (!t.seed || typeof t.seed !== 'string') {
      t.seed = randomTerrainSeed();
      saveTerrainSettings();
    }
    t.seed = t.seed.slice(0, 40);
    dom.terrainSeed.value = t.seed;

    dom.terrainStyle.value = ['hills', 'mountains', 'islands'].includes(t.style) ? t.style : 'hills';
    dom.terrainResolution.value = ['256', '512', '1024', '2048'].includes(String(t.resolution))
      ? String(t.resolution)
      : '512';

    dom.terrainOctaves.value = clampNumber(t.octaves, 1, 8, 5, true);
    dom.terrainFrequency.value = clampNumber(t.frequency, 1, 12, 3, false);
    dom.terrainPersistence.value = clampNumber(t.persistence, 20, 80, 50, true);
    dom.terrainLacunarity.value = clampNumber(t.lacunarity, 1.2, 3, 2, false);
    dom.terrainSmoothing.value = clampNumber(t.smoothing, 0, 3, 1, true);

    setTerrainViewState(t.viewMode === 'height' ? 'height' : 'shaded', false);
    updateTerrainReadouts();
    updateTerrainActions();
  }

  function clampNumber(value, min, max, fallback, integer) {
    let n = Number(value);
    if (!Number.isFinite(n)) n = fallback;
    n = Math.max(min, Math.min(max, n));
    return integer ? Math.round(n) : n;
  }

  function updateTerrainReadouts() {
    dom.terrainOctavesValue.textContent = String(parseInt(dom.terrainOctaves.value, 10));
    dom.terrainFrequencyValue.textContent = Number(dom.terrainFrequency.value).toFixed(1);
    dom.terrainPersistenceValue.textContent = `${parseInt(dom.terrainPersistence.value, 10)}%`;
    dom.terrainLacunarityValue.textContent = Number(dom.terrainLacunarity.value).toFixed(1);
    dom.terrainSmoothingValue.textContent = String(parseInt(dom.terrainSmoothing.value, 10));

    const size = dom.terrainResolution.value;
    dom.terrainResolutionLabel.textContent = `${size} × ${size}`;
    dom.terrainSeedBadge.textContent = `SEED ${state.terrainSeed || dom.terrainSeed.value || '—'}`;

    [dom.terrainOctaves, dom.terrainFrequency, dom.terrainPersistence,
      dom.terrainLacunarity, dom.terrainSmoothing].forEach(updateSliderFill);
  }

  function updateTerrainActions() {
    const busy = state.terrainGenerating;
    dom.btnTerrainGenerate.disabled = busy;
    dom.btnTerrainUse.disabled = busy || !state.terrainReady;
    dom.btnTerrainExport.disabled = busy || !state.terrainReady;
  }

  function setTerrainBusy(busy) {
    state.terrainGenerating = busy;
    if (busy) {
      dom.btnTerrainGenerate.innerHTML = '<span class="spinner"></span><span>Generating…</span>';
    } else {
      dom.btnTerrainGenerate.innerHTML = TERRAIN_GENERATE_LABEL;
    }
    updateTerrainActions();
  }

  function setTerrainViewState(mode, persist = true) {
    const view = mode === 'height' ? 'height' : 'shaded';
    state.terrainSettings.viewMode = view;
    dom.terrainViewButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.terrainView === view);
    });
    if (window.terrainPreview) window.terrainPreview.setViewMode(view);
    if (persist) saveTerrainSettings();
  }

  function persistTerrainControls() {
    const t = state.terrainSettings;
    t.seed = dom.terrainSeed.value.trim().slice(0, 40);
    t.style = dom.terrainStyle.value;
    t.resolution = parseInt(dom.terrainResolution.value, 10);
    t.octaves = parseInt(dom.terrainOctaves.value, 10);
    t.frequency = Number(dom.terrainFrequency.value);
    t.persistence = parseInt(dom.terrainPersistence.value, 10);
    t.lacunarity = Number(dom.terrainLacunarity.value);
    t.smoothing = parseInt(dom.terrainSmoothing.value, 10);
    saveTerrainSettings();
  }

  function terrainControlsToParams() {
    return {
      seed: (dom.terrainSeed.value.trim() || randomTerrainSeed()).slice(0, 40),
      style: ['hills', 'mountains', 'islands'].includes(dom.terrainStyle.value)
        ? dom.terrainStyle.value
        : 'hills',
      size: clampNumber(dom.terrainResolution.value, 256, 2048, 512, true),
      octaves: clampNumber(dom.terrainOctaves.value, 1, 8, 5, true),
      frequency: clampNumber(dom.terrainFrequency.value, 1, 12, 3, false),
      persistence: clampNumber(dom.terrainPersistence.value, 20, 80, 50, true) / 100,
      lacunarity: clampNumber(dom.terrainLacunarity.value, 1.2, 3, 2, false),
      smoothing: clampNumber(dom.terrainSmoothing.value, 0, 3, 1, true),
    };
  }

  function hashSeed(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createSeededNoise(seedText) {
    const rng = mulberry32(hashSeed(seedText));
    const source = Array.from({ length: 256 }, (_, i) => i);
    for (let i = source.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [source[i], source[j]] = [source[j], source[i]];
    }
    const perm = new Uint8Array(512);
    for (let i = 0; i < perm.length; i++) perm[i] = source[i & 255];

    const offsetX = (rng() * 2 - 1) * 1024;
    const offsetY = (rng() * 2 - 1) * 1024;

    const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
    const lerp = (a, b, t) => a + (b - a) * t;
    const grad = (hash, x, y) => {
      switch (hash & 7) {
        case 0: return x + y;
        case 1: return -x + y;
        case 2: return x - y;
        case 3: return -x - y;
        case 4: return x;
        case 5: return -x;
        case 6: return y;
        default: return -y;
      }
    };

    function sample(x, y) {
      const xi = Math.floor(x) & 255;
      const yi = Math.floor(y) & 255;
      const xf = x - Math.floor(x);
      const yf = y - Math.floor(y);
      const u = fade(xf);
      const v = fade(yf);

      const aa = perm[perm[xi] + yi];
      const ab = perm[perm[xi] + yi + 1];
      const ba = perm[perm[xi + 1] + yi];
      const bb = perm[perm[xi + 1] + yi + 1];

      const x1 = lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u);
      const x2 = lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u);
      return lerp(x1, x2, v);
    }

    return { sample, offsetX, offsetY };
  }

  function fbmSample(noise, x, y, octaves, persistence, lacunarity) {
    let amplitude = 1;
    let frequency = 1;
    let sum = 0;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += noise.sample(x * frequency, y * frequency) * amplitude;
      norm += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }
    return sum / Math.max(0.0001, norm);
  }

  function ridgedSample(noise, x, y, octaves, persistence, lacunarity) {
    let amplitude = 1;
    let frequency = 1;
    let sum = 0;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      const n = 1 - Math.abs(noise.sample(x * frequency, y * frequency));
      sum += n * n * amplitude;
      norm += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }
    return sum / Math.max(0.0001, norm);
  }

  function normalizeTerrain(data) {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < data.length; i++) {
      if (data[i] < min) min = data[i];
      if (data[i] > max) max = data[i];
    }
    const range = max - min;
    if (!Number.isFinite(range) || range < 0.000001) {
      data.fill(0.5);
      return;
    }
    for (let i = 0; i < data.length; i++) data[i] = (data[i] - min) / range;
  }

  function smoothTerrain(data, size, passes) {
    let source = data;
    for (let pass = 0; pass < passes; pass++) {
      const horizontal = new Float32Array(source.length);
      const output = new Float32Array(source.length);

      for (let y = 0; y < size; y++) {
        const row = y * size;
        for (let x = 0; x < size; x++) {
          const xm = x > 0 ? x - 1 : x;
          const xp = x < size - 1 ? x + 1 : x;
          horizontal[row + x] = (source[row + xm] + source[row + x] + source[row + xp]) / 3;
        }
      }
      for (let y = 0; y < size; y++) {
        const row = y * size;
        const up = (y > 0 ? y - 1 : y) * size;
        const down = (y < size - 1 ? y + 1 : y) * size;
        for (let x = 0; x < size; x++) {
          output[row + x] = (horizontal[up + x] + horizontal[row + x] + horizontal[down + x]) / 3;
        }
      }
      source = output;
    }
    return source;
  }

  async function buildTerrainHeightData(params) {
    const { seed, style, size, octaves, frequency, persistence, lacunarity, smoothing } = params;
    const noise = createSeededNoise(seed);
    const data = new Float32Array(size * size);
    const step = 1 / Math.max(1, size - 1);

    for (let y = 0; y < size; y++) {
      const ny = y * step;
      for (let x = 0; x < size; x++) {
        const nx = x * step;
        const sx = (nx - 0.5) * frequency + noise.offsetX;
        const sy = (ny - 0.5) * frequency + noise.offsetY;

        let value;
        if (style === 'mountains') {
          value = Math.pow(ridgedSample(noise, sx, sy, octaves, persistence, lacunarity), 1.35);
        } else {
          value = fbmSample(noise, sx, sy, octaves, persistence, lacunarity) * 0.5 + 0.5;
          value = Math.max(0, Math.min(1, value));
        }
        data[y * size + x] = value;
      }

      // Yield periodically so large 2048 maps do not freeze the whole app.
      if ((y & 63) === 63) await new Promise(resolve => setTimeout(resolve, 0));
    }

    normalizeTerrain(data);
    if (smoothing > 0) {
      const smoothed = smoothTerrain(data, size, smoothing);
      data.set(smoothed);
    }

    if (style === 'islands') {
      for (let y = 0; y < size; y++) {
        const ny = y * step * 2 - 1;
        for (let x = 0; x < size; x++) {
          const nx = x * step * 2 - 1;
          const dist = Math.sqrt(nx * nx + ny * ny);
          const edge = Math.max(0, Math.min(1, (1 - dist) / 0.62));
          const mask = edge * edge * (3 - 2 * edge);
          data[y * size + x] *= mask;
        }
      }
    }

    normalizeTerrain(data);
    return data;
  }

  function terrainDataToImageData(data, size) {
    const image = new ImageData(size, size);
    for (let i = 0; i < data.length; i++) {
      const value = Math.round(Math.max(0, Math.min(1, data[i])) * 255);
      image.data[i * 4] = value;
      image.data[i * 4 + 1] = value;
      image.data[i * 4 + 2] = value;
      image.data[i * 4 + 3] = 255;
    }
    return image;
  }

  async function generateTerrain(options = {}) {
    if (state.terrainGenerating) {
      state.terrainPending = true;
      return;
    }

    const params = terrainControlsToParams();
    dom.terrainSeed.value = params.seed;
    state.terrainSettings.seed = params.seed;
    persistTerrainControls();
    setTerrainBusy(true);

    if (!state.terrainReady) {
      const heading = dom.terrainEmpty.querySelector('h3');
      const copy = dom.terrainEmpty.querySelector('p');
      if (heading) heading.textContent = 'Generating Terrain';
      if (copy) copy.textContent = `Building a ${params.size} × ${params.size} seeded height map.`;
      dom.terrainEmpty.style.display = '';
    }

    try {
      const data = await buildTerrainHeightData(params);
      const imageData = terrainDataToImageData(data, params.size);

      state.terrainData = data;
      state.terrainImageData = imageData;
      state.terrainSeed = params.seed;
      state.terrainReady = true;
      dom.terrainSeedBadge.textContent = `SEED ${params.seed}`;
      dom.terrainResolutionLabel.textContent = `${params.size} × ${params.size}`;

      if (window.terrainPreview) {
        window.terrainPreview.setHeightmap({
          data,
          size: params.size,
          seed: params.seed,
          imageData,
        });
        window.terrainPreview.resize();
      }

      if (options.announce) {
        showToast(`Terrain ready — ${params.size} × ${params.size}`, 'success', 2200);
      }
    } catch (err) {
      console.error('Terrain generation failed:', err);
      showToast('Terrain generation failed: ' + err.message, 'error');
    } finally {
      setTerrainBusy(false);
      if (state.terrainPending) {
        state.terrainPending = false;
        generateTerrain();
      }
    }
  }

  function ensureTerrainGenerated() {
    if (window.terrainPreview) window.terrainPreview.resize();
    if (!state.terrainReady && !state.terrainGenerating) generateTerrain();
  }

  function setActiveTab(tab) {
    dom.tabBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
    Object.entries(dom.tabContents).forEach(([key, el]) => {
      if (el) el.classList.toggle('active', key === tab);
    });

    const randomizerActive = tab === 'randomizer';
    dom.generatorSidebar.forEach(el => { el.hidden = randomizerActive; });
    dom.randomizerSidebar.forEach(el => { el.hidden = !randomizerActive; });

    if (tab === '3d' && window.preview3d) setTimeout(() => window.preview3d.resize(), 200);
    if (tab === 'randomizer') {
      setTimeout(() => {
        ensureTerrainGenerated();
        if (window.terrainPreview) window.terrainPreview.resize();
      }, 60);
    }
  }

  async function useTerrainAsHeightMap() {
    if (!state.terrainImageData) {
      showToast('Generate a terrain first.', 'info');
      return;
    }
    try {
      const canvas = textureDataToBitmap(state.terrainImageData);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Could not encode the height map');
      const name = `terrain_${sanitizeFileName(state.terrainSeed || 'seed')}.png`;
      const file = new File([blob], name, { type: 'image/png' });
      await loadTexture(file, '', { addToRecent: false });
      setActiveTab('maps');
      showToast('Terrain height map applied as source', 'success', 2200);
    } catch (err) {
      console.error('Could not use terrain as a source:', err);
      showToast('Could not apply the terrain height map.', 'error');
    }
  }

  async function exportTerrainHeightMap() {
    if (!state.terrainImageData) {
      showToast('Generate a terrain first.', 'info');
      return;
    }
    const defaultName = `terrain_${sanitizeFileName(state.terrainSeed || 'seed')}_heightmap.png`;
    try {
      const blob = await imageDataToBlob(state.terrainImageData, 'png', 1);

      if (window.electronAPI?.dialog?.saveFile && window.electronAPI?.fs) {
        const result = await window.electronAPI.dialog.saveFile({
          defaultPath: defaultName,
          filters: [{ name: 'PNG Image', extensions: ['png'] }],
        });
        if (result.canceled || !result.filePath) return;
        await window.electronAPI.fs.writeFile(result.filePath, await blob.arrayBuffer());
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = defaultName;
        a.click();
        URL.revokeObjectURL(url);
      }
      showToast('Height map exported', 'success', 2200);
    } catch (err) {
      console.error('Height map export failed:', err);
      showToast('Could not export the height map.', 'error');
    }
  }

  // ---- Core Map Generation -----------------------------------
  function gatherGenerationParams() {
    return {
      strength: parseInt(dom.strengthSlider.value) / 5,
      blurRadius: parseInt(dom.blurSlider.value),
      invert: dom.invertCheck.checked,
      aoIntensity: parseInt(dom.aoIntensitySlider.value) / 5,
      specIntensity: parseInt(dom.specularIntensitySlider.value) / 5,
      roughIntensity: parseInt(dom.roughnessIntensitySlider.value) / 5,
      metalIntensity: parseInt(dom.metallicIntensitySlider.value) / 5,
      curvIntensity: parseInt(dom.curvatureIntensitySlider.value) / 5,
      brightness: parseInt(dom.brightnessSlider.value),
      contrast: parseInt(dom.contrastSlider.value),
      gammaCorrection: parseInt(dom.gammaSlider.value) / 10,
      seamless: dom.seamlessCheck.checked,
      seamlessWidth: parseInt(dom.seamlessWidthSlider.value),
    };
  }

  function generateMapSet(input, p, settings = {}) {
    let w = input.width, h = input.height;

    // Apply image adjustments to the working copy
    let adjustedInput = input;
    if (p.brightness !== 0 || p.contrast !== 0 || p.gammaCorrection !== 0) {
      adjustedInput = applyImageAdjustments(input, p.brightness, p.contrast, p.gammaCorrection);
    }

    // Apply seamless tiling to working copy
    let workingInput = adjustedInput;
    if (p.seamless) {
      workingInput = makeSeamless(adjustedInput, p.seamlessWidth);
    }

    const w2 = workingInput.width, h2 = workingInput.height;

    // Grayscale height data
    const gray = new Float32Array(w2 * h2);
    for (let i = 0; i < w2 * h2; i++) {
      const idx = i * 4;
      gray[i] = (workingInput.data[idx] * 0.299 + workingInput.data[idx + 1] * 0.587 + workingInput.data[idx + 2] * 0.114) / 255;
    }

    let heightData = gray;
    if (p.blurRadius > 0) heightData = gaussianBlur(gray, w2, h2, p.blurRadius);
    if (p.invert) {
      const inv = new Float32Array(w2 * h2);
      for (let i = 0; i < w2 * h2; i++) inv[i] = 1 - heightData[i];
      heightData = inv;
    }

    const heightFloat = new Float32Array(heightData);
    const heightMapData = floatToImageData(heightData, w2, h2);

    // Normal Map (generated as OpenGL, then flipped exactly for DirectX)
    const normalMapData = generateNormalMap(heightData, w2, h2, p.strength);
    if (settings.normalFormat === 'directx') {
      const normalPixels = normalMapData.data;
      for (let i = 1; i < normalPixels.length; i += 4) normalPixels[i] = 255 - normalPixels[i];
    }

    return {
      original: input,
      workingInput,
      width: w2,
      height: h2,
      heightFloat,
      maps: {
        normal: normalMapData,
        height: heightMapData,
        ao: generateAOMap(heightData, w2, h2, p.aoIntensity),
        specular: generateSpecularMap(workingInput, w2, h2, p.specIntensity),
        roughness: generateRoughnessMap(workingInput, w2, h2, p.roughIntensity),
        metallic: generateMetallicMap(workingInput, w2, h2, p.metalIntensity),
        curvature: generateCurvatureMap(heightData, w2, h2, p.curvIntensity),
        slope: generateSlopeMap(heightData, w2, h2),
      },
    };
  }

  function generateMaps() {
    if (!state.textureData) return;
    if (state.isGenerating) {
      // Remember the request so slider changes made mid-run are not lost.
      state.pendingGenerate = true;
      return;
    }
    state.isGenerating = true;
    dom.btnGenerate.disabled = true;
    dom.btnGenerate.innerHTML = '<span class="spinner"></span><span>Generating maps…</span>';

    setTimeout(() => {
      try {
        const p = gatherGenerationParams();
        const result = generateMapSet(state.textureData, p, state.settings);

        state.normalMapData = result.maps.normal;
        state.heightMapData = result.maps.height;
        state.aoMapData = result.maps.ao;
        state.specularMapData = result.maps.specular;
        state.roughnessMapData = result.maps.roughness;
        state.metallicMapData = result.maps.metallic;
        state.curvatureMapData = result.maps.curvature;
        state.slopeMapData = result.maps.slope;
        state.heightFloatData = result.heightFloat;
        state.workingInput = result.workingInput;

        // Keep untouched copies so per-map adjustments can be reset/applied
        // without regenerating the other maps.
        state.baseMaps = {
          original: state.textureData,
          normal: result.maps.normal,
          height: result.maps.height,
          ao: result.maps.ao,
          specular: result.maps.specular,
          roughness: result.maps.roughness,
          metallic: result.maps.metallic,
          curvature: result.maps.curvature,
          slope: result.maps.slope,
        };
        state.baseHeightFloat = result.heightFloat;
        state.mapAdjustments = createDefaultMapAdjustments();
        syncAdjustmentControls();

        renderPreviews();
        drawHistograms();

        dom.btnExport.disabled = false;
        dom.mapsGrid.style.display = 'none';
        dom.mapsEmpty.style.display = 'none';
        dom.mapsContainer.style.display = 'grid';
        if (dom.mapsToolbar) dom.mapsToolbar.hidden = false;

        if (window.preview3d) {
          const canvas = textureDataToBitmap(result.workingInput);
          window.preview3d.setTextures({
            original: canvas,
            normal: state.normalMapData,
            height: state.heightMapData,
            ao: state.aoMapData,
            specular: state.specularMapData,
            roughness: state.roughnessMapData,
            metallic: state.metallicMapData,
            curvature: state.curvatureMapData,
            slope: state.slopeMapData,
          });
          dom.preview3dEmpty.style.display = 'none';
        }

        showToast(`${Object.keys(result.maps).length} maps generated`, 'success', 2000);
      } catch (err) {
        console.error('Generation error:', err);
        showToast('Generation failed: ' + err.message, 'error');
      } finally {
        state.isGenerating = false;
        dom.btnGenerate.disabled = false;
        dom.btnGenerate.innerHTML =
          `<svg class="icon" aria-hidden="true" focusable="false"><use href="#solar-magic"></use></svg><span>Generate Maps</span>`;

        if (state.pendingGenerate) {
          state.pendingGenerate = false;
          generateMaps();
        }
      }
    }, 50);
  }

  function textureDataToBitmap(imageData) {
    const c = document.createElement('canvas');
    c.width = imageData.width; c.height = imageData.height;
    c.getContext('2d').putImageData(imageData, 0, 0);
    return c;
  }

  function floatToImageData(data, w, h) {
    const img = new ImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const v = Math.round(Math.max(0, Math.min(1, data[i])) * 255);
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    return img;
  }

  // ---- Image Adjustments -------------------------------------
  function applyImageAdjustments(input, brightness, contrast, gamma) {
    const w = input.width, h = input.height;
    const out = new ImageData(w, h);
    // brightness: -100 to 100, contrast: -100 to 100, gamma: 0.0 to 2.0 (0 = no change)
    const b = brightness / 100;
    const c = Math.max(0, (contrast + 100) / 100); // 0..2, 1 = neutral
    const g = Math.max(0.1, 1 + gamma / 10); // 0.1..2.0

    const lookup = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      let v = i / 255;
      // Contrast
      v = (v - 0.5) * c + 0.5;
      // Brightness
      v += b;
      // Gamma
      v = Math.pow(v, 1 / g);
      lookup[i] = Math.round(Math.max(0, Math.min(255, v * 255)));
    }

    for (let i = 0; i < w * h; i++) {
      const idx = i * 4;
      out.data[idx] = lookup[input.data[idx]];
      out.data[idx + 1] = lookup[input.data[idx + 1]];
      out.data[idx + 2] = lookup[input.data[idx + 2]];
      out.data[idx + 3] = input.data[idx + 3];
    }
    return out;
  }

  // ---- Seamless Tiling ---------------------------------------
  function makeSeamless(input, blendWidth) {
    const w = input.width, h = input.height;
    const bw = Math.max(1, Math.min(Math.min(w, h) / 4, blendWidth));
    const out = new ImageData(new Uint8ClampedArray(input.data), w, h);

    // Blend left-right edges
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < bw; x++) {
        const t = x / bw;
        const blend = t * t * (3 - 2 * t); // smoothstep
        const leftIdx = (y * w + x) * 4;
        const rightIdx = (y * w + (w - 1 - x)) * 4;
        for (let c = 0; c < 3; c++) {
          const a = input.data[leftIdx + c];
          const bVal = input.data[rightIdx + c];
          out.data[leftIdx + c] = Math.round(a * (1 - blend) + bVal * blend);
          out.data[rightIdx + c] = Math.round(bVal * (1 - blend) + a * blend);
        }
      }
    }
    // Blend top-bottom edges
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < bw; y++) {
        const t = y / bw;
        const blend = t * t * (3 - 2 * t);
        const topIdx = (y * w + x) * 4;
        const botIdx = ((h - 1 - y) * w + x) * 4;
        for (let c = 0; c < 3; c++) {
          const a = input.data[topIdx + c];
          const bVal = input.data[botIdx + c];
          out.data[topIdx + c] = Math.round(a * (1 - blend) + bVal * blend);
          out.data[botIdx + c] = Math.round(bVal * (1 - blend) + a * blend);
        }
      }
    }
    // Corner blend (4 corners)
    for (let y = 0; y < bw; y++) {
      for (let x = 0; x < bw; x++) {
        const tx = x / bw, ty = y / bw;
        const blend = (tx * tx * (3 - 2 * tx)) * (ty * ty * (3 - 2 * ty));
        const tl = (y * w + x) * 4;
        const tr = (y * w + (w - 1 - x)) * 4;
        const bl = ((h - 1 - y) * w + x) * 4;
        const br = ((h - 1 - y) * w + (w - 1 - x)) * 4;
        for (let c = 0; c < 3; c++) {
          const avg = (input.data[tr + c] + input.data[bl + c] + input.data[br + c]) / 3;
          out.data[tl + c] = Math.round(out.data[tl + c] * (1 - blend) + avg * blend);
        }
      }
    }
    return out;
  }

  // ---- Map Generators ----------------------------------------

  function generateNormalMap(heightData, w, h, strength) {
    const out = new ImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const lx = x === 0 ? w - 1 : x - 1;
        const rx = x === w - 1 ? 0 : x + 1;
        const ly = y === 0 ? h - 1 : y - 1;
        const ry = y === h - 1 ? 0 : y + 1;
        const dx = (heightData[rx + y * w] - heightData[lx + y * w]) * strength;
        const dy = (heightData[x + ry * w] - heightData[x + ly * w]) * strength;
        const len = Math.sqrt(dx * dx + dy * dy + 1);
        const nx = (-dx / len + 1) * 0.5;
        const ny = (-dy / len + 1) * 0.5;
        const nz = (1 / len + 1) * 0.5;
        const idx = (y * w + x) * 4;
        out.data[idx] = Math.round(Math.max(0, Math.min(255, nx * 255)));
        out.data[idx + 1] = Math.round(Math.max(0, Math.min(255, ny * 255)));
        out.data[idx + 2] = Math.round(Math.max(0, Math.min(255, nz * 255)));
        out.data[idx + 3] = 255;
      }
    }
    return out;
  }

  function generateAOMap(heightData, w, h, intensity) {
    const out = new ImageData(w, h);
    const samples = 8;
    const radius = Math.max(2, Math.round(Math.min(w, h) * 0.02));
    const dirs = [];
    for (let i = 0; i < samples; i++) {
      const a = (i / samples) * Math.PI * 2;
      dirs.push({ dx: Math.round(Math.cos(a) * radius), dy: Math.round(Math.sin(a) * radius) });
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ch = heightData[x + y * w];
        let occlusion = 0, count = 0;
        for (const d of dirs) {
          const sx = x + d.dx, sy = y + d.dy;
          if (sx < 0 || sx >= w || sy < 0 || sy >= h) continue;
          const hd = heightData[sx + sy * w] - ch;
          if (hd > 0.02) occlusion += Math.min(1, hd * 3);
          count++;
        }
        const ao = Math.max(0, 1 - (occlusion / Math.max(1, count)) * intensity * 0.6);
        const v = Math.round(ao * 255);
        const idx = (y * w + x) * 4;
        out.data[idx] = out.data[idx + 1] = out.data[idx + 2] = v;
        out.data[idx + 3] = 255;
      }
    }
    return out;
  }

  function generateSpecularMap(input, w, h, intensity) {
    const out = new ImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const r = input.data[idx] / 255, g = input.data[idx + 1] / 255, b = input.data[idx + 2] / 255;
        const lum = r * 0.299 + g * 0.587 + b * 0.114;
        const maxC = Math.max(r, g, b), minC = Math.min(r, g, b);
        const sat = (maxC - minC) / (maxC || 1);
        let spec = lum * 0.5 + sat * 0.5;
        spec = Math.pow(spec, 1.0 / Math.max(0.1, intensity));
        const v = Math.round(Math.max(0, Math.min(255, spec * 255)));
        out.data[idx] = out.data[idx + 1] = out.data[idx + 2] = v;
        out.data[idx + 3] = 255;
      }
    }
    return out;
  }

  function generateRoughnessMap(input, w, h, intensity) {
    const out = new ImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0, count = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const sx = Math.max(0, Math.min(w - 1, x + kx));
            const sy = Math.max(0, Math.min(h - 1, y + ky));
            const idx = (sy * w + sx) * 4;
            sum += (input.data[idx] * 0.299 + input.data[idx + 1] * 0.587 + input.data[idx + 2] * 0.114);
            count++;
          }
        }
        const avg = sum / count;
        const idx = (y * w + x) * 4;
        const pix = input.data[idx] * 0.299 + input.data[idx + 1] * 0.587 + input.data[idx + 2] * 0.114;
        // Blend inverse luminance (darker = rougher) with local detail. Pure
        // local contrast produced almost-black maps on smooth/evenly lit images.
        const lum = pix / 255;
        const local = Math.min(1, Math.abs(pix - avg) / 64);
        let rough = 0.18 + 0.82 * ((1 - lum) * 0.55 + local * 0.45);
        rough = Math.pow(rough, 1.2 - Math.min(0.9, intensity * 0.18));
        const v = Math.round(Math.max(0, Math.min(255, rough * 255)));
        out.data[idx] = out.data[idx + 1] = out.data[idx + 2] = v;
        out.data[idx + 3] = 255;
      }
    }
    return out;
  }

  function generateMetallicMap(input, w, h, intensity) {
    const out = new ImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const r = input.data[idx] / 255, g = input.data[idx + 1] / 255, b = input.data[idx + 2] / 255;
        const maxC = Math.max(r, g, b), minC = Math.min(r, g, b);
        const lum = r * 0.299 + g * 0.587 + b * 0.114;
        // Metals tend to have higher contrast / saturation and darker albedo
        const sat = (maxC - minC) / (maxC || 1);
        let metal = 1 - lum; // darker = more metallic
        metal = metal * 0.6 + sat * 0.4;
        metal = Math.pow(metal, 1.0 / Math.max(0.1, intensity));
        const v = Math.round(Math.max(0, Math.min(255, metal * 255)));
        out.data[idx] = out.data[idx + 1] = out.data[idx + 2] = v;
        out.data[idx + 3] = 255;
      }
    }
    return out;
  }

  function generateCurvatureMap(heightData, w, h, intensity) {
    const out = new ImageData(w, h);
    const laplacianKernel = [
      [0,  1, 0],
      [1, -4, 1],
      [0,  1, 0]
    ];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let lap = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const sx = Math.max(0, Math.min(w - 1, x + kx));
            const sy = Math.max(0, Math.min(h - 1, y + ky));
            lap += heightData[sx + sy * w] * laplacianKernel[ky + 1][kx + 1];
          }
        }
        lap = Math.max(-1, Math.min(1, lap * intensity * 2));
        // Map -1..1 to 0..255: convex (positive) = light, concave (negative) = dark
        const v = Math.round((lap * 0.5 + 0.5) * 255);
        const idx = (y * w + x) * 4;
        out.data[idx] = out.data[idx + 1] = out.data[idx + 2] = v;
        out.data[idx + 3] = 255;
      }
    }
    return out;
  }

  // Seamless 8-bit slope mask from the height field. Central differences with
  // wrapped neighbours keep it tileable; magnitudes are normalised to 0..1.
  function generateSlopeMap(heightData, w, h) {
    const out = new ImageData(w, h);
    const magnitudes = new Float32Array(w * h);
    let maxMag = 0;
    for (let y = 0; y < h; y++) {
      const ym = y === 0 ? h - 1 : y - 1;
      const yp = y === h - 1 ? 0 : y + 1;
      for (let x = 0; x < w; x++) {
        const xm = x === 0 ? w - 1 : x - 1;
        const xp = x === w - 1 ? 0 : x + 1;
        const gx = (heightData[xp + y * w] - heightData[xm + y * w]) * 0.5;
        const gy = (heightData[x + yp * w] - heightData[x + ym * w]) * 0.5;
        const mag = Math.sqrt(gx * gx + gy * gy);
        magnitudes[y * w + x] = mag;
        if (mag > maxMag) maxMag = mag;
      }
    }
    const inv = maxMag > 0.000001 ? 1 / maxMag : 0;
    for (let i = 0; i < w * h; i++) {
      const v = Math.round(Math.max(0, Math.min(1, magnitudes[i] * inv)) * 255);
      const idx = i * 4;
      out.data[idx] = out.data[idx + 1] = out.data[idx + 2] = v;
      out.data[idx + 3] = 255;
    }
    return out;
  }

  // ---- Gaussian Blur -----------------------------------------
  function gaussianBlur(data, w, h, radius) {
    const kernel = gaussianKernel(radius);
    const kHalf = (kernel.length - 1) / 2;
    const tmp = new Float32Array(w * h);
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0, kSum = 0;
        for (let k = 0; k < kernel.length; k++) {
          const sx = x + k - kHalf;
          if (sx < 0 || sx >= w) continue;
          sum += data[sx + y * w] * kernel[k]; kSum += kernel[k];
        }
        tmp[x + y * w] = kSum > 0 ? sum / kSum : 0;
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0, kSum = 0;
        for (let k = 0; k < kernel.length; k++) {
          const sy = y + k - kHalf;
          if (sy < 0 || sy >= h) continue;
          sum += tmp[x + sy * w] * kernel[k]; kSum += kernel[k];
        }
        out[x + y * w] = kSum > 0 ? sum / kSum : 0;
      }
    }
    return out;
  }

  function gaussianKernel(radius) {
    const size = radius * 2 + 1;
    const sigma = radius / 2;
    const k = new Float32Array(size);
    let sum = 0;
    for (let i = 0; i < size; i++) {
      const x = i - radius;
      k[i] = Math.exp(-(x * x) / (2 * sigma * sigma)); sum += k[i];
    }
    for (let i = 0; i < size; i++) k[i] /= sum;
    return k;
  }

  // ---- Render Preview Canvases + Histograms ------------------
  function getTilePreview() {
    const tiles = Number(state.settings.tilePreview);
    return [1, 2, 3].includes(tiles) ? tiles : 1;
  }

  function syncTilePreviewButtons() {
    if (!dom.tilePreviewGroup) return;
    const tiles = getTilePreview();
    dom.tilePreviewGroup.querySelectorAll('[data-tile]').forEach(btn => {
      const active = Number(btn.dataset.tile) === tiles;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  function setTilePreview(tiles) {
    const next = [1, 2, 3].includes(Number(tiles)) ? Number(tiles) : 1;
    state.settings.tilePreview = next;
    saveSettings();
    syncTilePreviewButtons();
    renderPreviews();
  }

  function computeSeamScore(imageData) {
    const { width: w, height: h, data } = imageData;
    let diff = 0;
    for (let y = 0; y < h; y++) {
      const left = (y * w) * 4;
      const right = (y * w + w - 1) * 4;
      for (let c = 0; c < 3; c++) diff += Math.abs(data[left + c] - data[right + c]);
    }
    for (let x = 0; x < w; x++) {
      const top = x * 4;
      const bottom = ((h - 1) * w + x) * 4;
      for (let c = 0; c < 3; c++) diff += Math.abs(data[top + c] - data[bottom + c]);
    }
    const samples = (w + h) * 3;
    return (diff / (samples * 255)) * 100;
  }

  function updateSeamDisplay() {
    if (!dom.mapsContainer) return;
    dom.mapsContainer.querySelectorAll('.seam-badge').forEach(el => el.remove());

    const tiles = getTilePreview();
    if (tiles === 1 || !state.textureData) {
      if (dom.seamSummary) dom.seamSummary.hidden = true;
      return;
    }

    let total = 0;
    let count = 0;
    dom.mapsContainer.querySelectorAll('.map-card[data-map]').forEach(card => {
      const data = getMapData(card.dataset.map);
      if (!data) return;
      const imageWrap = card.querySelector('.map-card-image');
      if (!imageWrap) return;

      const score = computeSeamScore(data);
      const badge = document.createElement('span');
      badge.className = 'seam-badge';
      if (score <= 2) badge.classList.add('is-clean');
      else if (score > 8) badge.classList.add('is-warn');
      badge.textContent = `Seam ${score.toFixed(1)}%`;
      badge.title = 'Edge mismatch across opposite borders. Lower is better.';
      imageWrap.appendChild(badge);

      total += score;
      count++;
    });

    if (!dom.seamSummary) return;
    if (!count) {
      dom.seamSummary.hidden = true;
      return;
    }
    const avg = total / count;
    dom.seamSummary.hidden = false;
    dom.seamSummary.classList.toggle('is-clean', avg <= 2);
    dom.seamSummary.classList.toggle('is-warn', avg > 8);
    dom.seamSummary.textContent = `Avg seam ${avg.toFixed(1)}%`;
    dom.seamSummary.title = 'Average edge mismatch across all visible maps. Lower is better.';
  }

  function renderPreviews() {
    const map = {
      original: dom.canvasOriginal, normal: dom.canvasNormal,
      height: dom.canvasHeight, ao: dom.canvasAO,
      specular: dom.canvasSpecular, roughness: dom.canvasRoughness,
      metallic: dom.canvasMetallic, curvature: dom.canvasCurvature,
      slope: dom.canvasSlope,
    };
    const data = {
      original: state.textureData, normal: state.normalMapData,
      height: state.heightMapData, ao: state.aoMapData,
      specular: state.specularMapData, roughness: state.roughnessMapData,
      metallic: state.metallicMapData, curvature: state.curvatureMapData,
      slope: state.slopeMapData,
    };
    for (const key in map) renderToCanvas(map[key], data[key]);
    updateSeamDisplay();
  }

  function renderToCanvas(canvas, imageData) {
    if (!canvas || !imageData) return;
    canvas.width = imageData.width; canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    const tiles = getTilePreview();

    if (tiles === 1) {
      ctx.putImageData(imageData, 0, 0);
      return;
    }

    // Draw the same map as a repeated tile grid so seams are easy to spot.
    const source = document.createElement('canvas');
    source.width = imageData.width; source.height = imageData.height;
    source.getContext('2d').putImageData(imageData, 0, 0);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const cellW = canvas.width / tiles;
    const cellH = canvas.height / tiles;
    for (let row = 0; row < tiles; row++) {
      for (let col = 0; col < tiles; col++) {
        ctx.drawImage(source, col * cellW, row * cellH, cellW, cellH);
      }
    }
  }

  function drawHistograms() {
    const map = {
      original: state.textureData, normal: state.normalMapData,
      height: state.heightMapData, ao: state.aoMapData,
      specular: state.specularMapData, roughness: state.roughnessMapData,
      metallic: state.metallicMapData, curvature: state.curvatureMapData,
      slope: state.slopeMapData,
    };
    for (const key in map) {
      const canvas = dom.histogramCanvases[key];
      const data = map[key];
      if (!canvas || !data) continue;
      drawHistogram(canvas, data);
    }
  }

  function drawHistogram(canvas, imageData) {
    const w = 128, h = 40;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    const histogram = new Uint32Array(256);
    for (let i = 0; i < imageData.width * imageData.height; i++) {
      const v = imageData.data[i * 4]; // use red channel (grayscale maps are uniform)
      histogram[v]++;
    }
    let maxVal = 1;
    for (let i = 0; i < 256; i++) if (histogram[i] > maxVal) maxVal = histogram[i];

    const styles = getComputedStyle(document.documentElement);
    const accent = styles.getPropertyValue('--accent').trim() || '#5b8cff';
    const bg = styles.getPropertyValue('--bg-tertiary').trim() || '#17171a';

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const barW = w / 256;
    ctx.fillStyle = accent;
    for (let i = 0; i < 256; i++) {
      const ratio = histogram[i] / maxVal;
      const bh = ratio * h;
      ctx.globalAlpha = 0.25 + 0.75 * ratio;
      ctx.fillRect(i * barW, h - bh, Math.max(1, barW + 0.5), bh);
    }
    ctx.globalAlpha = 1;
  }

  // ---- Export -------------------------------------------------
  function sanitizeFileName(name, fallback = 'texture') {
    return String(name || fallback)
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
      .replace(/[. ]+$/, '')
      .slice(0, 80) || fallback;
  }

  function collectExportOptions() {
    return {
      format: dom.exportFormat.value === 'jpg' ? 'jpg' : 'png',
      resScale: parseFloat(dom.exportRes.value) || 1,
      naming: dom.exportNaming.value,
      customName: sanitizeFileName(dom.exportCustomName.value.trim(), 'texture'),
      quality: parseInt(dom.jpegQuality.value) / 100,
      includeOriginal: dom.includeOriginal.checked,
      includeAo: dom.includeAo.checked,
      includeSpecular: dom.includeSpecular.checked,
      includeRoughness: dom.includeRoughness.checked,
      includeMetallic: dom.includeMetallic.checked,
      includeCurvature: dom.includeCurvature.checked,
      includeSlope: dom.includeSlope.checked,
      channelPacking: ['none', 'orm', 'rma'].includes(dom.channelPacking.value) ? dom.channelPacking.value : 'none',
      exportHeight16: dom.exportHeight16.checked,
      exportBundle: dom.exportBundle.checked,
      exportAtlas: dom.exportAtlas.checked,
      atlasColumns: [2, 3, 4].includes(parseInt(dom.atlasColumns.value, 10)) ? parseInt(dom.atlasColumns.value, 10) : 3,
    };
  }

  function mapSetFromState() {
    return {
      original: state.textureData,
      normal: state.normalMapData,
      height: state.heightMapData,
      ao: state.aoMapData,
      specular: state.specularMapData,
      roughness: state.roughnessMapData,
      metallic: state.metallicMapData,
      curvature: state.curvatureMapData,
      slope: state.slopeMapData,
      heightFloat: state.heightFloatData,
      mapWidth: state.normalMapData?.width || state.heightMapData?.width || 0,
      mapHeight: state.normalMapData?.height || state.heightMapData?.height || 0,
    };
  }

  function namingFor(mapName, opts) {
    switch (opts.naming) {
      case '{map}': return mapName;
      case '{map}_{name}': return `${mapName}_${opts.customName}`;
      case '{name}_{map}':
      default: return `${opts.customName}_${mapName}`;
    }
  }

  function buildPackedMap(mapSet, mode) {
    if (mode !== 'orm' && mode !== 'rma') return null;
    const w = mapSet.mapWidth || mapSet.normal?.width;
    const h = mapSet.mapHeight || mapSet.normal?.height;
    if (!w || !h) return null;
    const out = new ImageData(w, h);
    const ao = mapSet.ao?.data;
    const rough = mapSet.roughness?.data;
    const metal = mapSet.metallic?.data;
    for (let i = 0; i < w * h; i++) {
      const idx = i * 4;
      const a = ao ? ao[idx] : 255;
      const r = rough ? rough[idx] : 255;
      const m = metal ? metal[idx] : 0;
      if (mode === 'orm') {
        out.data[idx] = a; out.data[idx + 1] = r; out.data[idx + 2] = m;
      } else {
        out.data[idx] = r; out.data[idx + 1] = m; out.data[idx + 2] = a;
      }
      out.data[idx + 3] = 255;
    }
    return out;
  }

  function buildAtlas(mapSet, opts) {
    const maps = [];
    const add = (key, label, imageData) => {
      if (imageData) maps.push({ key, label, imageData });
    };
    add('normal', 'Normal', mapSet.normal);
    add('height', 'Height', mapSet.height);
    if (opts.includeOriginal) add('original', 'Original', mapSet.original);
    if (opts.includeAo) add('ao', 'AO', mapSet.ao);
    if (opts.includeSpecular) add('specular', 'Specular', mapSet.specular);
    if (opts.includeRoughness) add('roughness', 'Roughness', mapSet.roughness);
    if (opts.includeMetallic) add('metallic', 'Metallic', mapSet.metallic);
    if (opts.includeCurvature) add('curvature', 'Curvature', mapSet.curvature);
    if (opts.includeSlope) add('slope', 'Slope', mapSet.slope);
    if (!maps.length) return null;

    const cellW = maps[0].imageData.width;
    const cellH = maps[0].imageData.height;
    const cols = Math.max(1, Math.min(opts.atlasColumns || 3, maps.length));
    const rows = Math.ceil(maps.length / cols);
    const labelH = Math.max(18, Math.round(cellH * 0.04));
    const canvas = document.createElement('canvas');
    canvas.width = cellW * cols;
    canvas.height = (cellH + labelH) * rows;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#101014';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const fontSize = Math.max(11, Math.round(labelH * 0.62));
    ctx.font = `600 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    ctx.textBaseline = 'middle';

    maps.forEach((entry, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * cellW;
      const y = row * (cellH + labelH);
      ctx.fillStyle = '#1b1b20';
      ctx.fillRect(x, y, cellW, labelH);
      ctx.fillStyle = '#a7a7b3';
      ctx.fillText(entry.label, x + Math.round(fontSize * 0.6), y + labelH * 0.52);
      const tmp = document.createElement('canvas');
      tmp.width = entry.imageData.width;
      tmp.height = entry.imageData.height;
      tmp.getContext('2d').putImageData(entry.imageData, 0, 0);
      ctx.drawImage(tmp, x, y + labelH, cellW, cellH);
    });

    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  function heightFloatToUint16(values, width, height) {
    const out = new Uint16Array(width * height);
    for (let i = 0; i < out.length; i++) {
      const v = Math.max(0, Math.min(1, values?.[i] ?? 0));
      out[i] = Math.round(v * 65535);
    }
    return out;
  }

  function scaleHeight16(values, w, h, scale) {
    if (scale === 1) return { data: values, width: w, height: h };
    const nw = Math.max(1, Math.round(w * scale));
    const nh = Math.max(1, Math.round(h * scale));
    const out = new Uint16Array(nw * nh);
    for (let y = 0; y < nh; y++) {
      const fy = Math.max(0, Math.min(h - 1, (y + 0.5) / scale - 0.5));
      const y0 = Math.floor(fy);
      const y1 = Math.min(h - 1, y0 + 1);
      const ty = fy - y0;
      for (let x = 0; x < nw; x++) {
        const fx = Math.max(0, Math.min(w - 1, (x + 0.5) / scale - 0.5));
        const x0 = Math.floor(fx);
        const x1 = Math.min(w - 1, x0 + 1);
        const tx = fx - x0;
        const a = values[y0 * w + x0], b = values[y0 * w + x1];
        const c = values[y1 * w + x0], d = values[y1 * w + x1];
        const top = a + (b - a) * tx;
        const bottom = c + (d - c) * tx;
        out[y * nw + x] = Math.round(top + (bottom - top) * ty);
      }
    }
    return { data: out, width: nw, height: nh };
  }

  function buildExportEntries(mapSet, opts) {
    const entries = [];
    const addImage = (key, label, imageData, forcePng = false) => {
      if (!imageData) return;
      entries.push({ kind: 'image', key, label, imageData, forcePng });
    };

    addImage('normal_map', 'Normal', mapSet.normal);
    if (!opts.exportHeight16 || !mapSet.heightFloat) addImage('height_map', 'Height', mapSet.height);
    if (opts.includeOriginal) addImage('original', 'Original', mapSet.original);
    if (opts.includeAo) addImage('ao_map', 'AO', mapSet.ao);
    if (opts.includeSpecular) addImage('specular_map', 'Specular', mapSet.specular);
    if (opts.includeRoughness) addImage('roughness_map', 'Roughness', mapSet.roughness);
    if (opts.includeMetallic) addImage('metallic_map', 'Metallic', mapSet.metallic);
    if (opts.includeCurvature) addImage('curvature_map', 'Curvature', mapSet.curvature);
    if (opts.includeSlope) addImage('slope_map', 'Slope', mapSet.slope);

    const packed = buildPackedMap(mapSet, opts.channelPacking);
    if (packed) {
      const mode = opts.channelPacking;
      entries.push({
        kind: 'packed', key: `${mode}`, label: mode.toUpperCase(),
        imageData: packed, forcePng: true,
      });
    }

    if (opts.exportHeight16 && mapSet.heightFloat) {
      entries.push({
        kind: 'height16', key: 'height_map_16bit', label: 'Height 16-bit',
        width: mapSet.mapWidth, height: mapSet.mapHeight,
        data: heightFloatToUint16(mapSet.heightFloat, mapSet.mapWidth, mapSet.mapHeight),
      });
    }

    if (opts.exportAtlas) {
      const atlas = buildAtlas(mapSet, opts);
      if (atlas) {
        entries.push({ kind: 'atlas', key: 'atlas', label: 'Atlas', imageData: atlas, forcePng: true });
      }
    }

    return entries;
  }

  async function encodeExportEntry(entry, opts) {
    if (entry.kind === 'height16') {
      const scaled = scaleHeight16(entry.data, entry.width, entry.height, opts.resScale);
      return {
        name: `${namingFor(entry.key, opts)}.png`,
        buffer: encodePNG16Gray(scaled.data, scaled.width, scaled.height),
      };
    }

    const format = entry.forcePng ? 'png' : opts.format;
    const imageData = opts.resScale !== 1 ? scaleImageData(entry.imageData, opts.resScale) : entry.imageData;
    const blob = await imageDataToBlob(imageData, format, opts.quality);
    const base = entry.kind === 'packed'
      ? `${opts.customName}_${entry.key}`
      : entry.kind === 'atlas'
        ? `${opts.customName}_atlas`
        : namingFor(entry.key, opts);
    return { name: `${base}.${format}`, buffer: await blob.arrayBuffer() };
  }

  async function exportMapSetToDirectory(mapSet, opts, dir, options = {}) {
    const entries = buildExportEntries(mapSet, opts);
    const encoded = [];
    const errors = [];
    for (let i = 0; i < entries.length; i++) {
      try {
        options.onProgress?.(i, entries.length, entries[i].label);
        encoded.push(await encodeExportEntry(entries[i], opts));
      } catch (err) {
        console.error('Failed to encode export entry:', entries[i].key, err);
        errors.push(entries[i].key);
      }
    }

    if (opts.exportBundle) {
      const zipName = `${opts.customName}_maps.zip`;
      const zipBuffer = encodeStoreZip(encoded.map(item => ({
        name: item.name,
        data: new Uint8Array(item.buffer),
      })));
      await window.electronAPI.fs.writeFile(`${dir}/${zipName}`, zipBuffer);
      return { saved: encoded.length, total: entries.length, files: [zipName], errors, bundled: true };
    }

    const files = [];
    for (const item of encoded) {
      try {
        await window.electronAPI.fs.writeFile(`${dir}/${item.name}`, item.buffer);
        files.push(item.name);
      } catch (err) {
        console.error(`Failed to save ${item.name}:`, err);
        errors.push(item.name);
      }
    }
    return { saved: files.length, total: entries.length, files, errors, bundled: false };
  }

  async function exportMaps() {
    if (!state.normalMapData) return;
    if (!window.electronAPI?.dialog) {
      showToast('Export is only available in the desktop app.', 'error');
      return;
    }

    const opts = collectExportOptions();
    const mapSet = mapSetFromState();

    try {
      const dirResult = window.electronAPI.dialog.openDirectory
        ? await window.electronAPI.dialog.openDirectory({ title: 'Select export folder' })
        : await window.electronAPI.dialog.openFile({
            properties: ['openDirectory'], title: 'Select export folder',
          });
      if (dirResult.canceled || !dirResult.filePaths?.[0]) return;
      const dir = dirResult.filePaths[0].replace(/[\\/]+$/, '');

      const result = await exportMapSetToDirectory(mapSet, opts, dir);
      if (result.bundled) {
        showToast(`Exported ${result.files[0]} (${result.saved} files)`, 'success', 3000);
      } else if (result.saved === result.total) {
        showToast(`Exported ${result.saved} files`, 'success', 3000);
      } else {
        showToast(`Exported ${result.saved} of ${result.total} files`, 'info', 4000);
      }
      if (result.errors.length) {
        showToast(`Some outputs failed: ${result.errors.slice(0, 3).join(', ')}`, 'error', 5000);
      }
    } catch (err) {
      console.error('Export failed:', err);
      showToast('Export failed: ' + err.message, 'error');
    }
  }

  function scaleImageData(imageData, scale) {
    if (scale === 1) return imageData;
    const nw = Math.max(1, Math.round(imageData.width * scale));
    const nh = Math.max(1, Math.round(imageData.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = nw; canvas.height = nh;
    const ctx = canvas.getContext('2d');
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = imageData.width; tmpCanvas.height = imageData.height;
    tmpCanvas.getContext('2d').putImageData(imageData, 0, 0);
    // Smooth both up- and down-scaling to avoid aliased/blocky exports.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(tmpCanvas, 0, 0, nw, nh);
    return ctx.getImageData(0, 0, nw, nh);
  }

  function imageDataToBlob(imageData, format, quality) {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = imageData.width; canvas.height = imageData.height;
      canvas.getContext('2d').putImageData(imageData, 0, 0);
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to encode image'));
      }, format === 'jpg' ? 'image/jpeg' : 'image/png', quality);
    });
  }

  // ---- Dependency-free PNG (16-bit grayscale) -----------------
  let CRC_TABLE = null;
  function crcTable() {
    if (CRC_TABLE) return CRC_TABLE;
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      CRC_TABLE[n] = c >>> 0;
    }
    return CRC_TABLE;
  }

  function crc32Parts(parts) {
    const table = crcTable();
    let c = 0xffffffff;
    for (const part of parts) {
      for (let i = 0; i < part.length; i++) c = table[(c ^ part[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function concatBytes(parts) {
    let size = 0;
    for (const p of parts) size += p.length;
    const out = new Uint8Array(size);
    let offset = 0;
    for (const p of parts) { out.set(p, offset); offset += p.length; }
    return out;
  }

  function asciiBytes(text) {
    const out = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
    return out;
  }

  function pngChunk(type, data) {
    const typeBytes = asciiBytes(type);
    const out = new Uint8Array(12 + data.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, data.length, false);
    out.set(typeBytes, 4);
    out.set(data, 8);
    const crc = crc32Parts([typeBytes, data]);
    view.setUint32(8 + data.length, crc, false);
    return out;
  }

  function adler32(bytes) {
    let a = 1, b = 0;
    for (let i = 0; i < bytes.length; i++) {
      a = (a + bytes[i]) % 65521;
      b = (b + a) % 65521;
    }
    return ((b << 16) | a) >>> 0;
  }

  function zlibStore(raw) {
    const parts = [new Uint8Array([0x78, 0x01])];
    let offset = 0;
    do {
      const length = Math.min(65535, raw.length - offset);
      const final = offset + length >= raw.length;
      const header = new Uint8Array(5);
      header[0] = final ? 1 : 0;
      const view = new DataView(header.buffer);
      view.setUint16(1, length, true);
      view.setUint16(3, (~length) & 0xffff, true);
      parts.push(header, raw.subarray(offset, offset + length));
      offset += length;
    } while (offset < raw.length);
    const adler = adler32(raw);
    const tail = new Uint8Array(4);
    new DataView(tail.buffer).setUint32(0, adler, false);
    parts.push(tail);
    return concatBytes(parts);
  }

  function encodePNG16Gray(values, width, height) {
    const rowBytes = 1 + width * 2;
    const raw = new Uint8Array(rowBytes * height);
    for (let y = 0; y < height; y++) {
      const row = y * rowBytes;
      raw[row] = 0; // filter: none
      let offset = row + 1;
      for (let x = 0; x < width; x++) {
        const v = values[y * width + x] & 0xffff;
        raw[offset++] = v >>> 8;      // big-endian 16-bit samples
        raw[offset++] = v & 0xff;
      }
    }

    const ihdr = new Uint8Array(13);
    const ihdrView = new DataView(ihdr.buffer);
    ihdrView.setUint32(0, width, false);
    ihdrView.setUint32(4, height, false);
    ihdr[8] = 16;  // bit depth
    ihdr[9] = 0;   // colour type: grayscale
    ihdr[10] = 0;  // compression
    ihdr[11] = 0;  // filter
    ihdr[12] = 0;  // interlace

    return concatBytes([
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      pngChunk('IHDR', ihdr),
      pngChunk('IDAT', zlibStore(raw)),
      pngChunk('IEND', new Uint8Array(0)),
    ]);
  }

  // ---- Dependency-free store-only ZIP writer -----------------
  function encodeStoreZip(files) {
    const DOS_TIME = 0;
    const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    for (const file of files) {
      const name = new TextEncoder().encode(file.name);
      const data = file.data;
      const crc = crc32Parts([data]);
      const local = new Uint8Array(30 + name.length);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);       // version needed
      lv.setUint16(6, 0x0800, true);   // UTF-8 filename
      lv.setUint16(8, 0, true);        // stored
      lv.setUint16(10, DOS_TIME, true);
      lv.setUint16(12, DOS_DATE, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, data.length, true);
      lv.setUint32(22, data.length, true);
      lv.setUint16(26, name.length, true);
      lv.setUint16(28, 0, true);
      local.set(name, 30);

      localParts.push(local, data);
      const localOffset = offset;
      offset += local.length + data.length;

      const central = new Uint8Array(46 + name.length);
      const cv = new DataView(central.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);       // version made by
      cv.setUint16(6, 20, true);       // version needed
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, DOS_TIME, true);
      cv.setUint16(14, DOS_DATE, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, name.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, localOffset, true);
      central.set(name, 46);
      centralParts.push(central);
    }

    const centralOffset = offset;
    let centralSize = 0;
    for (const part of centralParts) centralSize += part.length;

    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, centralOffset, true);
    ev.setUint16(20, 0, true);

    return concatBytes([...localParts, ...centralParts, eocd]);
  }

  function dataUrlToBlob(dataUrl) {
    const [header, base64] = dataUrl.split(',');
    const mime = header.match(/data:(.*?);/)?.[1] || 'image/png';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  // ---- Batch processing --------------------------------------
  const BATCH_LABEL =
    '<svg class="icon" aria-hidden="true" focusable="false"><use href="#solar-layers"></use></svg><span>Batch Process</span>';

  function setBatchBusy(busy, text) {
    if (!dom.btnBatch) return;
    dom.btnBatch.disabled = busy;
    if (busy) {
      dom.btnBatch.innerHTML = '<span class="spinner"></span><span></span>';
      dom.btnBatch.querySelector('span:last-child').textContent = text || 'Batch processing…';
    } else {
      dom.btnBatch.innerHTML = BATCH_LABEL;
    }
  }

  async function runBatch(files) {
    if (!files?.length) return;
    if (!window.electronAPI?.dialog || !window.electronAPI?.fs) {
      showToast('Batch processing is only available in the desktop app.', 'error');
      return;
    }

    let dirResult;
    try {
      dirResult = await window.electronAPI.dialog.openDirectory({ title: 'Select batch export folder' });
    } catch (err) {
      console.error('Batch folder dialog failed:', err);
      showToast('Could not open the folder picker.', 'error');
      return;
    }
    if (dirResult.canceled || !dirResult.filePaths?.[0]) return;
    const dir = dirResult.filePaths[0].replace(/[\\/]+$/, '');

    const params = gatherGenerationParams();
    const generationSettings = { normalFormat: state.settings.normalFormat };
    const baseOpts = collectExportOptions();
    const failed = [];
    let exported = 0;

    setBatchBusy(true, `Batch 0/${files.length}…`);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const displayName = file.name.length > 34 ? file.name.slice(0, 31) + '…' : file.name;
      setBatchBusy(true, `Batch ${i + 1}/${files.length} · ${displayName}`);
      try {
        await new Promise(resolve => setTimeout(resolve, 0));
        const bitmap = await createImageBitmap(file);
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close?.();
        const input = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const result = generateMapSet(input, params, generationSettings);
        const mapSet = {
          original: input,
          ...result.maps,
          heightFloat: result.heightFloat,
          mapWidth: result.width,
          mapHeight: result.height,
        };
        const opts = {
          ...baseOpts,
          customName: sanitizeFileName(file.name.replace(/\.[^.]+$/, ''), 'texture'),
        };
        const res = await exportMapSetToDirectory(mapSet, opts, dir, {
          onProgress: (index, total, label) => {
            setBatchBusy(true, `Batch ${i + 1}/${files.length} · ${label}`);
          },
        });
        if (res.errors.length) failed.push(file.name);
        else exported++;
      } catch (err) {
        console.error(`Batch failed for ${file.name}:`, err);
        failed.push(file.name);
      }
    }

    setBatchBusy(false);
    if (!failed.length) {
      showToast(`Batch complete — ${exported} image${exported === 1 ? '' : 's'} exported`, 'success', 4000);
    } else if (exported) {
      showToast(`Batch exported ${exported} of ${files.length}; failed: ${failed.slice(0, 3).join(', ')}${failed.length > 3 ? '…' : ''}`, 'info', 6000);
    } else {
      showToast('Batch failed for every image. Check the console for details.', 'error', 5000);
    }
  }

  // ---- Per-map adjustments -----------------------------------
  function stateKeyForMap(target) {
    return {
      original: 'textureData',
      normal: 'normalMapData',
      height: 'heightMapData',
      ao: 'aoMapData',
      specular: 'specularMapData',
      roughness: 'roughnessMapData',
      metallic: 'metallicMapData',
      curvature: 'curvatureMapData',
      slope: 'slopeMapData',
    }[target];
  }

  function applyMapAdjustments() {
    const target = MAP_ADJUSTMENT_KEYS.includes(dom.adjustTarget.value) ? dom.adjustTarget.value : 'original';
    const base = state.baseMaps[target];
    if (!base) {
      showToast('Generate maps before applying adjustments.', 'info');
      return;
    }
    const values = {
      brightness: parseInt(dom.adjustBrightness.value, 10) || 0,
      contrast: parseInt(dom.adjustContrast.value, 10) || 0,
      gamma: parseInt(dom.adjustGamma.value, 10) || 0,
    };
    state.mapAdjustments[target] = values;

    const stateKey = stateKeyForMap(target);
    if (!stateKey) return;
    state[stateKey] = adjustImageData(base, values.brightness, values.contrast, values.gamma);

    if (target === 'height' && state.baseHeightFloat) {
      state.heightFloatData = adjustFloatHeight(state.baseHeightFloat, values.brightness, values.contrast, values.gamma);
    }

    renderPreviews();
    drawHistograms();
    refresh3DTextures();
    syncAdjustmentControls();
    showToast(`${MAP_LABELS[target] || 'Map'} adjusted`, 'success', 1800);
  }

  function resetMapAdjustments() {
    const target = MAP_ADJUSTMENT_KEYS.includes(dom.adjustTarget.value) ? dom.adjustTarget.value : 'original';
    const base = state.baseMaps[target];
    if (!base) {
      showToast('Generate maps before resetting adjustments.', 'info');
      return;
    }
    state.mapAdjustments[target] = { brightness: 0, contrast: 0, gamma: 0 };
    const stateKey = stateKeyForMap(target);
    state[stateKey] = base;
    if (target === 'height' && state.baseHeightFloat) {
      state.heightFloatData = state.baseHeightFloat;
    }

    renderPreviews();
    drawHistograms();
    refresh3DTextures();
    syncAdjustmentControls();
    showToast(`${MAP_LABELS[target] || 'Map'} reset`, 'info', 1800);
  }

  function refresh3DTextures() {
    if (!window.preview3d || !state.normalMapData) return;
    window.preview3d.setTextures({
      original: textureDataToBitmap(state.textureData),
      normal: state.normalMapData,
      height: state.heightMapData,
      ao: state.aoMapData,
      specular: state.specularMapData,
      roughness: state.roughnessMapData,
      metallic: state.metallicMapData,
      curvature: state.curvatureMapData,
      slope: state.slopeMapData,
    });
  }

  // ---- Save individual map card --------------------------------
  function getMapData(mapType) {
    return {
      original: state.textureData,
      normal: state.normalMapData,
      height: state.heightMapData,
      ao: state.aoMapData,
      specular: state.specularMapData,
      roughness: state.roughnessMapData,
      metallic: state.metallicMapData,
      curvature: state.curvatureMapData,
      slope: state.slopeMapData,
    }[mapType];
  }

  async function saveMapCard(mapType) {
    const data = getMapData(mapType);
    if (!data) {
      showToast('That map has not been generated yet.', 'info');
      return;
    }
    if (!window.electronAPI?.dialog) {
      showToast('Saving is only available in the desktop app.', 'error');
      return;
    }

    const format = dom.exportFormat.value;
    const use16 = mapType === 'height' && dom.exportHeight16.checked && state.heightFloatData;
    const ext = use16 ? 'png' : (format === 'jpg' ? 'jpg' : 'png');
    const quality = parseInt(dom.jpegQuality.value) / 100;
    const naming = dom.exportNaming.value;
    const customName = sanitizeFileName(dom.exportCustomName.value.trim(), 'texture');
    const mapName = use16
      ? 'height_map_16bit'
      : (mapType === 'original' ? 'original' : `${mapType}_map`);

    let fileName;
    switch (naming) {
      case '{map}': fileName = `${mapName}.${ext}`; break;
      case '{name}_{map}': fileName = `${customName}_${mapName}.${ext}`; break;
      case '{map}_{name}': fileName = `${mapName}_${customName}.${ext}`; break;
      default: fileName = `${customName}_${mapName}.${ext}`;
    }

    try {
      const result = await window.electronAPI.dialog.saveFile({
        defaultPath: fileName,
        filters: use16 ? [{ name: '16-bit PNG', extensions: ['png'] }] : undefined,
      });
      if (result.canceled || !result.filePath) return;

      if (use16) {
        const scaled = scaleHeight16(
          heightFloatToUint16(state.heightFloatData, data.width, data.height),
          data.width, data.height, parseFloat(dom.exportRes.value) || 1,
        );
        const png = encodePNG16Gray(scaled.data, scaled.width, scaled.height);
        await window.electronAPI.fs.writeFile(result.filePath, png);
      } else {
        const blob = await imageDataToBlob(data, format, quality);
        const buffer = await blob.arrayBuffer();
        await window.electronAPI.fs.writeFile(result.filePath, buffer);
      }
      showToast(`Saved ${fileName}`, 'success');
    } catch (err) {
      console.error('Save failed:', err);
      showToast('Could not save the map: ' + err.message, 'error');
    }
  }

  // ---- Modal dialogs (replaces unsupported window.prompt) -----
  function openModal({ title, description, input = false, value = '', placeholder = '', confirmText = 'Confirm', danger = false }) {
    return new Promise(resolve => {
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';

      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');

      const heading = document.createElement('h3');
      heading.className = 'modal-title';
      heading.textContent = title;
      modal.appendChild(heading);

      if (description) {
        const desc = document.createElement('p');
        desc.className = 'modal-desc';
        desc.textContent = description;
        modal.appendChild(desc);
      }

      let field = null;
      if (input) {
        field = document.createElement('input');
        field.className = 'modal-input';
        field.type = 'text';
        field.value = value;
        field.placeholder = placeholder;
        field.maxLength = 60;
        modal.appendChild(field);
      }

      const actions = document.createElement('div');
      actions.className = 'modal-actions';

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn btn-ghost';
      cancelBtn.textContent = 'Cancel';

      const confirmBtn = document.createElement('button');
      confirmBtn.className = 'btn ' + (danger ? 'btn-danger' : 'btn-primary');
      confirmBtn.textContent = confirmText;

      actions.append(cancelBtn, confirmBtn);
      modal.appendChild(actions);
      backdrop.appendChild(modal);
      document.body.appendChild(backdrop);

      let settled = false;
      const close = (result) => {
        if (settled) return;
        settled = true;
        document.removeEventListener('keydown', onKey);
        backdrop.remove();
        resolve(result);
      };
      const onKey = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); close(null); }
        else if (e.key === 'Enter' && (input || document.activeElement === confirmBtn)) {
          e.preventDefault();
          close(input ? field.value.trim() : true);
        }
      };

      cancelBtn.addEventListener('click', () => close(null));
      confirmBtn.addEventListener('click', () => close(input ? field.value.trim() : true));
      backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(null); });
      document.addEventListener('keydown', onKey);

      if (field) {
        field.focus();
        field.select();
      } else {
        confirmBtn.focus();
      }
    });
  }

  function showPrompt(opts) {
    return openModal({ ...opts, input: true });
  }

  function showConfirm(opts) {
    return openModal({ ...opts, input: false });
  }

  // ---- Presets System ----------------------------------------
  function loadPresets() {
    try { return JSON.parse(localStorage.getItem('nmg_presets')) || {}; } catch { return {}; }
  }
  function savePresets(presets) {
    try { localStorage.setItem('nmg_presets', JSON.stringify(presets)); } catch {}
  }

  function clampPresetValue(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.round(Math.min(max, Math.max(min, n)));
  }

  function sanitizeImportedPreset(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const keys = [
      'strength', 'blur', 'invert', 'aoIntensity', 'specularIntensity',
      'roughnessIntensity', 'metallicIntensity', 'curvatureIntensity',
      'brightness', 'contrast', 'gamma', 'seamless', 'seamlessWidth',
    ];
    if (!keys.some(key => Object.prototype.hasOwnProperty.call(raw, key))) return null;

    const truthy = value => value === true || value === 1 || value === 'true';
    return {
      strength: clampPresetValue(raw.strength, 1, 20, 5),
      blur: clampPresetValue(raw.blur, 0, 5, 1),
      invert: truthy(raw.invert),
      aoIntensity: clampPresetValue(raw.aoIntensity, 1, 20, 5),
      specularIntensity: clampPresetValue(raw.specularIntensity, 1, 20, 5),
      roughnessIntensity: clampPresetValue(raw.roughnessIntensity, 1, 20, 5),
      metallicIntensity: clampPresetValue(raw.metallicIntensity, 1, 20, 5),
      curvatureIntensity: clampPresetValue(raw.curvatureIntensity, 1, 20, 5),
      brightness: clampPresetValue(raw.brightness, -50, 50, 0),
      contrast: clampPresetValue(raw.contrast, -50, 50, 0),
      gamma: clampPresetValue(raw.gamma, -10, 20, 0),
      seamless: truthy(raw.seamless),
      seamlessWidth: clampPresetValue(raw.seamlessWidth, 2, 30, 10),
    };
  }

  function presetPayloadToMap(payload) {
    const source = payload && typeof payload === 'object' &&
      payload.presets && typeof payload.presets === 'object' && !Array.isArray(payload.presets)
      ? payload.presets
      : payload;
    if (!source || typeof source !== 'object' || Array.isArray(source)) return {};

    const result = {};
    for (const rawName of Object.keys(source)) {
      if (['__proto__', 'constructor', 'prototype'].includes(rawName)) continue;
      const name = rawName.trim().slice(0, 60);
      if (!name) continue;
      const preset = sanitizeImportedPreset(source[rawName]);
      if (preset) result[name] = preset;
    }
    return result;
  }

  async function exportPresets() {
    const presets = loadPresets();
    if (!Object.keys(presets).length) {
      showToast('There are no presets to export.', 'info');
      return;
    }

    const payload = JSON.stringify({
      app: 'Axis Texture Lab',
      type: 'presets',
      version: 1,
      presets,
    }, null, 2);
    const fileName = 'axis-texture-lab-presets.json';

    try {
      if (window.electronAPI?.dialog && window.electronAPI?.fs) {
        const result = await window.electronAPI.dialog.saveFile({
          defaultPath: fileName,
          filters: [
            { name: 'JSON', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] },
          ],
        });
        if (result.canceled || !result.filePath) return;
        const buffer = await new Blob([payload], { type: 'application/json' }).arrayBuffer();
        await window.electronAPI.fs.writeFile(result.filePath, buffer);
      } else {
        const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      showToast(`Exported ${Object.keys(presets).length} presets`, 'success');
    } catch (err) {
      console.error('Preset export failed:', err);
      showToast('Could not export presets: ' + err.message, 'error');
    }
  }

  async function importPresets(file) {
    if (!file) return;
    if (file.size > 1024 * 1024) {
      showToast('Preset file is too large (maximum 1 MB).', 'error');
      return;
    }

    try {
      const parsed = JSON.parse(await file.text());
      const imported = presetPayloadToMap(parsed);
      const names = Object.keys(imported);
      if (!names.length) {
        showToast('No valid presets were found in that file.', 'error');
        return;
      }

      const presets = loadPresets();
      const conflicts = names.filter(name => Object.prototype.hasOwnProperty.call(presets, name));
      if (conflicts.length) {
        const confirmed = await showConfirm({
          title: 'Replace existing presets?',
          description: `${conflicts.length} imported preset${conflicts.length === 1 ? '' : 's'} already exist${conflicts.length === 1 ? 's' : ''}: ${conflicts.slice(0, 5).join(', ')}${conflicts.length > 5 ? '…' : ''}. Replace them and import the rest?`,
          confirmText: 'Replace',
          danger: true,
        });
        if (!confirmed) return;
      }

      Object.assign(presets, imported);
      savePresets(presets);
      updatePresetSelect();
      dom.presetSelect.value = names[0];
      showToast(`Imported ${names.length} preset${names.length === 1 ? '' : 's'}`, 'success');
    } catch (err) {
      console.error('Preset import failed:', err);
      showToast('Could not import presets — make sure the file is valid JSON.', 'error');
    }
  }

  function updatePresetSelect() {
    const presets = loadPresets();
    dom.presetSelect.innerHTML = '<option value="">— Select Preset —</option>';
    for (const name of Object.keys(presets).sort()) {
      const opt = document.createElement('option');
      opt.value = name; opt.textContent = name;
      dom.presetSelect.appendChild(opt);
    }
  }

  async function saveCurrentPreset() {
    const entered = await showPrompt({
      title: 'Save preset',
      description: 'Store the current slider values as a reusable preset.',
      placeholder: 'Preset name',
      confirmText: 'Save',
    });
    const name = (entered || '').trim();
    if (!name) return;

    const presets = loadPresets();
    const p = gatherGenerationParams();
    presets[name] = {
      strength: Math.round(p.strength * 5),
      blur: p.blurRadius,
      invert: p.invert,
      aoIntensity: Math.round(p.aoIntensity * 5),
      specularIntensity: Math.round(p.specIntensity * 5),
      roughnessIntensity: Math.round(p.roughIntensity * 5),
      metallicIntensity: Math.round(p.metalIntensity * 5),
      curvatureIntensity: Math.round(p.curvIntensity * 5),
      brightness: p.brightness,
      contrast: p.contrast,
      gamma: p.gammaCorrection * 10,
      seamless: p.seamless,
      seamlessWidth: p.seamlessWidth,
    };
    savePresets(presets);
    updatePresetSelect();
    dom.presetSelect.value = name;
    showToast(`Preset "${name}" saved`, 'success');
  }

  function loadSelectedPreset() {
    const name = dom.presetSelect.value;
    if (!name) return;
    const presets = loadPresets();
    const p = presets[name];
    if (!p) { showToast('Preset not found', 'error'); return; }

    dom.strengthSlider.value = p.strength ?? 5; dom.strengthValue.textContent = p.strength ?? 5;
    dom.blurSlider.value = p.blur ?? 1; dom.blurValue.textContent = p.blur ?? 1;
    dom.invertCheck.checked = !!p.invert;
    dom.aoIntensitySlider.value = p.aoIntensity ?? 5; dom.aoIntensityValue.textContent = p.aoIntensity ?? 5;
    dom.specularIntensitySlider.value = p.specularIntensity ?? 5; dom.specularIntensityValue.textContent = p.specularIntensity ?? 5;
    dom.roughnessIntensitySlider.value = p.roughnessIntensity ?? 5; dom.roughnessIntensityValue.textContent = p.roughnessIntensity ?? 5;
    dom.metallicIntensitySlider.value = p.metallicIntensity ?? 5; dom.metallicIntensityValue.textContent = p.metallicIntensity ?? 5;
    dom.curvatureIntensitySlider.value = p.curvatureIntensity ?? 5; dom.curvatureIntensityValue.textContent = p.curvatureIntensity ?? 5;
    dom.brightnessSlider.value = p.brightness ?? 0; dom.brightnessValue.textContent = p.brightness ?? 0;
    dom.contrastSlider.value = p.contrast ?? 0; dom.contrastValue.textContent = p.contrast ?? 0;
    dom.gammaSlider.value = p.gamma ?? 0; dom.gammaValue.textContent = p.gamma ?? 0;
    dom.seamlessCheck.checked = !!p.seamless;
    dom.seamlessWidthSlider.value = p.seamlessWidth ?? 10; dom.seamlessWidthValue.textContent = p.seamlessWidth ?? 10;

    syncSliderFills();
    if (state.textureData) generateMaps();
    showToast(`Loaded preset "${name}"`, 'info');
  }

  async function deleteSelectedPreset() {
    const name = dom.presetSelect.value;
    if (!name) return;
    const confirmed = await showConfirm({
      title: 'Delete preset',
      description: `Delete the preset "${name}"? This cannot be undone.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!confirmed) return;

    const presets = loadPresets();
    delete presets[name];
    savePresets(presets);
    updatePresetSelect();
    showToast(`Preset "${name}" deleted`, 'info');
  }

  function initDefaultPresets() {
    let presets = loadPresets();
    if (Object.keys(presets).length > 0) {
      updatePresetSelect();
      return;
    }

    presets = {
      'PBR Standard': { strength: 5, blur: 1, invert: false, aoIntensity: 5, specularIntensity: 5, roughnessIntensity: 5, metallicIntensity: 5, curvatureIntensity: 5, brightness: 0, contrast: 0, gamma: 0, seamless: false, seamlessWidth: 10 },
      'Game Ready': { strength: 8, blur: 0, invert: false, aoIntensity: 7, specularIntensity: 6, roughnessIntensity: 7, metallicIntensity: 6, curvatureIntensity: 5, brightness: 5, contrast: 5, gamma: 0, seamless: true, seamlessWidth: 10 },
      'Cinematic': { strength: 12, blur: 2, invert: false, aoIntensity: 8, specularIntensity: 4, roughnessIntensity: 6, metallicIntensity: 4, curvatureIntensity: 7, brightness: -3, contrast: 10, gamma: 5, seamless: false, seamlessWidth: 10 },
      'Minimal': { strength: 3, blur: 3, invert: false, aoIntensity: 3, specularIntensity: 7, roughnessIntensity: 3, metallicIntensity: 3, curvatureIntensity: 3, brightness: 0, contrast: 0, gamma: 0, seamless: false, seamlessWidth: 10 },
      'Inverted Height': { strength: 5, blur: 1, invert: true, aoIntensity: 5, specularIntensity: 5, roughnessIntensity: 5, metallicIntensity: 5, curvatureIntensity: 5, brightness: 0, contrast: 0, gamma: 0, seamless: false, seamlessWidth: 10 },
    };
    savePresets(presets);
    updatePresetSelect();
  }

  // ---- Pixel Info (hover on canvases) -------------------------
  function setupPixelInfo() {
    const mapCanvases = {
      original: dom.canvasOriginal, normal: dom.canvasNormal,
      height: dom.canvasHeight, ao: dom.canvasAO,
      specular: dom.canvasSpecular, roughness: dom.canvasRoughness,
      metallic: dom.canvasMetallic, curvature: dom.canvasCurvature,
      slope: dom.canvasSlope,
    };
    const mapData = () => ({
      original: state.textureData, normal: state.normalMapData,
      height: state.heightMapData, ao: state.aoMapData,
      specular: state.specularMapData, roughness: state.roughnessMapData,
      metallic: state.metallicMapData, curvature: state.curvatureMapData,
      slope: state.slopeMapData,
    });

    for (const [name, canvas] of Object.entries(mapCanvases)) {
      if (!canvas) continue;
      canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / rect.width * canvas.width);
        const y = Math.floor((e.clientY - rect.top) / rect.height * canvas.height);
        const data = mapData()[name];
        if (!data || x < 0 || x >= data.width || y < 0 || y >= data.height) {
          dom.pixelInfo.textContent = '';
          return;
        }
        const idx = (y * data.width + x) * 4;
        const r = data.data[idx], g = data.data[idx + 1], b = data.data[idx + 2];
        dom.pixelInfo.innerHTML =
          `<span>${name}</span> <span class="pixel-rgb"><span style="color:#ef4444">R:${r}</span> <span style="color:#22c55e">G:${g}</span> <span style="color:#3b82f6">B:${b}</span></span> <span>(${x}, ${y})</span>`;
      });
      canvas.addEventListener('mouseleave', () => {
        dom.pixelInfo.textContent = '';
      });
    }
  }

  // ---- Context Menu ------------------------------------------
  const MAP_LABELS = {
    original: 'Original',
    normal: 'Normal Map',
    height: 'Height Map',
    ao: 'AO Map',
    specular: 'Specular Map',
    roughness: 'Roughness Map',
    metallic: 'Metallic Map',
    curvature: 'Curvature Map',
    slope: 'Slope Mask',
  };

  function setupContextMenu() {
    document.addEventListener('contextmenu', (e) => {
      const card = e.target.closest('.map-card');
      const mapType = card?.dataset.map;
      if (!card || !mapType || !MAP_LABELS[mapType] || !getMapData(mapType)) {
        dom.contextMenu.classList.remove('open');
        return;
      }
      e.preventDefault();

      const label = MAP_LABELS[mapType];
      dom.contextMenu.innerHTML = `
        <button class="ctx-item" data-action="save"><svg class="icon icon-14" aria-hidden="true" focusable="false"><use href="#solar-download"></use></svg> Save ${label}</button>
        <button class="ctx-item" data-action="copy"><svg class="icon icon-14" aria-hidden="true" focusable="false"><use href="#solar-copy"></use></svg> Copy to clipboard</button>
      `;

      dom.contextMenu.style.left = '0px';
      dom.contextMenu.style.top = '0px';
      dom.contextMenu.classList.add('open');

      // Keep the menu inside the window.
      const rect = dom.contextMenu.getBoundingClientRect();
      const left = Math.min(e.clientX, window.innerWidth - rect.width - 8);
      const top = Math.min(e.clientY, window.innerHeight - rect.height - 8);
      dom.contextMenu.style.left = Math.max(8, left) + 'px';
      dom.contextMenu.style.top = Math.max(8, top) + 'px';

      dom.contextMenu.querySelectorAll('.ctx-item').forEach(item => {
        item.addEventListener('click', () => {
          if (item.dataset.action === 'save') saveMapCard(mapType);
          else if (item.dataset.action === 'copy') copyMapToClipboard(mapType);
          dom.contextMenu.classList.remove('open');
        });
      });
    });

    document.addEventListener('click', () => dom.contextMenu.classList.remove('open'));
  }

  async function copyMapToClipboard(mapType) {
    const data = getMapData(mapType);
    if (!data) return;
    try {
      const blob = await imageDataToBlob(data, 'png', 1);
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      showToast(`${MAP_LABELS[mapType] || 'Map'} copied to clipboard`, 'success');
    } catch (err) {
      console.error('Clipboard error:', err);
      showToast('Could not copy to clipboard', 'error');
    }
  }

  // ---- Slider track fill --------------------------------------
  function updateSliderFill(slider) {
    if (!slider) return;
    const min = parseFloat(slider.min) || 0;
    const max = parseFloat(slider.max) || 100;
    const value = parseFloat(slider.value) || 0;
    const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
    slider.style.setProperty('--fill', `${Math.max(0, Math.min(100, pct))}%`);
  }

  function syncSliderFills() {
    $$('.slider, .lighting-slider').forEach(updateSliderFill);
  }

  // ---- Event Setup --------------------------------------------
  function setupEvents() {
    const openFilePicker = () => dom.fileInput.click();

    dom.dropZone.addEventListener('click', openFilePicker);
    dom.inputPreview.addEventListener('click', (e) => {
      if (!e.target.closest('#btnRemoveTexture')) openFilePicker();
    });
    dom.fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      e.target.value = ''; // allow selecting the same file again
      if (file) loadTexture(file);
    });

    dom.dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dom.dropZone.classList.add('drag-over');
    });
    dom.dropZone.addEventListener('dragleave', () => dom.dropZone.classList.remove('drag-over'));
    dom.dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dom.dropZone.classList.remove('drag-over');
      const file = [...(e.dataTransfer?.files || [])].find(isImageFile);
      if (file) loadTexture(file);
      else showToast('Drop a PNG, JPG, WEBP or BMP image.', 'error');
    });

    // Dropping outside the drop zone must not navigate the window to the file.
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.target.closest?.('#dropZone')) return;
      const files = [...(e.dataTransfer?.files || [])];
      const file = files.find(isImageFile);
      if (file) loadTexture(file);
      else if (files.length) showToast('Unsupported file type.', 'error');
    });

    dom.btnRemoveTexture.addEventListener('click', removeTexture);
    dom.btnGenerate.addEventListener('click', generateMaps);

    // Slider live updates
    function setupSlider(slider, display, settingKey) {
      const sync = () => {
        display.textContent = slider.value;
        updateSliderFill(slider);
      };
      slider.addEventListener('input', () => {
        sync();
        state.settings[settingKey] = parseInt(slider.value);
        saveSettings();
        if (state.textureData) debounceGenerate();
      });
      sync();
    }
    setupSlider(dom.strengthSlider, dom.strengthValue, 'strength');
    setupSlider(dom.blurSlider, dom.blurValue, 'blur');
    setupSlider(dom.aoIntensitySlider, dom.aoIntensityValue, 'aoIntensity');
    setupSlider(dom.specularIntensitySlider, dom.specularIntensityValue, 'specularIntensity');
    setupSlider(dom.roughnessIntensitySlider, dom.roughnessIntensityValue, 'roughnessIntensity');
    setupSlider(dom.metallicIntensitySlider, dom.metallicIntensityValue, 'metallicIntensity');
    setupSlider(dom.curvatureIntensitySlider, dom.curvatureIntensityValue, 'curvatureIntensity');
    setupSlider(dom.brightnessSlider, dom.brightnessValue, 'brightness');
    setupSlider(dom.contrastSlider, dom.contrastValue, 'contrast');
    setupSlider(dom.gammaSlider, dom.gammaValue, 'gamma');
    setupSlider(dom.seamlessWidthSlider, dom.seamlessWidthValue, 'seamlessWidth');

    dom.invertCheck.addEventListener('change', () => {
      state.settings.invertHeight = dom.invertCheck.checked; saveSettings();
      if (state.textureData) generateMaps();
    });
    dom.seamlessCheck.addEventListener('change', () => {
      state.settings.seamless = dom.seamlessCheck.checked; saveSettings();
      if (state.textureData) generateMaps();
    });

    dom.btnExport.addEventListener('click', exportMaps);
    dom.btnBatch?.addEventListener('click', () => dom.batchInput?.click());
    dom.batchInput?.addEventListener('change', async (e) => {
      const rawFiles = [...(e.target.files || [])];
      const files = rawFiles.filter(isImageFile);
      e.target.value = '';
      if (files.length) await runBatch(files);
      else if (rawFiles.length) showToast('Select PNG, JPG, WEBP or BMP images.', 'error');
    });

    // Save individual maps
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-save-map');
      if (btn) saveMapCard(btn.dataset.map);
    });

    // Tabs
    dom.tabBtns.forEach(btn => {
      btn.addEventListener('click', () => setActiveTab(btn.dataset.tab));
    });

    // Tiled preview controls
    dom.tilePreviewGroup?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tile]');
      if (btn) setTilePreview(btn.dataset.tile);
    });

    setupTerrainEvents();

    // Settings
    dom.btnSettings.addEventListener('click', () => {
      const body = dom.settingsOverlay.querySelector('.settings-body');
      if (body) body.scrollTop = 0;
      dom.settingsOverlay.classList.add('open');
    });
    dom.btnSettingsClose.addEventListener('click', () => dom.settingsOverlay.classList.remove('open'));
    dom.settingsOverlay.addEventListener('click', (e) => {
      if (e.target === dom.settingsOverlay) dom.settingsOverlay.classList.remove('open');
    });

    // Theme
    dom.themeOptions.forEach(el => {
      el.addEventListener('click', () => { state.settings.theme = el.dataset.theme; saveSettings(); applySettings(); });
    });
    dom.compactSidebar.addEventListener('change', () => {
      state.settings.compactSidebar = dom.compactSidebar.checked; saveSettings(); applySettings();
    });

    // Export settings save
    dom.exportFormat.addEventListener('change', () => { state.settings.exportFormat = dom.exportFormat.value; saveSettings(); });
    dom.normalFormat.addEventListener('change', () => {
      state.settings.normalFormat = dom.normalFormat.value === 'directx' ? 'directx' : 'opengl';
      saveSettings();
      if (state.textureData) generateMaps();
    });
    dom.exportRes.addEventListener('change', () => { state.settings.exportRes = dom.exportRes.value; saveSettings(); });
    dom.exportNaming.addEventListener('change', () => { state.settings.exportNaming = dom.exportNaming.value; saveSettings(); });
    dom.exportCustomName.addEventListener('input', () => { state.settings.exportCustomName = dom.exportCustomName.value; saveSettings(); });
    dom.jpegQuality.addEventListener('input', () => {
      dom.jpegQualityValue.textContent = dom.jpegQuality.value;
      state.settings.jpegQuality = parseInt(dom.jpegQuality.value); saveSettings();
    });
    ['includeOriginal','includeAo','includeSpecular','includeRoughness','includeMetallic','includeCurvature','includeSlope'].forEach(key => {
      dom[key]?.addEventListener('change', () => { state.settings[key] = dom[key].checked; saveSettings(); });
    });
    dom.channelPacking.addEventListener('change', () => {
      state.settings.channelPacking = dom.channelPacking.value; saveSettings();
    });
    ['exportHeight16', 'exportBundle', 'exportAtlas'].forEach(key => {
      dom[key]?.addEventListener('change', () => { state.settings[key] = dom[key].checked; saveSettings(); });
    });
    dom.atlasColumns.addEventListener('change', () => {
      state.settings.atlasColumns = parseInt(dom.atlasColumns.value, 10); saveSettings();
    });

    // 3D presets
    dom.materialPreset.addEventListener('change', () => {
      applyMaterialPreset(dom.materialPreset.value);
      saveSettings();
    });
    dom.lightingPreset.addEventListener('change', () => {
      applyLightingSettings();
      saveSettings();
    });

    // Per-map adjustments
    dom.adjustTarget.addEventListener('change', syncAdjustmentControls);
    [[dom.adjustBrightness, dom.adjustBrightnessValue],
     [dom.adjustContrast, dom.adjustContrastValue],
     [dom.adjustGamma, dom.adjustGammaValue]].forEach(([slider, display]) => {
      if (!slider) return;
      slider.addEventListener('input', () => {
        display.textContent = slider.value;
        updateSliderFill(slider);
      });
    });
    dom.btnApplyAdjust.addEventListener('click', applyMapAdjustments);
    dom.btnResetAdjust.addEventListener('click', resetMapAdjustments);

    // Viewport
    dom.viewportBg.addEventListener('change', () => {
      state.settings.viewportBg = dom.viewportBg.value; saveSettings();
      if (window.preview3d) window.preview3d.updateViewportBg();
    });
    dom.showGrid.addEventListener('change', () => {
      state.settings.showGrid = dom.showGrid.checked; saveSettings();
      if (window.preview3d) window.preview3d.toggleGrid(dom.showGrid.checked);
    });

    // 3D objects
    const objBtns = {
      sphere: dom.btnObjectSphere, cube: dom.btnObjectCube,
      torus: dom.btnObjectTorus, cylinder: dom.btnObjectCylinder, plane: dom.btnObjectPlane,
    };
    for (const [type, btn] of Object.entries(objBtns)) {
      if (!btn) continue;
      btn.addEventListener('click', () => {
        Object.values(objBtns).forEach(b => b?.classList.remove('active'));
        btn.classList.add('active');
        if (window.preview3d) window.preview3d.setObject(type);
      });
    }

    dom.mapViewGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-toolbar');
      if (!btn) return;
      dom.mapViewGroup.querySelectorAll('.btn-toolbar').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (window.preview3d) window.preview3d.setMapView(btn.dataset.mapview);
    });

    dom.btnResetCamera.addEventListener('click', () => { if (window.preview3d) window.preview3d.resetCamera(); });
    dom.btnAutoRotate.addEventListener('click', () => {
      dom.btnAutoRotate.classList.toggle('active');
      if (window.preview3d) window.preview3d.toggleAutoRotate();
    });
    dom.btnScreenshot?.addEventListener('click', async () => {
      if (!window.preview3d) return;
      const dataUrl = window.preview3d.takeScreenshot();
      if (!dataUrl) {
        showToast('Screenshot failed — the 3D view is not ready.', 'error');
        return;
      }

      try {
        if (window.electronAPI?.dialog && window.electronAPI?.fs) {
          const result = await window.electronAPI.dialog.saveFile({
            defaultPath: '3d_preview.png',
          });
          if (result.canceled || !result.filePath) return;
          const buffer = await dataUrlToBlob(dataUrl).arrayBuffer();
          await window.electronAPI.fs.writeFile(result.filePath, buffer);
        } else {
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = '3d_preview.png';
          a.click();
        }
        showToast('3D screenshot saved', 'success');
      } catch (err) {
        console.error('Screenshot save failed:', err);
        showToast('Could not save the screenshot.', 'error');
      }
    });
    dom.btnWireframe?.addEventListener('click', () => {
      dom.btnWireframe.classList.toggle('active');
      if (window.preview3d) window.preview3d.toggleWireframe(dom.btnWireframe.classList.contains('active'));
    });

    // Lighting controls
    const lightSliders = [
      dom.lightKeyX, dom.lightKeyY, dom.lightKeyZ, dom.lightKeyIntensity,
      dom.lightFillX, dom.lightFillY, dom.lightFillZ, dom.lightFillIntensity,
      dom.lightAmbient, dom.lightRimIntensity,
    ];
    lightSliders.forEach(slider => {
      if (!slider) return;
      slider.addEventListener('input', () => {
        updateLightValueDisplay();
        updateSliderFill(slider);
        // Manual changes switch the preset selector to Custom.
        state.settings.lightingPreset = 'custom';
        if (dom.lightingPreset) dom.lightingPreset.value = 'custom';
        applyLightingFromControls();
      });
      updateSliderFill(slider);
    });
    // Lighting popover toggle
    dom.btnLighting?.addEventListener('click', (e) => {
      e.stopPropagation();
      dom.lightingPopover.classList.toggle('open');
    });
    // Close popover when clicking outside
    document.addEventListener('click', (e) => {
      if (dom.lightingPopover?.classList.contains('open') &&
          !dom.lightingPopover.contains(e.target) &&
          e.target !== dom.btnLighting &&
          !dom.btnLighting?.contains(e.target)) {
        dom.lightingPopover.classList.remove('open');
      }
    });
    // Reset to the Studio preset
    dom.btnLightReset?.addEventListener('click', () => {
      dom.lightingPreset.value = 'studio';
      applyLightingSettings();
      saveSettings();
    });
    // Initialise value displays and apply the persisted preset.
    updateLightValueDisplay();
    applyLightingSettings();

    // Presets
    dom.btnSavePreset?.addEventListener('click', saveCurrentPreset);
    dom.btnLoadPreset?.addEventListener('click', loadSelectedPreset);
    dom.btnDeletePreset?.addEventListener('click', deleteSelectedPreset);
    dom.btnImportPreset?.addEventListener('click', () => dom.presetImportInput?.click());
    dom.presetImportInput?.addEventListener('change', async () => {
      const file = dom.presetImportInput.files?.[0];
      dom.presetImportInput.value = '';
      if (file) await importPresets(file);
    });
    dom.btnExportPreset?.addEventListener('click', exportPresets);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      const mod = e.metaKey || e.ctrlKey;

      if (e.key === 'Escape') {
        dom.settingsOverlay.classList.remove('open');
        dom.lightingPopover.classList.remove('open');
        dom.contextMenu.classList.remove('open');
      }
      if (mod && key === 'g' && state.textureData) { e.preventDefault(); generateMaps(); }
      if (mod && e.shiftKey && key === 's' && state.normalMapData) { e.preventDefault(); exportMaps(); }
      if (mod && key === 'o') { e.preventDefault(); dom.fileInput.click(); }
    });
  }

  // ---- Randomizer events --------------------------------------
  let terrainTimer = null;
  function debounceTerrainGenerate(delay = 420) {
    if (terrainTimer) clearTimeout(terrainTimer);
    terrainTimer = setTimeout(() => generateTerrain(), delay);
  }

  function setupTerrainEvents() {
    const sliders = [
      dom.terrainOctaves, dom.terrainFrequency, dom.terrainPersistence,
      dom.terrainLacunarity, dom.terrainSmoothing,
    ];
    sliders.forEach(slider => {
      slider.addEventListener('input', () => {
        updateTerrainReadouts();
        persistTerrainControls();
        debounceTerrainGenerate();
      });
    });

    dom.terrainStyle.addEventListener('change', () => {
      persistTerrainControls();
      generateTerrain({ announce: true });
    });
    dom.terrainResolution.addEventListener('change', () => {
      updateTerrainReadouts();
      persistTerrainControls();
      generateTerrain({ announce: true });
    });
    dom.terrainSeed.addEventListener('change', persistTerrainControls);
    dom.terrainSeed.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        generateTerrain({ announce: true });
      }
    });

    dom.btnTerrainRandomSeed.addEventListener('click', () => {
      dom.terrainSeed.value = randomTerrainSeed();
      persistTerrainControls();
      generateTerrain({ announce: true });
    });
    dom.btnTerrainGenerate.addEventListener('click', () => generateTerrain({ announce: true }));
    dom.btnTerrainUse.addEventListener('click', useTerrainAsHeightMap);
    dom.btnTerrainExport.addEventListener('click', exportTerrainHeightMap);

    dom.terrainViewButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        setTerrainViewState(btn.dataset.terrainView);
      });
    });
  }

  // ---- Debounce Generate --------------------------------------
  let generateTimer = null;
  function debounceGenerate() {
    if (generateTimer) clearTimeout(generateTimer);
    generateTimer = setTimeout(() => generateMaps(), 300);
  }

  // ---- Init ---------------------------------------------------
  function init() {
    cacheDom();
    applySettings();
    applyTerrainSettings();
    setActiveTab('maps');
    initDefaultPresets();
    setupEvents();
    setupPixelInfo();
    setupContextMenu();

    // preview3d initialises on the same DOMContentLoaded tick; re-apply the
    // persisted 3D presets once its lights and material exist.
    setTimeout(() => {
      applyMaterialPreset(dom.materialPreset.value);
      applyLightingSettings();
    }, 0);

    if (typeof THREE === 'undefined') {
      dom.tabBtns.forEach(btn => {
        if (btn.dataset.tab === '3d' || btn.dataset.tab === 'randomizer') {
          btn.style.display = 'none';
        }
      });
    }

    if (window.electronAPI && window.electronAPI.app) {
      window.electronAPI.app.getVersion().then(v => {
        if (dom.appVersion) dom.appVersion.textContent = v;
      }).catch(() => {});
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
