import { Effect } from "postprocessing";
import fragmentShader from './clouds-post.frag.glsl?raw';
import { makeCloudsShaderUniforms } from "./clouds-uniforms";

export class BaseCloudsEffect extends Effect {
    constructor(name, {
        uniforms = new Map(),
        defines = new Map(),
        camera,
        clock,
        noiseTexture,
        ...extraSettings
    }) {
        super(name, fragmentShader, {
            uniforms: makeCloudsShaderUniforms({ noiseTexture, extraUniforms: uniforms }),
            defines,
            ...extraSettings,
        });

        this._camera = camera;
        this._clock = clock;
    }
    
    update(renderer, inputBuffer, deltaTime) {
        const camera = this._camera;
        const uniforms = this.uniforms;

        uniforms.get('timeSeconds').value = this._clock.getElapsedTime();

        camera.getWorldPosition(uniforms.get("worldCameraPosition").value);

        uniforms.get('worldCameraUnprojectionMatrix').value
            .copy(camera.matrixWorld)
            .multiply(camera.projectionMatrixInverse);

        super.update(renderer, inputBuffer, deltaTime);
    }

    setSize(width, height) {
        this.uniforms.get("viewportSizeInverse").value.set(1 / width, 1 / height);
    }
}
