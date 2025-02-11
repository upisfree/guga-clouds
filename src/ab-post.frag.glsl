#include <packing>

uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform highp float worldCameraNear;
uniform highp float worldCameraFar;
uniform vec3 worldCameraPosition;
uniform vec2 viewportSizeInverse;
uniform float aspectRatio;
uniform float worldCameraHalfFovSin;
uniform mat3 worldCameraNormalMatrix;
uniform mat4 worldCameraProjectionMatrixInverse;
uniform mat4 worldCameraWorldMatrix;


float getCloudDensity(vec3 pos) {
    return max(0.0, 1.0 / (50.0 - distance(pos, vec3(300.0, 0.0, 0.0))));
}

float perspectiveDepthToViewZ_( const in float invClipZ, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * invClipZ - far );
}


void main() {
    ivec2 texelCoords = ivec2(gl_FragCoord.xy);
    vec3 color = texelFetch(tDiffuse, texelCoords, 0).rgb;
    // float depthTexel = texelFetch(tDepth, texelCoords, 0).r;
    float depthTexel = texture2D(tDepth, gl_FragCoord.xy * viewportSizeInverse).r;
    float viewZ = perspectiveDepthToViewZ_(depthTexel, worldCameraNear, worldCameraFar);

    vec2 screen_offset = gl_FragCoord.xy * viewportSizeInverse - 0.5;

    // vec4 p = worldCameraProjectionMatrixInverse * vec4(screen_offset.x * 2.0, screen_offset.y * 2.0, depthTexel, 1.0);
    // p = inverse(worldCameraWorldMatrix) * p;
    // p = vec4(p.xyz / p.w, 1.0);
    // // p.xyz -= worldCameraPosition;
    // // vec3 p1 = p.xyz / p.w;
    // float l = length(p.xyz);


    float transparency = 1.0;
    vec3 pos = worldCameraPosition;
    screen_offset *= vec2(aspectRatio * worldCameraHalfFovSin, worldCameraHalfFovSin);
    vec3 dir = normalize(vec3(screen_offset, -1));
    dir = worldCameraNormalMatrix * dir;
    float dist = 0.0;
    float max_dist = 500.5; // TODO: Calculate based on depth buffer, cloud bounds, etc
    max_dist = min(max_dist, -viewZ);
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
    // gl_FragColor.rgb = fract(vec3(p) / 10.0);
    // gl_FragColor.rgb = fract(vec3(-viewZ) / 10.0);
    gl_FragColor.a = 1.0;
}
