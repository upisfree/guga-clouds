import { BlendFunction, Effect, EffectAttribute, Resolution } from 'postprocessing';
import fragmentShader from './ab-post.frag.glsl?raw';
import {
  Color,
  DepthTexture, Mesh,
  OrthographicCamera, PlaneGeometry,
  Scene,
  Texture,
  Uniform,
  Vector2,
  Vector3,
  WebGLRenderTarget
} from 'three';

class CloudsEffect extends Effect {
  // сразу задаю поля для переезда на тайпскрипт в будущем
  resolution = null;

  scene = null;
  camera = null;

  undersampling = 0;
  geometryMultisampling = 0;

  renderTarget = null;

  // clock общий для всей игры
  constructor(scene, camera, clock, {
    noiseTexture,
    undersampling = 0, // TODO: onChange getter setter
    geometryMultisampling = 8,
    detailsWindSpeed = 200.0,
    detailsWindChangeSpeed = 0.05,
    // TODO: вынести дефолтные опции
  }) {
    super('CloudsEffect', fragmentShader, {
      blendFunction: BlendFunction.NORMAL,

      // TODO: @AlexeyBond не понимаю что такое CONVOLUTION и нужен ли он, но на всякий случай добавил
      // CONVOLUTION Describes effects that fetch additional samples from the input buffer. There cannot be more than one effect with this attribute per EffectPass.
      // https://pmndrs.github.io/postprocessing/public/docs/variable/index.html#static-variable-EffectAttribute
      attributes: EffectAttribute.CONVOLUTION | EffectAttribute.DEPTH,

      defines: new Map([
        ['DEPTH_COORD_MULTIPLIER', '1'],
        ['MERGE_COLOR', 'false']
      ]),

      uniforms: new Map([
        // библиотека задает это сама
        // ['cameraNear', new Uniform(camera.near)],
        // ['cameraFar', new Uniform(camera.far)],
        ['worldCameraPosition', new Uniform(camera.getWorldPosition(new Vector3()))], // TODO: можно забирать напрямую с камеры
        ['viewportSizeInverse', new Uniform(new Vector2(1, 1))],
        ['worldCameraUnprojectionMatrix', new Uniform(camera.matrixWorld.clone().multiply(camera.projectionMatrixInverse))],
        ['timeSeconds', new Uniform(0)],

        ['noiseTexture', new Uniform(noiseTexture)],

        ['ditherDepth', new Uniform(1.0)],
        ['densityThreshold', new Uniform(4.0)],
        ['cloudsScale', new Uniform(120.0)],
        ['cloudsAltitude', new Uniform(-110.0)],
        ['cloudsAltitudeShift', new Uniform(-180)],
        ['cloudsFloorAltitude', new Uniform(40)],
        ['cloudsCeilAltitude', new Uniform(1000)],
        ['cloudsFloorSmoothingRange', new Uniform(100.0)],
        ['cloudsCeilSmoothingRange', new Uniform(100.0)],
        ['cloudsTransitionalLayerScale', new Uniform(1.95)],
        ['maxRMDistance', new Uniform(10000.0)],
        ['minRMStep', new Uniform(10.0)],
        ['rmStepScale', new Uniform(1.0)],
        ['transparencyThreshold', new Uniform(0.3)],

        ['detailsScale', new Uniform(36.0)],
        ['detailsIntensity', new Uniform(1.39)],
        ['detailsOffset', new Uniform(new Vector3(0, 0, 0))],

        // TODO: проименовать цвета, чтобы они отражали их значение
        // TODO: вынести цвета отсюда повыше
        ['color1', new Uniform(new Color().setRGB(0.874509804, 0.874509804, 0.796078431))], // #dfdfcb
        ['color2', new Uniform(new Color().setRGB(1, 1, 0.870588235))], // #ffffde
        ['color3', new Uniform(new Color().setRGB(0.19, 0.16, 0.00))],
        ['color4', new Uniform(new Color())],

        ['alpha1', new Uniform(0.99)],
        ['alpha2', new Uniform(0.95)],

        ['densityColorGradientLength', new Uniform(100.0)],
        ['densityAlphaGradientLength', new Uniform(100.0)],

        ['fogColor', new Uniform(new Color().setRGB(0.5, 0.0, 0.0))],
        ['fogTransparency', new Uniform(0.99)],
        ['fogEnabled', new Uniform(false)],

        ['sunDirection', new Uniform(new Vector3(1, 1, 1).normalize())],
        ['sunCastDistance', new Uniform(20.0)],
      ])
    });

    this.scene = scene;
    this.camera = camera;
    this.clock = clock;

    this.undersampling = undersampling;
    this.geometryMultisampling = geometryMultisampling;

    this.detailsWindSpeed = detailsWindSpeed;
    this.detailsWindChangeSpeed = detailsWindChangeSpeed;

    this.renderTarget = new WebGLRenderTarget(1, 1, { samples: this.geometryMultisampling });
    this.renderTarget.texture.name = 'Clouds.Intermediate';
    this.renderTarget.depthTexture = new DepthTexture(); // TODO: в примерах либы у нее нигде не задается размер, это проблема?

    // TODO: добавить в поля сверху
    this.postCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.postScene = new Scene();
    this.postScene.add(new Mesh(new PlaneGeometry(2, 2), this.postMaterial));

    const resolution = this.resolution = new Resolution(this, window.innerWidth, window.innerHeight, 1);
    resolution.addEventListener('change', (e) => this.setSize(resolution.baseWidth, resolution.baseHeight));
  }

  initialize(renderer, alpha, frameBufferType) {
    super.initialize(renderer, alpha, frameBufferType);
  }

  // deltaTime in seconds
  update(renderer, inputBuffer, deltaTime) {
    const scene = this.scene;
    const camera = this.camera;
    const clock = this.clock;
    const uniforms = this.uniforms;

    // update uniforms
    uniforms.get('worldCameraPosition').value = camera.getWorldPosition(new Vector3()); // TODO: reuse vector
    uniforms.get('worldCameraUnprojectionMatrix').value = camera.matrixWorld.clone().multiply(camera.projectionMatrixInverse);
    uniforms.get('timeSeconds').value = clock.getElapsedTime();
    uniforms.get('detailsOffset').value = new Vector3(
      Math.cos(clock.getElapsedTime() * this.detailsWindChangeSpeed),
      Math.sin(clock.getElapsedTime() * this.detailsWindChangeSpeed * 0.3421),
      Math.sin(clock.getElapsedTime() * this.detailsWindChangeSpeed)
    ).multiplyScalar(this.detailsWindSpeed);

    super.update(renderer, inputBuffer, deltaTime);
  }

  setSize(width, height) {
    const uniforms = this.uniforms;

    const resolution = this.resolution;
    resolution.setBaseSize(width, height);
    const w = resolution.width;
    const h = resolution.height;

    // TODO: resolution factor for optimization? only works with non merged color?

    this.renderTarget.setSize(w, h);
    // this.renderTarget.depthTexture = new DepthTexture(w, h); // хз?

    let cloudsResolutionX = w;
    let cloudsResolutionY = h;

    uniforms.get('viewportSizeInverse').value = new Vector2(1 / cloudsResolutionX, 1 / cloudsResolutionY);

    // this.renderTarget.depthTexture = new DepthTexture(w, h); // хз?

    // this.blurPass.setSize(width, height);
    // this.renderTargetMask.setSize(width, height);
    //
    // const resolution = this.resolution;
    // resolution.setBaseSize(width, height);
    // const w = resolution.width, h = resolution.height;
    //
    // this.depthPass.setSize(w, h);
    // this.renderTargetOutline.setSize(w, h);
    // this.outlinePass.fullscreenMaterial.setSize(w, h);
  }
}

export { CloudsEffect };