// Clouds shader.
// Based on https://www.shadertoy.com/view/ll2SWd

// If MERGE_COLOR is defined, this shader will read a color value from pre-rendered frame texture and merge it with
// clouds image, resulting in an opaque image.
// Otherwise, the shader will render clouds only, saving accumulated clouds transparency in alpha channel of resulting image.
#ifdef MERGE_COLOR
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
uniform float cloudsAltitudeShift;
uniform float cloudsFloorAltitude;
uniform float cloudsCeilAltitude;
uniform float cloudsFloorSmoothingRange;
uniform float cloudsCeilSmoothingRange;
uniform float cloudsTransitionalLayerScale;
uniform vec3 color1;
uniform vec3 color2;
uniform vec3 color3;
uniform vec3 color4;

uniform float alpha1;
uniform float alpha2;

uniform float densityColorGradientLength;
uniform float densityAlphaGradientLength;

uniform float detailsScale;
uniform float detailsIntensity;
uniform vec3 detailsOffset;

uniform vec3 fogColor;
uniform float fogTransparency;
uniform bool fogEnabled;

uniform sampler2D noiseTexture;

uniform float cameraNear;
uniform float cameraFar;

uniform vec3 sunDirection;
uniform float sunCastDistance;

// iq's noise
float pn(vec3 x)
{
  vec3 p = floor(x);
  p = mix(p, ceil(x), pow(smoothstep(p, ceil(x), x), vec3(4.0)));
  vec3 f = abs(2.0 * fract(x) - 1.0);
	f = f*f*(3.0-2.0*f);
	vec2 uv = (p.xz+vec2(37.0,17.0)*p.y) + f.xz;
	vec2 rg = textureLod( noiseTexture, (uv+ 0.5)/256.0, 0.0 ).yx;
	return -1.0+2.4*mix( rg.x, rg.y, f.y );
}

float fpn(vec3 p) 
{
   return pn(p*.06125)*.5 + pn(p*.125)*.25 + pn(p*.25)*.125;
}

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

// Returns a value correlating with distance towards a surface of a cloud from fiven point in world space.
// Negative value is returned for points inside the cloud, positive for points outside.
// This is similar to Signed Distance Field (SDF), but the value does not (or does it?) represent exact distance to the surface.
float get_cloud_distance(vec3 p) {
  float floorAltitude = cloudsAltitude - cloudsFloorAltitude;
  float ceilingAltitude = cloudsAltitude + cloudsCeilAltitude;
  float edgeSmoothing = 1.0 - smoothstep(floorAltitude, floorAltitude + cloudsFloorSmoothingRange, p.y);
  edgeSmoothing += smoothstep(ceilingAltitude - cloudsCeilSmoothingRange, ceilingAltitude, p.y);

  // Offset clouds field along vertical axis, scale along all axes
  p.y -= cloudsAltitude + cloudsAltitudeShift;
  p /= cloudsScale;

  // Change clouds density depending on altitude
  float final = p.y * cloudsTransitionalLayerScale + edgeSmoothing;

  final -= SpiralNoiseC(p.xyz);  // mid-range noise
  final += SpiralNoiseC(p.zxy * 0.123 + 100.0) * 3.0; // large scale terrain features
  final -= SpiralNoise3D(p); // more large scale features, but 3d, so not just a height map.
  // final -= SpiralNoise3D(p*49.0 + vec3(timeSeconds))*0.0625*0.125; // small scale noise for variation

  // Add texture-based noise
  final += detailsIntensity * fpn(p * detailsScale + detailsOffset);

  // scale result back, so it's closer to distance to cloud surface, 0.326 - magic number from the original shader.
  return final * cloudsScale * 0.326;
}

// Conversion from logarithmic depth to linear depth.
// Based on answer to this question on SO: https://stackoverflow.com/questions/40373184/world-space-position-from-logarithmic-depth-buffer
float linearize_depth(float depth){
  depth = pow(2.0, depth * log2(cameraFar + 1.0)) - 1.0;
  float a = cameraFar / (cameraFar - cameraNear);
  float b = cameraFar * cameraNear / (cameraNear - cameraFar);
  return a + b / depth;
}

void main() {
    // Integer screenspace coordinates for texelFetch calls
    ivec2 texelCoords = ivec2(gl_FragCoord.xy);

#ifdef MERGE_COLOR
    // Pixel of previously rendered scene
    vec3 color = texelFetch(tDiffuse, texelCoords, 0).rgb;
#else
    vec3 color = vec3(0.0);
#endif

    // Value from depth buffer
    float depthTexel = texelFetch(tDepth, texelCoords * DEPTH_COORD_MULTIPLIER, 0).r;
    //// Alternative if texelFetch won't work everywhere
    //float depthTexel = texture2D(tDepth, gl_FragCoord.xy * viewportSizeInverse).r;

#ifdef USE_LOGDEPTHBUF
  depthTexel = linearize_depth(depthTexel);
#endif

    vec2 frag_coord = gl_FragCoord.xy;
    frag_coord += vec2(random(frag_coord.xy * timeSeconds), random(frag_coord.yx * timeSeconds)) - vec2(0.5);
    // Screenspace coordinates in range [(-1, -1), (1, 1)]
    vec2 screen_offset = frag_coord * viewportSizeInverse;

    // The point in world space this pixel is looking at
    highp vec4 p = worldCameraUnprojectionMatrix * (vec4(screen_offset, depthTexel, 1.0) * 2.0 - 1.0);
    p = vec4(p.xyz / p.w, 1.0);

    // Direction from camera thru this pixel
    highp vec3 dir = p.xyz - worldCameraPosition;

    // Distance from camera to the point this pixel represents (all in world space)
    highp float max_dist_geometry = length(dir);
    dir /= max_dist_geometry;

    // Current step position in world space
    highp vec3 pos = worldCameraPosition;

    // Current distance from camera in world units
    float dist = 0.0;

    // Max. distance from camera in world units
    float max_dist = maxRMDistance;
    max_dist = min(max_dist, max_dist_geometry);

    if (abs(dir.y) > 0.0) {
      vec2 limit_distances = (vec2(cloudsAltitude - pos.y) + vec2(-cloudsFloorAltitude, cloudsCeilAltitude)) / dir.y;
      // Max. distance from camera in world units, as defined by cloud layer's limiting planes
      float max_dist_limit = max(limit_distances.x, limit_distances.y);
      max_dist = min(max_dist, max_dist_limit);
      dist = max(0.0, min(limit_distances.x, limit_distances.y));
    }

    dist += 1.0 + ditherDepth * random(screen_offset + fract(timeSeconds));
    pos += dist * dir;

    // Cloud transparency accumulator, transparency of previous step, distance at start of previous step
    float transparency = 1.0, prev_transparency = 1.0, prev_dist = dist;
    vec3 color_acc = vec3(0.0);

#define ACCUMULATE_COLOR(_color, _local_transparency) \
    { vec3 color = _color; float local_transparency = _local_transparency; \
      color_acc += color * (transparency - transparency * local_transparency); \
      transparency *= local_transparency; }

    if (fogEnabled) {
      // Compute fog in space before clouds layer
      ACCUMULATE_COLOR(fogColor, pow(fogTransparency, dist / 10.0));
    }

    while (dist < max_dist) {
        float d = get_cloud_distance(pos);

        if (d < densityThreshold) {
          float d_sun = get_cloud_distance(pos + sunDirection * sunCastDistance * (1.0 + ditherDepth * random(d * screen_offset.yx + fract(timeSeconds))));
          float k_sun = clamp((d_sun - d), 0.0, 1.0);

          float local_transparency = mix(alpha1, alpha2, smoothstep(densityThreshold, densityThreshold - densityAlphaGradientLength, d));
          vec3 local_color = mix(color1, color2 + color3 * k_sun, smoothstep(densityThreshold, densityThreshold - densityColorGradientLength, d));

          float step_transparency = pow(local_transparency * prev_transparency, (dist - prev_dist) / 10.0);

          ACCUMULATE_COLOR(local_color, step_transparency);

          if (transparency < transparencyThreshold) {
            break;
          }

          prev_transparency = local_transparency;
        } else {
          prev_transparency = 1.0;
        }

        if (fogEnabled) {
          float fog_dst = min(dist, max_dist) - prev_dist;
          float fog_step_transparency = pow(fogTransparency, fog_dst / 10.0);
          ACCUMULATE_COLOR(fogColor, fog_step_transparency);
        }

        d *= rmStepScale;
        d = min(d, max_dist - dist - 0.01);
        d = max(d, minRMStep);
        d *= 1.0 + ditherDepth * random(screen_offset * dist);
        prev_dist = dist;
        dist += d;
        pos += dir * d;
    }

    if (fogEnabled) {
      // Compute fog in the space behind clouds layer
      float remaining_dist = max(0.0, max_dist_geometry - dist);
      ACCUMULATE_COLOR(fogColor, pow(fogTransparency, remaining_dist / 10.0));
    }

    color_acc /= max(1.0 - transparency, 0.0001); // max() to prevent division by zero on non-cloudy pixels
    transparency = max(0.0, (transparency - transparencyThreshold) / (1.0 - transparencyThreshold));

#ifdef MERGE_COLOR
    gl_FragColor.rgb = mix(color_acc, color, transparency);
    gl_FragColor.a = 1.0;
    // https://discourse.threejs.org/t/different-color-output-when-rendering-to-webglrendertarget/57494/2
    gl_FragColor = sRGBTransferOETF(gl_FragColor);
#else
    gl_FragColor.rgb = color_acc;
    gl_FragColor.a = 1.0 - transparency;
#endif
}
