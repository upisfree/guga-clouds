import { Vector3 } from "three";

/**
 * Обновляет юниформы шейдера облаков в зависимости от времени для эмитации ветра.
 * 
 * Пока ветер эмитируется только для одного слоя шума - его смещение задаётся переменной detailsOffset.
 */
export class Wind {
    constructor(
        uniforms,
        clock,
        {
            detailsWindSpeed = 200.0,
            detailsWindChangeSpeed = 0.05,
        } = {},
    ) {
        this._clock = clock;
        this._uniforms = uniforms;
        this.detailsWindSpeed = detailsWindSpeed;
        this.detailsWindChangeSpeed = detailsWindChangeSpeed;
    }

    update() {
        this._uniforms.detailsOffset = new Vector3(
            Math.cos(this._clock.getElapsedTime() * this.detailsWindChangeSpeed),
            Math.sin(this._clock.getElapsedTime() * this.detailsWindChangeSpeed * 0.3421),
            Math.sin(this._clock.getElapsedTime() * this.detailsWindChangeSpeed)
        ).multiplyScalar(this.detailsWindSpeed);
    }
}
