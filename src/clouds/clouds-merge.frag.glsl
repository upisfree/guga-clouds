uniform sampler2D cloudsTexture;
uniform sampler2D cloudsDepthTexture;

uniform vec3 fogColor;
uniform float fogTransparency;
uniform bool fogEnabled;

// Conversion from logarithmic depth to linear depth.
// Based on answer to this question on SO: https://stackoverflow.com/questions/40373184/world-space-position-from-logarithmic-depth-buffer
float linearize_depth(float depth){
  depth = pow(2.0, depth * log2(cameraFar + 1.0)) - 1.0;
  float a = cameraFar / (cameraFar - cameraNear);
  float b = cameraFar * cameraNear / (cameraNear - cameraFar);
  return a + b / depth;
}


void mainImage(const in vec4 inputColor, const in vec2 uv, in float depth, out vec4 outputColor) {
    float depthSample = depth;

#ifdef USE_LOGDEPTHBUF
  depthSample = linearize_depth(depthSample);
#endif

    float dist = -perspectiveDepthToViewZ(depthSample, cameraNear, cameraFar);

    vec3 geometryColor = inputColor.rgb;

    if (fogEnabled) {
        geometryColor = mix(
            fogColor,
            inputColor.rgb,
            pow(fogTransparency, dist / 10.0)
        );
    }

    vec4 cloudsSample = texture2D(cloudsTexture, uv);
    float cloudsDepth = texture2D(cloudsDepthTexture, uv).r;

    float cloudsAlpha = cloudsSample.a;

    if (cloudsDepth > depth) {
        outputColor.rgb = geometryColor;
    } else {
        outputColor.rgb = mix(inputColor.rgb, cloudsSample.rgb, cloudsAlpha);
    }

    outputColor.a = 1.0;
}
