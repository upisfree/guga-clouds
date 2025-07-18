uniform sampler2D cloudsTexture;
uniform sampler2D cloudsDepthTexture;

void mainImage(const in vec4 inputColor, const in vec2 uv, in float depth, out vec4 outputColor) {
    vec4 cloudsSample = texture2D(cloudsTexture, uv);
    float cloudsDepth = texture2D(cloudsDepthTexture, uv).r;

    float cloudsAlpha = cloudsSample.a;

    if (cloudsDepth > depth) {
        cloudsAlpha = 0.0;
    }

    outputColor.rgb = mix(inputColor.rgb, cloudsSample.rgb, cloudsAlpha);
    outputColor.a = 1.0;
}
