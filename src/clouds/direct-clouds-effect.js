import { BlendFunction, EffectAttribute } from 'postprocessing';
import { BaseCloudsEffect } from './base-clouds-effect';

/**
 * Эффект, который рендерит облака прямо поверх картинки с предыдущих этапов.
 */
export class DirectCloudsEffect extends BaseCloudsEffect {
    constructor({
        camera,
        clock,
        noiseTexture,
        noiseTexture3d,
    }) {
        super('DirectCloudsEffect', {
            camera,
            clock,
            noiseTexture,
            noiseTexture3d,

            blendFunction: BlendFunction.NORMAL,

            attributes: EffectAttribute.DEPTH,

            defines: new Map([
                ['MERGE_COLOR', '1'],
            ]),
        });
    }
}
