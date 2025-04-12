uniform sampler2D cloudsTexture;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec4 cloudsSample = texture2D(cloudsTexture, uv);
    outputColor.rgb = mix(inputColor.rgb, cloudsSample.rgb, cloudsSample.a);
    outputColor.a = 1.0;
}
