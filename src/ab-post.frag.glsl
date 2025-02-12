#include <packing>

uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform vec2 viewportSizeInverse;
uniform vec3 worldCameraPosition;
uniform mat4 worldCameraUnprojectionMatrix;
uniform float timeSeconds;

#define DITHERING


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
  float final = p.y + 4.5;
    
  final -= SpiralNoiseC(p.xyz);  // mid-range noise
  final += SpiralNoiseC(p.zxy * 0.123 + 100.0) * 3.0; // large scale terrain features
  final -= SpiralNoise3D(p); // more large scale features, but 3d, so not just a height map.
  final -= SpiralNoise3D(p*49.0)*0.0625*0.125; // small scale noise for variation

  return final;
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
    vec3 pos = worldCameraPosition * 2.0; // I have no fucking idea where this *2 comes from.

    // Current distance from camera in world units
    float dist = 0.0;

    // Max. distance from camera in world units
    float max_dist = 2000.0;
    max_dist = min(max_dist, l);

#ifdef DITHERING
    dist = 1.0 + 0.2 * random(screen_offset + fract(timeSeconds));
    pos += dist * dir;
#endif

    vec3 sundir = normalize( vec3(-1.0,0.75,1.0) );

  
    // background sky     
    float sun = clamp(dot(sundir, dir), 0.0, 1.0);
    vec3 bgcol = vec3(0.6, 0.71, 0.75) - dir.y * 0.2 * vec3(1.0, 0.5, 1.0) + 0.15 * 0.5;
    bgcol += 0.2 * vec3(1.0, 0.6, 0.1) * pow(sun, 8.0);
    
    vec4 sum = vec4(0.0);
    float ld = 0.0, td = 0.0;

    while (dist < max_dist) {
        float d = Clouds(pos) * 0.326;
        d = max(d, -0.4);

        if(td>(1.-1./80.) || d<0.0006*dist || sum.a > 0.99) break;

        if (d < 0.4) {
            // compute local density and weighting factor 
            float ld = 0.1 - d;

            #ifdef IQLIGHT
            ld *= clamp((ld - Clouds(pos+0.3*sundir))/0.6, 0.0, 1.0 );
            const float kmaxdist = 0.6;
            #else
            ld *= 0.15;
            const float kmaxdist = 0.6;
            #endif

            float w = (1. - td) * ld;

            // accumulate density
            td += w;// + 1./90.;

            vec3 lin = vec3(0.65,0.68,0.7)*1.3 + 0.5*vec3(0.7, 0.5, 0.3)*ld;

            #ifdef IQCOLOUR
            vec4 col = vec4( mix( 1.15*vec3(1.0,0.95,0.8), vec3(0.765), d ), max(kmaxdist,d) );
            #else
            vec4 col = vec4(vec3(1./exp( d * 0.2 ) * 1.05), max(kmaxdist,d));
            #endif

            col.xyz *= lin;
            col.xyz = mix( col.xyz, color, 1.0-exp(-0.0004*dist*dist) );
            // front to back blending    
            col.a *= 0.4;
            col.rgb *= col.a;
            sum = sum + col*(1.0-sum.a);
        }

#ifdef DITHERING
        d *= 1.0 + 0.28 * random(screen_offset * dist);
#endif
        d = max(0.04, d);
        dist += d;
        pos += dir * d;
    }

    sum = clamp( sum, 0.0, 1.0 );
    vec3 col = vec3(0.6,0.71,0.75) - dir.y*0.2*vec3(1.0,0.5,1.0) + 0.15*0.5;
    col = col*(1.0-sum.w) + sum.xyz;

    // sun glare    
    // col += 0.1*vec3(1.0,0.4,0.2)*pow( sun, 3.0 );

    gl_FragColor.rgb = col.rgb;
    // gl_FragColor.rgb = mix(cloudColor, color, transparency);
    gl_FragColor.a = 1.0;
}
