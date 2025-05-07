import { Effect, EffectComposer, EffectPass, EffectAttribute, BlendFunction } from "postprocessing";
import mergeShader from "./clouds-merge.frag.glsl?raw";
import cloudsEffectShader from "./clouds-post.frag.glsl?raw";
import { HalfFloatType, NearestFilter, Scene, ShaderMaterial, Uniform, Vector2, WebGLRenderTarget } from "three";
import { makeCloudsShaderUniforms } from "./clouds-uniforms";


const cloudsRawShader = `
#define OVERRIDE_DEPTH_INPUT

${cloudsEffectShader}

void main(void) {
    vec2 uv = gl_FragCoord.xy * viewportSizeInverse;
    mainImage(vec4(0.0), uv, 0.0, gl_FragCoord);
};
`;

class CloudsScene extends Scene {
    constructor({ noiseTexture, noiseTexture3d }) {
        super();

        this._material = new ShaderMaterial({
            fragmentShader: cloudsRawShader,
            uniforms: makeCloudsShaderUniforms({ noiseTexture, noiseTexture3d })
        })
        // TODO
    }
}

class CloudsMergeEffect extends Effect {
    constructor() {
        super("CloudsColorMerge", mergeShader, {
            uniforms: new Map([
                ["cloudsTexture", new Uniform()],
            ]),
        });
    }

    set cloudsTexture(tx) {
        this.uniforms.get("cloudsTexture").value = tx;
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
        renderer,
    }) {
        const mergeEffect = new CloudsMergeEffect();

        super(camera, mergeEffect, ...postCloudsEffects);

        this.undersampling = undersampling;

        this._mergeEffect = mergeEffect;

        this._rt = new WebGLRenderTarget(undefined, undefined, { depth: false, magFilter: NearestFilter });
    }

    _ensureRenderTargetSize(fullWidth, fullHeight) {
        const expectedWidth = Math.ceil(fullWidth / this.undersampling);
        const expectedHeight = Math.ceil(fullHeight / this.undersampling);

        if (this._rt.width !== expectedWidth || this._rt.height !== expectedHeight) {
            console.log(`Resizing clouds RT from ${this._rt.width}x${this._rt.height} to ${expectedWidth}x${expectedHeight}`);
            this._rt.setSize(expectedWidth, expectedHeight);
        }
    }

    get cloudsUniforms() {
        // TODO
        // return this._cloudsEffect.uniforms;
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
        // this._cloudsEffect.inputDepthTexture = inputBuffer.depthTexture;

        this._ensureRenderTargetSize(inputBuffer.width, inputBuffer.height);
        renderer.setRenderTarget(this._rt);

        // TODO: Render clouds

        this._mergeEffect.cloudsTexture = this._rt.texture;

        super.render(renderer, inputBuffer, outputBuffer, deltaTime, stencilTest);
    }
}
