import { BlendFunction, Effect, EffectAttribute } from 'postprocessing';
import fragmentShader from './clouds-post.frag.glsl?raw';
import { makeCloudsShaderUniforms } from './clouds-uniforms';

/**
 * Эффект, который рендерит облока прямо поверх картинки с предыдущих этапов.
 * 
 * TODO: Облака, рендерящиеся в пониженом разрешении будут реализованы отдельным пассом/эффектом.
 */
export class DirectCloudsEffect extends Effect {
    // сразу задаю поля для переезда на тайпскрипт в будущем
    _camera = null;
    _clock = null;

    constructor({
        camera,
        clock,
        noiseTexture,
    }) {
        super('CloudsEffect', fragmentShader, {
            blendFunction: BlendFunction.NORMAL,

            attributes: EffectAttribute.DEPTH,

            defines: new Map([
                ['DEPTH_COORD_MULTIPLIER', '1'],
                ['MERGE_COLOR', 'true']
            ]),

            uniforms: makeCloudsShaderUniforms({ noiseTexture }),
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
