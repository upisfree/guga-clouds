uniform sampler2D sceneTexture;
uniform sampler2D cloudsTexture;
uniform vec2 viewportSizeInverse;

void main() {
    vec4 sceneSample = texelFetch(sceneTexture, ivec2(gl_FragCoord.xy), 0);
    vec4 cloudsSample = texture2D(cloudsTexture, gl_FragCoord.xy * viewportSizeInverse);
    gl_FragColor = mix(sceneSample, cloudsSample, cloudsSample.a);
}
