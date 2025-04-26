import {
  AmbientLight,
  Clock,
  Color,
  GridHelper,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  TextureLoader,
  LinearFilter,
  RepeatWrapping, NearestFilter, MeshBasicMaterial,
  NoToneMapping, SRGBColorSpace
} from 'three';
import { GLTFLoader } from 'three/addons';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { ControlMode, PointerBehaviour, SpatialControls } from 'spatial-controls';
import { Pane } from 'tweakpane';
import noiseTextureUrl from '../assets/noise.png?url';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import {
  EffectComposer,
  EffectPass,
  RenderPass,
  SMAAEffect,
  SMAAPreset,
} from 'postprocessing';
import { makeUniformsProxy } from './clouds/uniforms-proxy';
import { Wind } from './clouds/wind';
import { DirectCloudsEffect } from './clouds/direct-clouds-effect';
import { UndersampledCloudsPass } from './clouds/undersampled-clouds-effect';
import { createNoiseTexture3D } from './clouds/noise-texture-3d';

const noiseTexture = new TextureLoader().load(noiseTextureUrl, tx => {
  tx.magFilter = LinearFilter;
  tx.minFilter = LinearFilter;
  tx.wrapS = RepeatWrapping;
  tx.wrapT = RepeatWrapping;
});

const noiseTexture3d = createNoiseTexture3D({ size: 128 });

class CloudsDemo {
  constructor(container) {
    this.container = container;

    this.undersampling = 0;

    this.geometryMultisampling = 8;

    this.clock = new Clock(true);

    this.init3D();

    this.initLevel();

    this.pane = new Pane();
    this.initPane();

    this.update();
  }

  init3D() {
    // 3D setup
    this.renderer = new WebGLRenderer({
      powerPreference: 'high-performance',
      antialias: false,
      stencil: false,
      depth: false,
      alpha: false,
      logarithmicDepthBuffer: true,
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    this.stats = new Stats();
    this.container.appendChild(this.stats.dom);
    this.showStats = true;
    this.skipPostProcessing = false;

    this.scene = new Scene();
    this.scene.background = new Color(0xa4cbf4);
    // this.scene.fog = new Fog(0xb5d9f8, 150, 310);

    this.renderer.toneMapping = NoToneMapping; // так и должно быть, в случае тон маппинга, нужно задавать его через ToneMappingEffect
    this.renderer.toneMappingExposure = 1;

    this.camera = new PerspectiveCamera(75, 1, 0.1, 100000);

    console.log(this.camera)

    this.controls = new SpatialControls(this.camera.position, this.camera.quaternion, this.renderer.domElement);
    this.controls.settings.general.mode = ControlMode.FIRST_PERSON;
    this.controls.settings.pointer.behaviour = PointerBehaviour.LOCK;
    this.controls.settings.translation.sensitivity = 100;
    this.controls.settings.translation.boostMultiplier = 10;
    this.controls.settings.rotation.sensitivity = 2.5;

    this.cloudsEffect = new DirectCloudsEffect({
      camera: this.camera,
      clock: this.clock,
      noiseTexture,
      noiseTexture3d,
    });

    this.composer = new EffectComposer(this.renderer, {
      // frameBufferType: HalfFloatType
    });
    // this.composer.autoRenderToScreen = false;
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this._directCloudsPass = new EffectPass(this.camera, this.cloudsEffect);
    this._undersampledCloudsPass = new UndersampledCloudsPass({
      camera: this.camera,
      clock: this.clock,
      noiseTexture,
      noiseTexture3d,
      undersampling: 16,
      renderer: this.renderer,
    });
    this.composer.addPass(this._directCloudsPass);
    this.composer.addPass(this._undersampledCloudsPass);
    this.updateUndersampling();

    this.smaaPreset = SMAAPreset.MEDIUM;
    this.smaaEffect = new SMAAEffect({ preset: this.smaaPreset });
    this.smaaPass = new EffectPass(this.camera, this.smaaEffect);
    this.composer.addPass(this.smaaPass);

    this.composer.addPass(new EffectPass(this.camera));

    this.uniformProxy = makeUniformsProxy([this.cloudsEffect.uniforms, this._undersampledCloudsPass.cloudsUniforms]);
    this.wind = new Wind(this.uniformProxy, this.clock);
    this.camera.position.set(
      -92.8154178824343,
      137.35523649956534,
      -169.17262210874802
    );
    this.camera.rotation.set(
      -2.8093107276299527,
      -0.5170788715507756,
      -2.9726328526083474
    );

    if (location.search.includes('upisfree')) {
      this.camera.position.set(
        80,
        9,
        -135
      );
      this.camera.rotation.set(
        -2.8565540938041662,
        0.4430787851422483,
        3.01662397220497
      );
    }

    this.resize();
    window.addEventListener('resize', this.resize.bind(this));
    window.addEventListener('resize', () => this.initPost());

    this.gridHelper = new GridHelper(10000, 150);
    this.scene.add(this.gridHelper);
    this.gridHelper.visible = false;

    this.initLights();
  }

  updateUndersampling() {
    const us = Math.round(this.undersampling);

    if (us > 0) {
      this._undersampledCloudsPass.enabled = true;
      this._directCloudsPass.enabled = false;
      this._undersampledCloudsPass.undersampling = us;
    } else {
      this._undersampledCloudsPass.enabled = false;
      this._directCloudsPass.enabled = true;
    }
  }

  initPane() {
    const cloudsFolder = this.pane.addFolder({ title: "Clouds", expanded: false });

    const cloudsShapeFolder = cloudsFolder.addFolder({ title: "Shape", expanded: false });
    cloudsShapeFolder.addBinding(this.uniformProxy, "cloudsScale", {
      label: "Scale",
      min: 1.0,
      max: 200.0,
      // step: 0.5,
    });
    cloudsShapeFolder.addBinding(this.uniformProxy, "cloudsAltitude", {
      label: "Altitude",
      min: -1000,
      max: 1000,
    });
    cloudsShapeFolder.addBinding(this.uniformProxy, "cloudsAltitudeShift", {
      label: "Alt. shift",
      min: -500,
      max: 500,
    });
    cloudsShapeFolder.addBinding(this.uniformProxy, "cloudsFloorAltitude", {
      label: "Alt. floor",
      min: 0,
      max: 500,
    });
    cloudsShapeFolder.addBinding(this.uniformProxy, "cloudsCeilAltitude", {
      label: "Alt. ceiling",
      min: 0,
      max: 1000,
    });
    cloudsShapeFolder.addBinding(this.uniformProxy, "cloudsCeilSmoothingRange", {
      label: "Ceil smooth",
      min: 0,
      max: 500,
    });
    cloudsShapeFolder.addBinding(this.uniformProxy, "cloudsFloorSmoothingRange", {
      label: "Floor smooth",
      min: 0,
      max: 500,
    });
    cloudsShapeFolder.addBinding(this.uniformProxy, "cloudsTransitionalLayerScale", {
      label: "Tr. layer",
      min: 0.1,
      max: 2.5,
    });

    const cloudsColorFolder = cloudsFolder.addFolder({ title: "Coloring" });
    cloudsColorFolder.addBinding(this.uniformProxy, "densityThreshold", {
      label: "Density thres.",
      min: 0.0,
      max: 10.0,
    });
    cloudsColorFolder.addBinding(this.uniformProxy, "transparencyThreshold", {
      label: "α thres.",
      min: 0.00001,
      max: 0.5,
    });
    cloudsColorFolder.addBinding(this.uniformProxy, "colorLowDensity", {
      label: "Low density color",
      color: { type: 'float' },
    });
    cloudsColorFolder.addBinding(this.uniformProxy, "colorHighDensity", {
      label: "High density color",
      color: { type: 'float' },
    });
    cloudsColorFolder.addBinding(this.uniformProxy, "densityColorGradientLength", {
      label: "Color gradient depth",
      min: 0.5,
      max: 150.0,
    });
    cloudsColorFolder.addBinding(this.uniformProxy, "alpha1", {
      label: "α 1",
      min: 0.9,
      max: 0.999,
    });
    cloudsColorFolder.addBinding(this.uniformProxy, "alpha2", {
      label: "α 2",
      min: 0.9,
      max: 0.999,
    });
    cloudsColorFolder.addBinding(this.uniformProxy, "densityAlphaGradientLength", {
      label: "α gradient depth",
      min: 0.5,
      max: 150.0,
    });

    const cloudsSunFolder = cloudsColorFolder.addFolder({ title: "Sun" });
    cloudsSunFolder.addBinding(this.uniformProxy, "colorSun", {
      label: "Sun color",
      color: { type: 'float' },
    });
    cloudsSunFolder.addBinding(this.uniformProxy, "sunDirection", {
      label: "Sun direction",
    }).on("change", () => {
      this.cloudsEffect.uniforms.get('sunDirection').value.normalize();
      setTimeout(() => cloudsColorFolder.refresh(), 0);
    });
    cloudsSunFolder.addBinding(this.uniformProxy, "sunCastDistance", {
      label: "Sun cast distance",
      min: 10,
      max: 100,
    });

    const cloudsQualityFolder = cloudsFolder.addFolder({ title: "Quality" });
    cloudsQualityFolder.addBinding(this.uniformProxy, "maxRMDistance", {
      label: "Max distance",
      min: 10000.0,
      max: this.camera.far,
    });
    cloudsQualityFolder.addBinding(this.uniformProxy, "minRMStep", {
      label: "Min step",
      min: 0.04,
      max: 20.0,
    });
    cloudsQualityFolder.addBinding(this.uniformProxy, "rmStepScale", {
      label: "Step size",
      min: 0.2,
      max: 4.0,
    });
    cloudsQualityFolder.addBinding(this.uniformProxy, "ditherDepth", {
      label: "Dithering depth",
      min: 0.0,
      max: 1.0,
    });
    cloudsQualityFolder.addBinding(this, "undersampling", {
      label: "Undersampling",
      min: 0,
      max: 16,
      step: 1,
    }).on("change", () => this.updateUndersampling());
    cloudsQualityFolder.addBinding(this, "smaaPreset", {
      label: "SMAA preset",
      options: { NONE: "NONE", ...SMAAPreset },
    }).on("change", () => {
      if (this.smaaPreset === "NONE") {
        this.smaaPass.setEnabled(false);
      } else {
        this.smaaPass.setEnabled(true);
        this.smaaEffect.applyPreset(this.smaaPreset);
      }
    });

    const cloudsDetailsFolder = cloudsFolder.addFolder({ title: "Details" });
    cloudsDetailsFolder.addBinding(this.uniformProxy, "detailsScale", {
      label: "Scale",
      min: 10.0,
      max: 70.0,
    });
    cloudsDetailsFolder.addBinding(this.uniformProxy, "detailsIntensity", {
      label: "Intensity",
      min: 1.0,
      max: 10.0,
    });
    cloudsDetailsFolder.addBinding(this.wind, "detailsWindSpeed", {
      label: "Wind speed",
      min: 100,
      max: 5000,
    });
    cloudsDetailsFolder.addBinding(this.wind, "detailsWindChangeSpeed", {
      label: "Wind change speed",
      min: 0.05,
      max: 1.0,
    });

    const fogFolder = this.pane.addFolder({ title: "Fog", expanded: false });

    fogFolder.addBinding(this.uniformProxy, "fogEnabled", {
      label: "Enabled",
    });
    fogFolder.addBinding(this.uniformProxy, "fogColor", {
      label: "Color",
      color: { type: "float" },
    });
    fogFolder.addBinding(this.uniformProxy, "fogTransparency", {
      label: "Transparency",
      min: 0.99,
      max: 0.9999,
    });

    const helpersFolder = this.pane.addFolder({ title: "Helpers", expanded: false });
    helpersFolder.addBinding(this.gridHelper, "visible", { label: "Show grid" });
    helpersFolder.addBinding(this, "showStats", { label: "Show stats" }).on("change", e => e.value ? this.container.appendChild(this.stats.dom) : this.stats.dom.remove());
    helpersFolder.addBinding(this.scene, "background", {
      label: "Background",
      color: { type: 'float' },
    });
    helpersFolder.addBinding(this, "skipPostProcessing", { label: "Skip Post" });
  }

  initLights() {
    this.ambientLight = new AmbientLight(0xffffff, 2);
    this.scene.add(this.ambientLight);

    // this.directionalLight = new DirectionalLight(0xffffff, 1);
    // this.directionalLight.position.set(10, 0, 0);
    // this.scene.add(this.directionalLight);
  }

  async initLevel() {
    const gltfLoader = new GLTFLoader();

    const ktx2Loader = new KTX2Loader();
    ktx2Loader.setTranscoderPath('./lib/basis/');
    ktx2Loader.detectSupport(this.renderer);

    gltfLoader.setKTX2Loader(ktx2Loader);
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);

    const model = await gltfLoader.loadAsync('./assets/level.glb');
    const level = model.scene;

    level.getObjectByName('PHYSICS_GEOMETRY').visible = false;
    level.getObjectByName('PLAYER_SPAWN_POINT').visible = false;

    level.traverse(obj => {
      if (obj.isMesh && obj.material) {
        if (obj.material.map) {
          obj.material.map.magFilter = NearestFilter;
          obj.material.map.minFilter = NearestFilter;
          obj.material.map.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        }


        this.convertMaterialStandardToBasic(obj);
      }
    });

    this.scene.add(level);
  }

  convertMaterialStandardToBasic(mesh) {
    let prevMaterial = mesh.material;
    mesh.material = new MeshBasicMaterial();
    MeshBasicMaterial.prototype.copy.call(mesh.material, prevMaterial);

    // This kinda fixes transparency problem
    mesh.material.alphaHash = true;
    mesh.material.depthWrite = true;
  }

  update(timestamp) {
    requestAnimationFrame(this.update.bind(this));

    this.controls.update(timestamp);
    this.wind.update();

    this.render();
    this.stats.update();
  }

  render() {
    this.composer.render();
  }

  resize() {
    this.containerBounds = this.container.getBoundingClientRect();

    this.camera.aspect = this.containerBounds.width / this.containerBounds.height;
    this.camera.updateProjectionMatrix();

    let pixelRatio = window.devicePixelRatio;

    // composer.setSize() учитывает pixel ratio WebGLRenderer
    this.renderer.setPixelRatio(pixelRatio);

    this.composer.setSize(this.containerBounds.width, this.containerBounds.height);
  }
}

export default CloudsDemo;
