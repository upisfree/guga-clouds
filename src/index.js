import {
  Matrix3,
  Matrix4,
  MeshPhongMaterial,
  OrthographicCamera,
  ShaderMaterial,
  Vector3,
  DepthTexture,
  WebGLRenderTarget,
  AmbientLight,
  BoxGeometry,
  CircleGeometry,
  Clock,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  GridHelper,
  IcosahedronGeometry,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  NeutralToneMapping,
  OctahedronGeometry,
  PerspectiveCamera,
  PlaneGeometry,
  RingGeometry,
  Scene,
  SphereGeometry,
  TetrahedronGeometry,
  TorusGeometry,
  TorusKnotGeometry,
  Vector2,
  WebGLRenderer,
  TextureLoader,
  LinearFilter,
  RepeatWrapping, NearestFilter, MeshBasicMaterial
} from 'three';
import { GLTFLoader } from 'three/addons';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { ControlMode, PointerBehaviour, SpatialControls } from 'spatial-controls';
import { Pane } from 'tweakpane';
import CloudsUpisfree from './clouds-upisfree';
import CloudsShadertoy from './clouds-shadertoy';
import abPostVS from './ab-post.vertex.glsl?raw';
import abPostFS from './ab-post.frag.glsl?raw';
import abMergeFS from './ab-merge.frag.glsl?raw';
import noiseTextureUrl from '../assets/noise.png?url';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { cameraFar, cameraNear } from 'three/tsl';

const noiseTexture = new TextureLoader().load(noiseTextureUrl, tx => {
  tx.magFilter = LinearFilter;
  tx.minFilter = LinearFilter;
  tx.wrapS = RepeatWrapping;
  tx.wrapT = RepeatWrapping;
});

class CloudsDemo {
  constructor(container) {
    this.container = container;

    this.undersampling = 2;
    this.detailsWindSpeed = 200.0;
    this.detailsWindChangeSpeed = 0.05;

    this.init3D();
    this.initPost()
    // this.initObjects();
    this.initLevel();

    this.pane = new Pane();
    this.initPane();

    // this.cloudsUpisfree = new CloudsUpisfree(this.camera, this.pane);

    // if (location.search.includes('upisfree')) {
    //   this.scene.add(this.cloudsUpisfree);
    // }

    // this.cloudsShadertoy = new CloudsShadertoy(this.camera, this.pane);

    // if (location.search.includes('shadertoy')) {
    //   this.scene.add(this.cloudsShadertoy);
    // }

    this.clock = new Clock(true);

    this.update();
  }

  init3D() {
    // 3D setup
    this.renderer = new WebGLRenderer({
      powerPreference: 'high-performance',
      antialias: true,
      alpha: false,
      logarithmicDepthBuffer: true,
    });
    this.container.appendChild(this.renderer.domElement);

    this.stats = new Stats();
    this.container.appendChild(this.stats.dom);
    this.showStats = true;

    this.scene = new Scene();
    this.scene.background = new Color(0xa4cbf4);
    // this.scene.fog = new Fog(0xb5d9f8, 150, 310);

    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.5;

    this.clock = new Clock();

    this.camera = new PerspectiveCamera(60, 1, 0.1, 100000);

    this.controls = new SpatialControls(this.camera.position, this.camera.quaternion, this.renderer.domElement);
    this.controls.settings.general.mode = ControlMode.FIRST_PERSON;
    this.controls.settings.pointer.behaviour = PointerBehaviour.LOCK;
    this.controls.settings.translation.sensitivity = 100;
    this.controls.settings.translation.boostMultiplier = 10;
    this.controls.settings.rotation.sensitivity = 2.5;

    // this.camera.position.set(343, 371, -536);
    // this.camera.rotation.set(
    //   -2.49,
    //   0.42,
    //   2.83,
    // );
    this.camera.position.set(0, 50, 100);
    this.camera.rotation.set(
      0,0,0
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

  initPane() {
    const cloudsFolder = this.pane.addFolder({title: "Clouds"});

    const cloudsShapeFolder = cloudsFolder.addFolder({title: "Shape", expanded: false});
    cloudsShapeFolder.addBinding(this.postMaterial.uniforms.cloudsScale, "value", {
      label: "Scale",
      min: 1.0,
      max: 200.0,
      // step: 0.5,
    });
    cloudsShapeFolder.addBinding(this.postMaterial.uniforms.cloudsAltitude, "value", {
      label: "Altitude",
      min: -1000,
      max: 1000,
    });
    cloudsShapeFolder.addBinding(this.postMaterial.uniforms.cloudsTransitionalLayerScale, "value", {
      label: "Tr. layer",
      min: 0.1,
      max: 2.5,
    });

    const cloudsColorFolder = cloudsFolder.addFolder({ title: "Coloring" });
    cloudsColorFolder.addBinding(this.postMaterial.uniforms.densityThreshold, "value", {
      label: "Density thres.",
      min: 0.0,
      max: 10.0,
    });
    cloudsColorFolder.addBinding(this.postMaterial.uniforms.transparencyThreshold, "value", {
      label: "α thres.",
      min: 0.00001,
      max: 0.5,
    });
    cloudsColorFolder.addBinding(this.postMaterial.uniforms.color1, "value", {
      label: "Color 1",
      color: { type: 'float' },
    });
    cloudsColorFolder.addBinding(this.postMaterial.uniforms.color2, "value", {
      label: "Color 2",
      color: { type: 'float' },
    });
    cloudsColorFolder.addBinding(this.postMaterial.uniforms.densityColorGradientLength, "value", {
      label: "Color gradient depth",
      min: 0.5,
      max: 150.0,
    });
    cloudsColorFolder.addBinding(this.postMaterial.uniforms.alpha1, "value", {
      label: "α 1",
      min: 0.9,
      max: 0.999,
    });
    cloudsColorFolder.addBinding(this.postMaterial.uniforms.alpha2, "value", {
      label: "α 2",
      min: 0.9,
      max: 0.999,
    });
    cloudsColorFolder.addBinding(this.postMaterial.uniforms.densityAlphaGradientLength, "value", {
      label: "α gradient depth",
      min: 0.5,
      max: 150.0,
    });
    // cloudsColorFolder.addBinding(this.postMaterial.uniforms.color4, "value", {
    //   label: "Color 4",
    //   color: { type: 'float' },
    // });

    const cloudsSunFolder = cloudsColorFolder.addFolder({ title: "Sun" });
    cloudsSunFolder.addBinding(this.postMaterial.uniforms.color3, "value", {
      label: "Color 3",
      color: { type: 'float' },
    });
    cloudsSunFolder.addBinding(this.postMaterial.uniforms.sunDirection, "value", {
      label: "Sun direction",
    }).on("change", () => {
      this.postMaterial.uniforms.sunDirection.value.normalize();
      setTimeout(() => cloudsColorFolder.refresh(), 0);
    });
    cloudsSunFolder.addBinding(this.postMaterial.uniforms.sunCastDistance, "value", {
      label: "Sun cast distance",
      min: 10,
      max: 100,
    });

    const cloudsQualityFolder = cloudsFolder.addFolder({ title: "Quality" });
    cloudsQualityFolder.addBinding(this.postMaterial.uniforms.maxRMDistance, "value", {
      label: "Max distance",
      min: 10000.0,
      max: this.camera.far,
    });
    cloudsQualityFolder.addBinding(this.postMaterial.uniforms.minRMStep, "value", {
      label: "Min step",
      min: 0.04,
      max: 20.0,
    });
    cloudsQualityFolder.addBinding(this.postMaterial.uniforms.rmStepScale, "value", {
      label: "Step size",
      min: 0.2,
      max: 4.0,
    });
    cloudsQualityFolder.addBinding(this.postMaterial.uniforms.ditherDepth, "value", {
      label: "Dithering depth",
      min: 0.0,
      max: 1.0,
    });
    cloudsQualityFolder.addBinding(this, "undersampling", {
      label: "Undersampling",
      min: 0,
      max: 4,
      step: 1,
    }).on("change", () => this.initPost());


    const cloudsDetailsFolder = cloudsFolder.addFolder({ title: "Details" });
    cloudsDetailsFolder.addBinding(this.postMaterial.uniforms.detailsScale, "value", {
      label: "Scale",
      min: 10.0,
      max: 70.0,
    });
    cloudsDetailsFolder.addBinding(this.postMaterial.uniforms.detailsIntensity, "value", {
      label: "Intensity",
      min: 1.0,
      max: 10.0,
    });
    cloudsDetailsFolder.addBinding(this, "detailsWindSpeed", {
      label: "Wind speed",
      min: 100,
      max: 5000,
    });
    cloudsDetailsFolder.addBinding(this, "detailsWindChangeSpeed", {
      label: "Wind change speed",
      min: 0.05,
      max: 1.0,
    });

    const fogFolder = this.pane.addFolder({ title: "Fog", expanded: false });

    fogFolder.addBinding(this.postMaterial.uniforms.fogEnabled, "value", {
      label: "Enabled",
    });
    fogFolder.addBinding(this.postMaterial.uniforms.fogColor, "value", {
      label: "Color",
      color: { type: "float" },
    });
    fogFolder.addBinding(this.postMaterial.uniforms.fogTransparency, "value", {
      label: "Transparency",
      min: 0.99,
      max: 0.9999,
    });

    const helpersFolder = this.pane.addFolder({ title: "Helpers", expanded: false });
    helpersFolder.addBinding(this.gridHelper, "visible", { label: "Show grid" });
    helpersFolder.addBinding(this, "showStats", { label: "Show stats"}).on("change", e => e.value ? this.container.appendChild(this.stats.dom) : this.stats.dom.remove());
    helpersFolder.addBinding(this.scene, "background", {
      label: "Background",
      color: { type: 'float' },
    });
  }

  initPost() {
    const [resolutionX, resolutionY] = [this.renderer.getPixelRatio() * window.innerWidth, this.renderer.getPixelRatio() * window.innerHeight];
    this.rt = new WebGLRenderTarget(resolutionX, resolutionY);
    this.rt.depthTexture = new DepthTexture(resolutionX, resolutionY);

    let [cloudsResolutionX, cloudsResolutionY] = [resolutionX, resolutionY];

    let cloudsShaderPrefix = `
    #define DEPTH_COORD_MULTIPLIER 1
    #define MERGE_COLOR
    `;

    if (this.undersampling > 0) {
      this.undersampling = Math.ceil(this.undersampling);

      const scale = 2 ** this.undersampling;
      [cloudsResolutionX, cloudsResolutionY] = [Math.ceil(resolutionX / scale), Math.ceil(resolutionY / scale)];
      this.cloudsRt = new WebGLRenderTarget(cloudsResolutionX, cloudsResolutionY);

      cloudsShaderPrefix = `
      #define DEPTH_COORD_MULTIPLIER ${scale}
      `;

      this.metaMaterial = new ShaderMaterial({
        vertexShader: abPostVS,
        fragmentShader: abMergeFS,
        uniforms: {
          sceneTexture: { value: null },
          cloudsTexture: { value: null },
          viewportSizeInverse: { value: new Vector2(1/resolutionX, 1/resolutionY) },
        }
      });

      this.metaScene = new Scene();
      this.metaScene.add(new Mesh(new PlaneGeometry(2,2), this.metaMaterial));
    }

    this.postCamera = new OrthographicCamera(- 1, 1, 1, - 1, 0, 1);
    if (!this.postMaterial) {
      this.postMaterial = new ShaderMaterial({
        vertexShader: abPostVS,
        fragmentShader: cloudsShaderPrefix + abPostFS,
        uniforms: {
          cameraFar: { value: this.camera.far },
          cameraNear: { value: this.camera.near },
          worldCameraPosition: { value: this.camera.getWorldPosition(new Vector3()) },
          viewportSizeInverse: { value: new Vector2(1/cloudsResolutionX, 1/cloudsResolutionY) },
          worldCameraUnprojectionMatrix: { value: this.camera.matrixWorld.clone().multiply(this.camera.projectionMatrixInverse) },
          tDiffuse: { value: null },
          tDepth: { value: null },
          timeSeconds: { value: 0 },

          noiseTexture: { value: noiseTexture },

          ditherDepth: { value: 1.0 },
          densityThreshold: { value: 4.0 },
          cloudsScale: { value: 120.0 },
          cloudsAltitude: { value: -370.0 },
          cloudsTransitionalLayerScale: { value: 1.95 },
          maxRMDistance: { value: 10000.0 },
          minRMStep: { value: 10.0 },
          rmStepScale: { value: 1.0 },
          transparencyThreshold: { value: 0.3 },

          detailsScale: { value: 36.0 },
          detailsIntensity: { value: 1.39 },
          detailsOffset: { value: new Vector3(0, 0, 0) },

          color1: { value: new Color().setRGB(0.874509804, 0.874509804, 0.796078431) }, // #dfdfcb
          color2: { value: new Color().setRGB(1, 1, 0.870588235) }, // #ffffde
          color3: { value: new Color().setRGB(0.19, 0.16, 0.00) },
          color4: { value: new Color() },

          alpha1: { value: 0.99 },
          alpha2: { value: 0.95 },

          densityColorGradientLength: { value: 100.0 },
          densityAlphaGradientLength: { value: 100.0 },

          fogColor: { value: new Color().setRGB(0.5, 0.0, 0.0) },
          fogTransparency: { value: 0.99 },
          fogEnabled: { value: false },

          sunDirection: { value: new Vector3(1,1,1).normalize() },
          sunCastDistance: { value: 20.0 },
        }
      });
    } else {
      this.postMaterial.fragmentShader = cloudsShaderPrefix + abPostFS;
      this.postMaterial.uniforms.viewportSizeInverse.value = new Vector2(1/cloudsResolutionX, 1/cloudsResolutionY);
      this.postMaterial.needsUpdate = true;
    }
    this.postScene = new Scene();
    this.postScene.add(new Mesh(new PlaneGeometry(2,2), this.postMaterial));
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
  }

  update(timestamp) {
    requestAnimationFrame(this.update.bind(this));

    this.controls.update(timestamp);

    // this.cloudsUpisfree.update();
    // this.cloudsShadertoy.update();

    this.render();
    this.stats.update();
  }

  render() {
    this.renderer.setRenderTarget(this.rt);
    this.renderer.render(this.scene, this.camera);
    this.postMaterial.uniforms.tDiffuse.value = this.rt.texture;
    this.postMaterial.uniforms.tDepth.value = this.rt.depthTexture;
    this.postMaterial.uniforms.worldCameraPosition.value = this.camera.getWorldPosition(new Vector3());
    this.postMaterial.uniforms.worldCameraUnprojectionMatrix.value = this.camera.matrixWorld.clone().multiply(this.camera.projectionMatrixInverse);
    this.postMaterial.uniforms.timeSeconds.value = this.clock.getElapsedTime();
    this.postMaterial.uniforms.detailsOffset.value = new Vector3(
      Math.cos(this.clock.getElapsedTime() * this.detailsWindChangeSpeed),
      Math.sin(this.clock.getElapsedTime() * this.detailsWindChangeSpeed * 0.3421),
      Math.sin(this.clock.getElapsedTime() * this.detailsWindChangeSpeed)
    ).multiplyScalar(this.detailsWindSpeed);

    if (this.undersampling > 0) {
      this.renderer.setRenderTarget(this.cloudsRt);
      this.renderer.setClearColor("black", 0.0);
      this.renderer.clear(true);
      this.renderer.render(this.postScene, this.postCamera);

      this.renderer.setRenderTarget(null);

      this.metaMaterial.uniforms.sceneTexture.value = this.rt.texture;
      this.metaMaterial.uniforms.cloudsTexture.value = this.cloudsRt.texture;

      this.renderer.render(this.metaScene, this.postCamera);
    } else {
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.postScene, this.postCamera);
    }
  }

  resize() {
    this.containerBounds = this.container.getBoundingClientRect();

    this.camera.aspect = this.containerBounds.width / this.containerBounds.height;
    this.camera.updateProjectionMatrix();

    let pixelRatio = window.devicePixelRatio;
    this.renderer.setPixelRatio(pixelRatio);

    this.renderer.setSize(this.containerBounds.width, this.containerBounds.height);
  }

  initObjects() {
    const material = new MeshStandardMaterial({
      color: 0x57b5f7,
      roughness: 1,
      // metalness: 1,
      flatShading: true,
      side: DoubleSide
    });

    let object = new Mesh(new SphereGeometry(75, 20, 10), material);
    object.position.set(-300, 0, 200);
    this.scene.add(object);

    object = new Mesh(new IcosahedronGeometry( 75, 1 ), material);
    object.position.set(-100, 0, 200);
    this.scene.add(object);

    object = new Mesh(new OctahedronGeometry(75, 2), material);
    object.position.set(100, 0, 200);
    this.scene.add(object);

    object = new Mesh(new TetrahedronGeometry( 75, 0), material);
    object.position.set(300, 0, 200);
    this.scene.add(object);

    //

    object = new Mesh(new PlaneGeometry(100, 100, 4, 4), material);
    object.position.set(- 300, 0, 0 );
    this.scene.add(object);

    object = new Mesh(new BoxGeometry(100, 100, 100, 4, 4, 4), material);
    object.position.set(- 100, 0, 0 );
    this.scene.add(object);

    object = new Mesh(new CircleGeometry(50, 20, 0, Math.PI * 2), material);
    object.position.set(100, 0, 0 );
    this.scene.add(object);

    object = new Mesh(new RingGeometry(10, 50, 20, 5, 0, Math.PI * 2), material);
    object.position.set(300, 0, 0 );
    this.scene.add(object);

    //

    object = new Mesh(new CylinderGeometry(25, 75, 100, 40, 5), material);
    object.position.set(-300, 0, -200);
    this.scene.add(object);

    const points = [];

    for ( let i = 0; i < 50; i ++ ) {

      points.push(new Vector2( Math.sin( i * 0.2 ) * Math.sin( i * 0.1 ) * 15 + 50, ( i - 5 ) * 2 ));

    }

    object = new Mesh(new LatheGeometry( points, 20), material);
    object.position.set(-100, 0, -200);
    this.scene.add(object);

    object = new Mesh(new TorusGeometry( 50, 20, 20, 20), material);
    object.position.set(100, 0, -200);
    this.scene.add(object);

    object = new Mesh(new TorusKnotGeometry(50, 10, 50, 20), material);
    object.position.set(300, 0, -200);
    this.scene.add(object);

    object = new Mesh(new TorusKnotGeometry(50, 10, 50, 20), material);
    object.position.set(0, 0, 10000);
    this.scene.add(object);
  }
}

export default CloudsDemo;
