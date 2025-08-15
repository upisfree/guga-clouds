import { Uniform, Vector2, Vector3, Matrix4, Color } from "three";

/**
 * @param {{noiseTexture: import("three").Texture, extraUniforms: Map<string, import("three").Uniform>}} param0 
 * @returns {Map<string, import("three").Uniform>}
 */
export function makeCloudsShaderUniforms({ noiseTexture, noiseTexture3d, ditherTexture, extraUniforms = new Map() }) {
    return new Map([
        ['worldCameraPosition', new Uniform(new Vector3())], // TODO: можно забирать напрямую с камеры
        ['viewportSizeInverse', new Uniform(new Vector2(1, 1))],
        ['worldCameraUnprojectionMatrix', new Uniform(new Matrix4())],
        ['timeSeconds', new Uniform(0)],

        ['noiseTexture', new Uniform(noiseTexture)],
        ['noiseTexture3d', new Uniform(noiseTexture3d)],
        ['ditherTexture', new Uniform(ditherTexture)],

        ['ditherDepth', new Uniform(1.0)],
        ['directionDitherDepth', new Uniform(1.0)],
        ['densityThreshold', new Uniform(4.0)],
        ['cloudsHorizontalOffset', new Uniform(new Vector2())],
        ['cloudsScale', new Uniform(120.0)],
        ['cloudsAltitude', new Uniform(-369.0)],
        ['cloudsAltitudeShift', new Uniform(-141)],
        ['cloudsFloorAltitude', new Uniform(120)],
        ['cloudsCeilAltitude', new Uniform(804)],
        ['cloudsFloorSmoothingRange', new Uniform(347.0)],
        ['cloudsCeilSmoothingRange', new Uniform(168.0)],
        ['cloudsTransitionalLayerScale', new Uniform(2.5)],
        ['maxRMDistance', new Uniform(10000.0)],
        ['minRMStep', new Uniform(10.0)],
        ['minRMStepPerDistance', new Uniform(0.0)],
        ['rmStepScale', new Uniform(1.0)],
        ['rmStepScalePerDistance', new Uniform(0.0)],
        ['transparencyThreshold', new Uniform(0.3)],

        ['detailsScale', new Uniform(36.0)],
        ['detailsIntensity', new Uniform(1.39)],
        ['detailsOffset', new Uniform(new Vector2())],

        // TODO: проименовать цвета, чтобы они отражали их значение
        // TODO: вынести цвета отсюда повыше, когда настрою чистовые
        ['colorLowDensity', new Uniform(new Color().setRGB(0.874509804, 0.874509804, 0.796078431))], // #dfdfcb
        ['colorHighDensity', new Uniform(new Color().setRGB(1, 1, 0.870588235))], // #ffffde
        ['colorSun', new Uniform(new Color().setRGB(0.19, 0.16, 0.00))],

        ['alpha1', new Uniform(0.99)],
        ['alpha2', new Uniform(0.95)],

        ['densityColorGradientLength', new Uniform(100.0)],
        ['densityAlphaGradientLength', new Uniform(100.0)],

        ['fogColor', new Uniform(new Color().setRGB(0.5, 0.0, 0.0))],
        ['fogTransparency', new Uniform(0.99)],
        ['fogEnabled', new Uniform(false)],

        ['sunDirection', new Uniform(new Vector3(1, 1, 1).normalize())],
        ['sunCastDistance', new Uniform(20.0)],

        ['depthWriteTransparencyThreshold', new Uniform(0.8)],

        ...extraUniforms.entries(),
    ]);
}
