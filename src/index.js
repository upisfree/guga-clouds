import {
  AmbientLight, BoxGeometry, CircleGeometry, Clock, Color, CylinderGeometry, DepthTexture, DirectionalLight,
  DoubleSide, GridHelper, IcosahedronGeometry, LatheGeometry,
  Matrix3,
  Matrix4,
  Mesh,
  MeshPhongMaterial, MeshStandardMaterial, NeutralToneMapping, OctahedronGeometry,
  OrthographicCamera,
  PerspectiveCamera, PlaneGeometry, RingGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry, TetrahedronGeometry, TorusGeometry, TorusKnotGeometry, Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget
} from 'three';
import { ControlMode, PointerBehaviour, SpatialControls } from 'spatial-controls';
import CloudsUpisfree from './clouds-upisfree';
import CloudsShadertoy from './clouds-shadertoy';
import abPostVS from './ab-post.vertex.glsl?raw';
import abPostFS from './ab-post.frag.glsl?raw';
import { degToRad } from 'three/src/math/MathUtils.js';

class CloudsDemo {
  constructor(container) {
    this.container = container;

    this.init3D();
    this.initPost()
    this.initObjects();

    this.cloudsUpisfree = new CloudsUpisfree(this.camera);

    if (location.search.includes('upisfree')) {
      this.scene.add(this.cloudsUpisfree);
    }

    this.cloudsShadertoy = new CloudsShadertoy(this.camera);

    if (location.search.includes('shadertoy')) {
      this.scene.add(this.cloudsShadertoy);
    }

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
    this.camera.position.set(0, 0, 100);
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

    const gridHelper = new GridHelper(10000, 150);
    this.scene.add(gridHelper);

    this.initLights();
  }

  initPost() {
    console.log(this.renderer.getPixelRatio());
    this.rt = new WebGLRenderTarget(this.renderer.getPixelRatio() * window.innerWidth, this.renderer.getPixelRatio() * window.innerHeight);
    this.rt.depthTexture = new DepthTexture(this.rt.width, this.rt.height);

    this.postCamera = new OrthographicCamera(- 1, 1, 1, - 1, 0, 1);
    this.postMaterial = new ShaderMaterial({
      vertexShader: abPostVS,
      fragmentShader: abPostFS,
      uniforms: {
        worldCameraPosition: { value: this.camera.getWorldPosition(new Vector3()) },
        viewportSizeInverse: { value: new Vector2(1/this.rt.width, 1/this.rt.height) },
        worldCameraUnprojectionMatrix: { value: this.camera.matrixWorld.clone().multiply(this.camera.projectionMatrixInverse) },
        tDiffuse: { value: null },
        tDepth: { value: null },
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

    this.cloudsUpisfree.update();
    this.cloudsShadertoy.update();

    this.render();
  }

  render() {
    this.renderer.setRenderTarget(this.rt);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.postMaterial.uniforms.tDiffuse.value = this.rt.texture;
    this.postMaterial.uniforms.tDepth.value = this.rt.depthTexture;
    this.postMaterial.uniforms.worldCameraPosition.value = this.camera.getWorldPosition(new Vector3());
    this.postMaterial.uniforms.worldCameraUnprojectionMatrix.value = this.camera.matrixWorld.clone().multiply(this.camera.projectionMatrixInverse);
    this.renderer.render(this.postScene, this.postCamera);
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
