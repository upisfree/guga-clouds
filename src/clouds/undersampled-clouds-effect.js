import { Effect, EffectAttribute, EffectPass } from "postprocessing";
import mergeShader from "./clouds-merge.frag.glsl?raw";
import cloudsEffectShader from "./clouds-post.frag.glsl?raw";
import postVertexShader from "./clouds-post.vertex.glsl?raw";
import { DepthTexture, Mesh, NearestFilter, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, Uniform, WebGLRenderTarget } from "three";
import { makeCloudsShaderUniforms } from "./clouds-uniforms";


const cloudsRawShader = `
#define OVERRIDE_DEPTH_INPUT
#define WRITE_CLOUDS_DEPTH
uniform float cameraNear;
uniform float cameraFar;
uniform sampler2D depthInputOverrideTexture;

${cloudsEffectShader}

void main(void) {
    vec2 uv = gl_FragCoord.xy * viewportSizeInverse;
    float depth = 0.0;
    // TODO: Adjust iteration counts and coordinates scale to undersampling size
    for (int i = -7; i < 8; ++i) {
        for (int j = -7; j < 8; ++j) {
            depth = max(
                depth,
                texture2D(
                    depthInputOverrideTexture,
                    uv + viewportSizeInverse * vec2(ivec2(i, j)) / 16.0
                ).r
            );
        }
    }
    //float depth = texture2D(depthInputOverrideTexture, uv).r;
    mainImage(vec4(0.0), uv, depth, gl_FragColor);
}
`;

class CloudsScene extends Scene {
    /**
     * @param {{
     *  noiseTexture: import('three').Texture,
     *  noiseTexture3d: import('three').Texture,
     *  camera: import('three').PerspectiveCamera,
     * }} param0 
     */
    constructor({
        noiseTexture,
        noiseTexture3d,
        camera,
        clock,
    }) {
        super();

        /** @type {import('three').Clock} */
        this._clock = clock;

        /** @type {import('three').PerspectiveCamera} */
        this._worldCamera = camera;

        this._material = new ShaderMaterial({
            vertexShader: postVertexShader,
            fragmentShader: cloudsRawShader,
            uniforms: [
                ...makeCloudsShaderUniforms({
                    noiseTexture,
                    noiseTexture3d,
                    extraUniforms: new Map([
                        ['depthInputOverrideTexture', new Uniform(null)],
                        ['cameraNear', new Uniform(camera.near)],
                        ['cameraFar', new Uniform(camera.far)],
                    ]),
                }).entries()
            ].reduce((o, [n, u]) => Object.assign(o, { [n]: u }), {}),
            // depthTest: false,
            depthWrite: true,
        });

        this.add(new Mesh(new PlaneGeometry(2, 2), this._material));

        this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    }

    onBeforeRender(_renderer, _scene, _camera) {
        const uniforms = this._material.uniforms;

        uniforms.timeSeconds.value = this._clock.getElapsedTime();

        this._worldCamera.getWorldPosition(uniforms.worldCameraPosition.value);

        uniforms
            .worldCameraUnprojectionMatrix.value
            .copy(this._worldCamera.matrixWorld)
            .multiply(this._worldCamera.projectionMatrixInverse);
    }

    get cloudsUniforms() {
        return new Map(Object.entries(this._material.uniforms))
    }

    set inputDepthTexture(tx) {
        this._material.uniforms.depthInputOverrideTexture.value = tx;
    }

    resize(w, h) {
        this._material.uniforms.viewportSizeInverse.value.set(1 / w, 1 / h);
    }
}

class CloudsMergeEffect extends Effect {
    constructor() {
        super("CloudsColorMerge", mergeShader, {
            uniforms: new Map([
                ["cloudsTexture", new Uniform()],
                ["cloudsDepthTexture", new Uniform()],
            ]),
            attributes: EffectAttribute.DEPTH,
        });
    }

    set cloudsTexture(tx) {
        this.uniforms.get("cloudsTexture").value = tx;
    }

    set cloudsDepthTexture(tx) {
        this.uniforms.get('cloudsDepthTexture').value = tx;
    }
}

export class UndersampledCloudsPass extends EffectPass {
    constructor({
        postCloudsEffects = [],
        camera,
        clock,
        noiseTexture,
        noiseTexture3d,
        undersampling,
    }) {
        const mergeEffect = new CloudsMergeEffect();

        super(camera, mergeEffect, ...postCloudsEffects);

        this.undersampling = undersampling;

        this._mergeEffect = mergeEffect;
        this._cloudsScene = new CloudsScene({ noiseTexture, noiseTexture3d, camera, clock });

        this._rt = new WebGLRenderTarget(undefined, undefined, { depth: true, magFilter: NearestFilter, depthTexture: new DepthTexture() });
    }

    _ensureRenderTargetSize(fullWidth, fullHeight) {
        const expectedWidth = Math.ceil(fullWidth / this.undersampling);
        const expectedHeight = Math.ceil(fullHeight / this.undersampling);

        if (this._rt.width !== expectedWidth || this._rt.height !== expectedHeight) {
            // console.log(`Resizing clouds RT from ${this._rt.width}x${this._rt.height} to ${expectedWidth}x${expectedHeight}`);
            this._rt.setSize(expectedWidth, expectedHeight);
            this._cloudsScene.resize(expectedWidth, expectedHeight);
        }
    }

    get cloudsUniforms() {
        return this._cloudsScene.cloudsUniforms;
    }

    render(
        /** @type {import("three").WebGLRenderer} */
        renderer,
        /** @type {import("three").WebGLRenderTarget} */
        inputBuffer,
        outputBuffer,
        deltaTime,
        stencilTest,
    ) {
        this._cloudsScene.inputDepthTexture = inputBuffer.depthTexture;

        this._ensureRenderTargetSize(inputBuffer.width, inputBuffer.height);
        renderer.setRenderTarget(this._rt);
        renderer.clear(true, true);
        renderer.render(this._cloudsScene, this._cloudsScene.camera);

        this._mergeEffect.cloudsTexture = this._rt.texture;
        this._mergeEffect.cloudsDepthTexture = this._rt.depthTexture;

        super.render(renderer, inputBuffer, outputBuffer, deltaTime, stencilTest);
    }
}
