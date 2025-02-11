#include <packing>

uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform vec2 viewportSizeInverse;
uniform vec3 worldCameraPosition;
uniform mat4 worldCameraUnprojectionMatrix;


float getCloudDensity(vec3 pos) {
    return max(0.0, 1.0 / (50.0 - distance(pos, vec3(300.0, 0.0, 0.0))));
}

void main() {
    // Integer screenspace coordinates for texelFetch calls
    ivec2 texelCoords = ivec2(gl_FragCoord.xy);

    // Pixel of previously rendered scene
    vec3 color = texelFetch(tDiffuse, texelCoords, 0).rgb;

    // Value from depth buffer
    float depthTexel = texelFetch(tDepth, texelCoords, 0).r;
    //// Alternative if texelFetch won't work everywhere
    //float depthTexel = texture2D(tDepth, gl_FragCoord.xy * viewportSizeInverse).r;

    // Screenspace coordinates in range [(-1, -1), (1, 1)]
    vec2 screen_offset = gl_FragCoord.xy * viewportSizeInverse * 2.0 - 1.0;

    // The point in world space this pixel is looking at
    highp vec4 p = worldCameraUnprojectionMatrix * vec4(screen_offset, depthTexel, 1.0);
    p = vec4(p.xyz / p.w, 1.0);

    // Direction from camera thru this pixel
    highp vec3 dir = p.xyz - worldCameraPosition;

    // Distance from camera to the point thhis pixel represents (all in world space)
    highp float l = length(dir);
    dir /= l;

    // Cloud transparecy/opacity accumulator
    float transparency = 1.0;

    // Current step position in world space
    vec3 pos = worldCameraPosition;

    // Current distance from camera in world units
    float dist = 0.0;

    // Max. distance from camera in world units
    float max_dist = 500.0;
    max_dist = min(max_dist, l);

    // Ray march step size in world units
    float step = 2.0;

    while (dist < max_dist) {
        float density = getCloudDensity(pos);

        if (density > 0.0) {
            transparency *= 0.95;
        }

        dist += step;
        pos += dir * step;
    }

    gl_FragColor.rgb = mix(vec3(0.5), color, transparency);
    gl_FragColor.a = 1.0;
}
