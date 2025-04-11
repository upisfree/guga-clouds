import { BlendFunction, EffectAttribute } from 'postprocessing';
import { BaseCloudsEffect } from './base-clouds-effect';

/**
 * Эффект, который рендерит облока прямо поверх картинки с предыдущих этапов.
 */
export class DirectCloudsEffect extends BaseCloudsEffect {
    constructor({
        camera,
        clock,
        noiseTexture,
    }) {
        super('DirectCloudsEffect', {
            camera,
            clock,
            noiseTexture,

            blendFunction: BlendFunction.NORMAL,

            attributes: EffectAttribute.DEPTH,

            defines: new Map([
                ['MERGE_COLOR', '1'],
            ]),
        });
    }
}
