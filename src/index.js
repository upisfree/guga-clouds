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
  WebGLRenderer
} from 'three';
import { ControlMode, PointerBehaviour, SpatialControls } from 'spatial-controls';
import { Pane } from 'tweakpane';
import CloudsUpisfree from './clouds-upisfree';
import CloudsShadertoy from './clouds-shadertoy';
import abPostVS from './ab-post.vertex.glsl?raw';
import abPostFS from './ab-post.frag.glsl?raw';
import abMergeFS from './ab-merge.frag.glsl?raw';
import Stats from 'three/examples/jsm/libs/stats.module.js';

class CloudsDemo {
  constructor(container) {
    this.container = container;

    this.undersampling = 2;

    this.init3D();
    this.initPost()
    this.initObjects();

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
      // TODO: Адаптировать шейдер для логарифмического буфера глубины или отказаться от логарифмического буфера глубины (?)
      // logarithmicDepthBuffer: true
    });
    this.container.appendChild(this.renderer.domElement);

    this.stats = new Stats();
    this.container.appendChild(this.stats.dom);
    this.showStats = true;

    this.scene = new Scene();
    this.scene.background = new Color(0xb5d9f8);
    // this.scene.fog = new Fog(0xb5d9f8, 150, 310);

    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.5;

    this.clock = new Clock();

    this.camera = new PerspectiveCamera(60, 1, 0.1, 10000);

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
    cloudsFolder.addBinding(this.postMaterial.uniforms.cloudsScale, "value", {
      label: "Scale",
      min: 1.0,
      max: 500.0,
    });
    cloudsFolder.addBinding(this.postMaterial.uniforms.cloudsAltitude, "value", {
      label: "Altitude",
      min: -500,
      max: 500,
    });
    cloudsFolder.addBinding(this.postMaterial.uniforms.maxRMDistance, "value", {
      label: "Max distance",
      min: 500.0,
      max: 10000.0,
    });
    cloudsFolder.addBinding(this.postMaterial.uniforms.minRMStep, "value", {
      label: "Min step",
      min: 0.04,
      max: 20.0,
    });
    cloudsFolder.addBinding(this.postMaterial.uniforms.rmStepScale, "value", {
      label: "Step size",
      min: 0.2,
      max: 4.0,
    });
    cloudsFolder.addBinding(this.postMaterial.uniforms.densityThreshold, "value", {
      label: "Density threshold",
      min: 0.0,
      max: 10.0,
    });
    cloudsFolder.addBinding(this.postMaterial.uniforms.transparencyThreshold, "value", {
      label: "Transparency threshold",
      min: 0.00001,
      max: 0.5,
    });
    cloudsFolder.addBinding(this.postMaterial.uniforms.ditherDepth, "value", {
      label: "Dithering depth",
      min: 0.0,
      max: 1.0,
    });
    cloudsFolder.addBinding(this.postMaterial.uniforms.color1, "value", {
      label: "Color 1",
      color: { type: 'float' },
    });
    cloudsFolder.addBinding(this.postMaterial.uniforms.color2, "value", {
      label: "Color 2",
      color: { type: 'float' },
    });
    cloudsFolder.addBinding(this.postMaterial.uniforms.color3, "value", {
      label: "Color 3",
      color: { type: 'float' },
    });
    // cloudsFolder.addBinding(this.postMaterial.uniforms.color4, "value", {
    //   label: "Color 4",
    //   color: { type: 'float' },
    // });
    cloudsFolder.addBinding(this, "undersampling", {
      label: "Undersampling",
      min: 0,
      max: 4,
      step: 1,
    }).on("change", () => this.initPost());

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
    #define SAMPLE_COLOR
    `;

    if (this.undersampling > 0) {
      this.undersampling = Math.ceil(this.undersampling);

      const scale = 2 ** this.undersampling;
      [cloudsResolutionX, cloudsResolutionY] = [resolutionX / scale, resolutionY / scale];
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
    this.postMaterial = new ShaderMaterial({
      vertexShader: abPostVS,
      fragmentShader: cloudsShaderPrefix + abPostFS,
      uniforms: {
        worldCameraPosition: { value: this.camera.getWorldPosition(new Vector3()) },
        viewportSizeInverse: { value: new Vector2(1/cloudsResolutionX, 1/cloudsResolutionY) },
        worldCameraUnprojectionMatrix: { value: this.camera.matrixWorld.clone().multiply(this.camera.projectionMatrixInverse) },
        tDiffuse: { value: null },
        tDepth: { value: null },
        timeSeconds: { value: 0 },

        ditherDepth: { value: 1.0 },
        densityThreshold: { value: 4.0 },
        cloudsScale: { value: 50.0 },
        cloudsAltitude: { value: 0.0 },
        maxRMDistance: { value: 5000.0 },
        minRMStep: { value: 10.0 },
        rmStepScale: { value: 1.0 },
        transparencyThreshold: { value: 0.1 },

        color1: { value: new Color().setRGB(0.9, 0.9, 0.9) },
        color2: { value: new Color().setRGB(0.75, 0.75, 0.84) },
        color3: { value: new Color().setRGB(1.0,0.95,0.8) },
        color4: { value: new Color() },
      }
    });
    this.postScene = new Scene();
    this.postScene.add(new Mesh(new PlaneGeometry(2,2), this.postMaterial));
  }

  initLights() {
    this.ambientLight = new AmbientLight(0xffffff, 2);
    this.scene.add(this.ambientLight);

    this.directionalLight = new DirectionalLight(0xffffff, 1);
    this.directionalLight.position.set(10, 0, 0);
    this.scene.add(this.directionalLight);
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
  }
}

export default CloudsDemo;
