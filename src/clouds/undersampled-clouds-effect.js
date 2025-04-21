import { Effect, EffectComposer, EffectPass, EffectAttribute, BlendFunction } from "postprocessing";
import mergeShader from "./clouds-merge.frag.glsl?raw";
import { HalfFloatType, Uniform, Vector2 } from "three";
import { BaseCloudsEffect } from "./base-clouds-effect";


class LowResolutionCloudsEffect extends BaseCloudsEffect {
    constructor({
        camera,
        clock,
        noiseTexture,
        noiseTexture3d,
    }) {
        super("LowResolutionClouds", {
            camera,
            clock,
            noiseTexture,
            noiseTexture3d,
            uniforms: new Map([
                ["depthInputOverrideTexture", new Uniform(noiseTexture)],
            ]),
            defines: new Map([
                ["OVERRIDE_DEPTH_INPUT", "1"],
            ]),

            // TODO: На самом деле шейдер не будет использовать буфер глубины от композера (он будет передан отдельно).
            // Но postprocessing отказывается компилировать шейдер если убрать этот флаг или сделать параметр depth в
            // шейдере условным через препроцессор.
            attributes: EffectAttribute.DEPTH,

            blendFunction: BlendFunction.SET,
        });
    }

    set inputDepthTexture(tx) {
        this.uniforms.get("depthInputOverrideTexture").value = tx;
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
        lowResEffects = [],
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

        this._cloudsEffect = new LowResolutionCloudsEffect({ camera, clock, noiseTexture, noiseTexture3d });
        this._mergeEffect = mergeEffect;

        this._sidechainComposer = new EffectComposer(
            renderer,
            {
                depthBuffer: false,
                frameBufferType: HalfFloatType,
            }
        );
        this._sidechainComposer.autoRenderToScreen = false;
        this._sidechainComposer.addPass(new EffectPass(camera, this._cloudsEffect, ...lowResEffects));

        this._sz = new Vector2();
    }

    get cloudsUniforms() {
        return this._cloudsEffect.uniforms;
    }

    render(
        renderer,
        /** @type {import("three").WebGLRenderTarget} */
        inputBuffer,
        outputBuffer,
        deltaTime,
        stencilTest,
    ) {
        this._cloudsEffect.inputDepthTexture = inputBuffer.depthTexture;

        this._sidechainComposer.setSize(
            Math.ceil(inputBuffer.width / this.undersampling),
            Math.ceil(inputBuffer.height / this.undersampling),
            false,
        );

        this._sidechainComposer.render(deltaTime);
        
        this._mergeEffect.cloudsTexture = this._sidechainComposer.outputBuffer.texture;

        renderer.setSize(outputBuffer.width, outputBuffer.height, false);

        super.render(renderer, inputBuffer, outputBuffer, deltaTime, stencilTest);
    }
}
