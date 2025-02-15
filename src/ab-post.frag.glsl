#include <packing>

#ifdef SAMPLE_COLOR
uniform sampler2D tDiffuse;
#endif
uniform sampler2D tDepth;
uniform vec2 viewportSizeInverse;
uniform vec3 worldCameraPosition;
uniform mat4 worldCameraUnprojectionMatrix;
uniform float timeSeconds;

uniform float densityThreshold;
uniform float transparencyThreshold;
uniform float ditherDepth;
uniform float cloudsScale;
uniform float maxRMDistance;
uniform float minRMStep;
uniform float rmStepScale;
uniform float cloudsAltitude;
uniform vec3 color1;
uniform vec3 color2;
uniform vec3 color3;
uniform vec3 color4;


// implementation found at: lumina.sourceforge.net/Tutorials/Noise.html
float random(vec2 co) {
  return fract(sin(dot(co * 0.123, vec2(12.9898, 78.233))) * 43758.5453);
}

// otaviogood's noise from https://www.shadertoy.com/view/ld2SzK
//--------------------------------------------------------------
// This spiral noise works by successively adding and rotating sin waves while increasing frequency.
// It should work the same on all computers since it's not based on a hash function like some other noises.
// It can be much faster than other noise functions if you're ok with some repetition.
const float nudge = 0.739513; // size of perpendicular vector
float normalizer = 1.0 / sqrt(1.0 + nudge * nudge); // pythagorean theorem on that perpendicular to maintain scale
float SpiralNoiseC(vec3 p) {
  float n = 0.0;  // noise amount
  float iter = 1.0;
    
  for (int i = 0; i < 8; i++) {
    // add sin and cos scaled inverse with the frequency
    n += -abs(sin(p.y * iter) + cos(p.x * iter)) / iter; // abs for a ridged look

    // rotate by adding perpendicular and scaling down
    p.xy += vec2(p.y, -p.x) * nudge;
    p.xy *= normalizer;
      
    // rotate on other axis
    p.xz += vec2(p.z, -p.x) * nudge;
    p.xz *= normalizer;

    // increase the frequency
    iter *= 1.733733;
  }
  
  return n;
}

float SpiralNoise3D(vec3 p) {
  float n = 0.0;
  float iter = 1.0;
    
  for (int i = 0; i < 5; i++) {
    n += (sin(p.y * iter) + cos(p.x * iter)) / iter;
    
    //p.xy += vec2(p.y, -p.x) * nudge;
    //p.xy *= normalizer;
    p.xz += vec2(p.z, -p.x) * nudge;
    p.xz *= normalizer;
    
    iter *= 1.33733;
  }
  
  return n;
}

float Clouds(vec3 p) {
  p.y -= cloudsAltitude;
  p /= cloudsScale;
  float final = p.y + 4.5;

  final -= SpiralNoiseC(p.xyz);  // mid-range noise
  final += SpiralNoiseC(p.zxy * 0.123 + 100.0) * 3.0; // large scale terrain features
  final -= SpiralNoise3D(p); // more large scale features, but 3d, so not just a height map.
  // final -= SpiralNoise3D(p*49.0 + vec3(timeSeconds))*0.0625*0.125; // small scale noise for variation

  return final * cloudsScale;
}

void main() {
    // Integer screenspace coordinates for texelFetch calls
    ivec2 texelCoords = ivec2(gl_FragCoord.xy);

#ifdef SAMPLE_COLOR
    // Pixel of previously rendered scene
    vec3 color = texelFetch(tDiffuse, texelCoords, 0).rgb;
#else
    vec3 color = vec3(0.0);
#endif

    // Value from depth buffer
    float depthTexel = texelFetch(tDepth, texelCoords * DEPTH_COORD_MULTIPLIER, 0).r;
    //// Alternative if texelFetch won't work everywhere
    //float depthTexel = texture2D(tDepth, gl_FragCoord.xy * viewportSizeInverse).r;

    vec2 frag_coord = gl_FragCoord.xy;
#ifdef DITHERING
    frag_coord += vec2(random(frag_coord.xy * timeSeconds), random(frag_coord.yx * timeSeconds)) - vec2(0.5);
#endif
    // Screenspace coordinates in range [(-1, -1), (1, 1)]
    vec2 screen_offset = frag_coord * viewportSizeInverse * 2.0 - 1.0;

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
    highp vec3 pos = worldCameraPosition * 2.0; // I have no fucking idea where this *2 comes from.

    // Current distance from camera in world units
    float dist = 0.0;

    // Max. distance from camera in world units
    float max_dist = maxRMDistance;
    max_dist = min(max_dist, l);

    dist = 1.0 + ditherDepth * random(screen_offset + fract(timeSeconds));
    pos += dist * dir;

    float prev_transparency = 1.0, prev_dist = 0.0;
    vec3 color_acc = vec3(1.0);

    while (true) {
        float d = Clouds(pos) * 0.326;

        if (d < densityThreshold) {
          vec3 sun_dir = normalize(vec3(1.0));
          float d_sun = Clouds(pos + sun_dir) * 0.326;
          float k_sun = clamp(d_sun - d, 0.0, 1.0);

          // float local_transparency = mix(0.99, 0.95, clamp((d - densityThreshold) * -.2, 0.0, 1.0));
          float local_transparency = 0.995;
          vec3 local_color = mix(color1, color2, clamp((d - densityThreshold) * -.1, 0.0, 1.0));

          // local_color = mix(local_color, color3 * k_sun, 0.5);

          float step_transparency = pow(local_transparency * prev_transparency, (dist - prev_dist) / 10.0);
          color_acc = mix(color_acc, local_color, transparency);
          // color_acc = local_color;
          transparency *= step_transparency;

          if (transparency < transparencyThreshold) {
            break;
          }

          prev_transparency = local_transparency;
        } else {
          prev_transparency = 1.0;
        }

        if (dist > max_dist) {
          break;
        }

        d *= rmStepScale;
        // d = min(d, max_dist - dist - 0.1);
        d = max(d, minRMStep);
        d *= 1.0 + ditherDepth * random(screen_offset * dist);
        dist += d;
        pos += dir * d;
    }

    transparency = max(0.0, (transparency - transparencyThreshold) / (1.0 - transparencyThreshold));

    gl_FragColor.rgb = mix(color_acc, color, transparency);
#ifdef SAMPLE_COLOR
    gl_FragColor.a = 1.0;
#else
    gl_FragColor.a = 1.0 - transparency;
#endif
}
