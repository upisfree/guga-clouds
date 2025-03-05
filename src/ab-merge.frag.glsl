uniform sampler2D sceneTexture;
uniform sampler2D cloudsTexture;
uniform vec2 viewportSizeInverse;

void main() {
    vec4 sceneSample = texelFetch(sceneTexture, ivec2(gl_FragCoord.xy), 0);
    vec4 cloudsSample = texture2D(cloudsTexture, gl_FragCoord.xy * viewportSizeInverse);
    gl_FragColor.rgb = mix(sceneSample.rgb, cloudsSample.rgb, cloudsSample.a);
    gl_FragColor.a = 1.0;
    // https://discourse.threejs.org/t/different-color-output-when-rendering-to-webglrendertarget/57494/2
    gl_FragColor = sRGBTransferOETF(gl_FragColor);
}
