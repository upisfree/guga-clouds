import { BlendFunction, Effect, EffectAttribute, Resolution, ShaderPass } from 'postprocessing';
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
  Matrix4,
  WebGLRenderTarget, ShaderMaterial
} from 'three';
import abPostVS from './ab-post.vertex.glsl?raw';
import abMergeFS from './ab-merge.frag.glsl?raw';

const _worldCameraPosition = new Vector3();
const _viewportSizeInverse = new Vector2(1, 1);
const _worldCameraUnprojectionMatrix = new Matrix4();
const _detailsOffset = new Vector3();

class CloudsEffect extends Effect {
  // сразу задаю поля для переезда на тайпскрипт в будущем
  resolution = null;

  scene = null;
  camera = null;

  renderTarget = null;


  _undersampling = 0;

  get undersampling() {
    return this._undersampling;
  }

  set undersampling(value) {
    this._undersampling = value;

    // TODO: здесь нужно пересоздавать WebGLRenderTarget с нужным размером
  }

  _geometryMultisampling = 0;

  get geometryMultisampling() {
    return this._geometryMultisampling;
  }

  set geometryMultisampling(value) {
    this._geometryMultisampling = value;
  }

  // clock общий для всей игры
  constructor(scene, camera, clock, {
    noiseTexture,
    undersampling = 0, // TODO: onChange getter setter
    geometryMultisampling = 8,
    detailsWindSpeed = 200.0,
    detailsWindChangeSpeed = 0.05,
  }) {
    super('CloudsEffect', fragmentShader, {
      blendFunction: BlendFunction.NORMAL,

      attributes: EffectAttribute.DEPTH,

      defines: new Map([
        ['DEPTH_COORD_MULTIPLIER', '1'],
        ['MERGE_COLOR', 'true']
      ]),

      uniforms: new Map([
        ['worldCameraPosition', new Uniform(_worldCameraPosition)], // TODO: можно забирать напрямую с камеры
        ['viewportSizeInverse', new Uniform(_viewportSizeInverse)],
        ['worldCameraUnprojectionMatrix', new Uniform(_worldCameraUnprojectionMatrix)],
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
        ['detailsOffset', new Uniform(_detailsOffset)],

        // TODO: проименовать цвета, чтобы они отражали их значение
        // TODO: вынести цвета отсюда повыше, когда настрою чистовые
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

    // config
    this.undersampling = undersampling;
    this.geometryMultisampling = geometryMultisampling;

    this.detailsWindSpeed = detailsWindSpeed;
    this.detailsWindChangeSpeed = detailsWindChangeSpeed;

    this.undersamplingPass = new ShaderPass(
      new ShaderMaterial({
        vertexShader: abPostVS,
        fragmentShader: abMergeFS,
        uniforms: {
          sceneTexture: { value: null },
          cloudsTexture: { value: null },
          viewportSizeInverse: { value: _viewportSizeInverse },
        }
      }),
      'sceneTexture'
    );
    this.undersamplingMaterial = this.undersamplingPass.fullscreenMaterial;

    this.renderTarget = new WebGLRenderTarget(1, 1, { samples: this.geometryMultisampling });
    this.renderTarget.texture.name = 'Clouds.Intermediate';
    this.renderTarget.depthTexture = new DepthTexture(); // TODO: в примерах либы у нее нигде не задается размер, это проблема?
    //
    // this.rt = new WebGLRenderTarget(resolutionX, resolutionY, { samples: this.geometryMultisampling });
    // this.rt.depthTexture = new DepthTexture(resolutionX, resolutionY);

    const resolution = this.resolution = new Resolution(this, Resolution.AUTO_SIZE, Resolution.AUTO_SIZE, 1);
    resolution.addEventListener('change', (e) => this.setSize(resolution.baseWidth, resolution.baseHeight));
  }

  initialize(renderer, alpha, frameBufferType) {
    this.undersamplingPass.initialize(renderer, alpha, frameBufferType);

    super.initialize(renderer, alpha, frameBufferType);

    // if(frameBufferType !== undefined) {
    //
    //   this.renderTargetA.texture.type = frameBufferType;
    //   this.renderTargetB.texture.type = frameBufferType;
    //   this.renderTargetLight.texture.type = frameBufferType;
    //
    //   if(renderer !== null && renderer.outputColorSpace === SRGBColorSpace) {
    //
    //     this.renderTargetA.texture.colorSpace = SRGBColorSpace;
    //     this.renderTargetB.texture.colorSpace = SRGBColorSpace;
    //     this.renderTargetLight.texture.colorSpace = SRGBColorSpace;
    //
    //   }
    //
    // }
  }

  // deltaTime in seconds
  update(renderer, inputBuffer, deltaTime) {
    const scene = this.scene;
    const camera = this.camera;
    const clock = this.clock;
    const uniforms = this.uniforms;
    const time = clock.getElapsedTime();

    // update uniforms
    uniforms.get('timeSeconds').value = time;
    // worldCameraPosition
    camera.getWorldPosition(_worldCameraPosition);
    // worldCameraUnprojectionMatrix
    _worldCameraUnprojectionMatrix.copy(camera.matrixWorld).multiply(camera.projectionMatrixInverse);
    // detailsOffset
    _detailsOffset.set(
      Math.cos(time * this.detailsWindChangeSpeed),
      Math.sin(time * this.detailsWindChangeSpeed * 0.3421),
      Math.sin(time * this.detailsWindChangeSpeed)
    ).multiplyScalar(this.detailsWindSpeed);

    if (this.undersampling > 0) {
      // console.log(this.undersamplingMaterial.uniforms)
      this.undersamplingMaterial.uniforms.sceneTexture = inputBuffer;
      this.undersamplingMaterial.uniforms.cloudsTexture = this.renderTarget.texture;

      // return;

      this.undersamplingPass.render(renderer, inputBuffer, this.renderTarget, deltaTime);

      // super.update(renderer, inputBuffer, deltaTime);
    } else {
      super.update(renderer, inputBuffer, deltaTime);
    }
  }

  // TODO: https://github.com/pmndrs/postprocessing/blob/0831d3dd66829a5a0c37e0bc1f359c486439f461/src/effects/DepthOfFieldEffect.js#L533
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

    // update uniform "viewportSizeInverse"
    _viewportSizeInverse.set(1 / cloudsResolutionX, 1 / cloudsResolutionY);

    // this.renderTarget.depthTexture = new DepthTexture(w, h); // хз?

    // тут меньше?
    this.undersamplingPass.setSize(width, height);

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