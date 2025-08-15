// Clouds shader.
// Based on https://www.shadertoy.com/view/ll2SWd

// If MERGE_COLOR is defined, this shader will read a color value from pre-rendered frame texture and merge it with
// clouds image, resulting in an opaque image.
// Otherwise, the shader will render clouds only, saving accumulated clouds transparency in alpha channel of resulting image.

uniform vec2 viewportSizeInverse;
uniform vec3 worldCameraPosition;
uniform mat4 worldCameraUnprojectionMatrix;
uniform float timeSeconds;

uniform float densityThreshold;
uniform float transparencyThreshold;
uniform float ditherDepth;
uniform float directionDitherDepth;
uniform float cloudsScale;
uniform float maxRMDistance;
uniform float minRMStep;
uniform float minRMStepPerDistance;
uniform float rmStepScale;
uniform float rmStepScalePerDistance;
uniform vec2 cloudsHorizontalOffset;
uniform float cloudsAltitude;
uniform float cloudsAltitudeShift;
uniform float cloudsFloorAltitude;
uniform float cloudsCeilAltitude;
uniform float cloudsFloorSmoothingRange;
uniform float cloudsCeilSmoothingRange;
uniform float cloudsTransitionalLayerScale;
uniform vec3 colorLowDensity;
uniform vec3 colorHighDensity;
uniform vec3 colorSun;

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

uniform sampler2D ditherTexture;

uniform sampler3D noiseTexture3d;

uniform vec3 sunDirection;
uniform float sunCastDistance;

uniform float depthWriteTransparencyThreshold;

// iq's noise
float pn(vec3 x)
{
  vec3 p = floor(x);
  vec3 f = fract(x);
	f = f*f*(3.0-2.0*f);
	vec2 uv = (p.xy+vec2(37.0,17.0)*p.z) + f.xy;
	vec2 rg = textureLod( noiseTexture, (uv+ 0.5)/256.0, 0.0 ).yx;
	return -1.0+2.4*mix( rg.x, rg.y, f.z );
}

float fpn(vec3 p)
{
   return pn(p*.06125)*.5 + pn(p*.125)*.25 + pn(p*.25)*.125;
}

#if 0

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

#else

#define NOISE_TEXTURE_3D_RANGE_MIN -6.0
#define NOISE_TEXTURE_3D_RANGE_MAX 6.0

float readNoiseTexture3d(vec3 p) {
  return mix(NOISE_TEXTURE_3D_RANGE_MIN, NOISE_TEXTURE_3D_RANGE_MAX, texture(noiseTexture3d, p).r);
}

float SpiralNoiseC(vec3 p) {
  return -abs(readNoiseTexture3d(p * 0.03));
}

float SpiralNoise3D(vec3 p) {
  return readNoiseTexture3d(p * 0.02);
}

#endif

// Returns a value correlating with distance towards a surface of a cloud from fiven point in world space.
// Negative value is returned for points inside the cloud, positive for points outside.
// This is similar to Signed Distance Field (SDF), but the value does not (or does it?) represent exact distance to the surface.
float get_cloud_distance(vec3 p) {
  float floorAltitude = cloudsAltitude - cloudsFloorAltitude;
  float ceilingAltitude = cloudsAltitude + cloudsCeilAltitude;
  float edgeSmoothing = 1.0 - smoothstep(floorAltitude, floorAltitude + cloudsFloorSmoothingRange, p.y);
  edgeSmoothing += smoothstep(ceilingAltitude - cloudsCeilSmoothingRange, ceilingAltitude, p.y);

  // Offset clouds field along vertical axis, scale along all axes
  p += vec3(cloudsHorizontalOffset.x, -cloudsAltitude - cloudsAltitudeShift, cloudsHorizontalOffset.y);
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

float logarithmize_depth(float depth) {
  float a = cameraFar / (cameraFar - cameraNear);
  float b = cameraFar * cameraNear / (cameraNear - cameraFar);
  depth = b / (depth - a);
  return log2(depth + 1.0) / log2(cameraFar + 1.0);
}

vec4 read_dither() {
  vec2 uv = gl_FragCoord.xy / 128.0;
#if 0
  uv += fract(sin(timeSeconds * 1231232.4324));
#endif

#if 1
  uv += fract(sin(123432.0 * (worldCameraUnprojectionMatrix[0][0] + worldCameraUnprojectionMatrix[1][1] + worldCameraUnprojectionMatrix[2][2])));
#endif

  return texture2D(ditherTexture, uv);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, in float depth, out vec4 outputColor)
{
    float depthSample = depth;

#ifdef USE_LOGDEPTHBUF
  depthSample = linearize_depth(depthSample);
#endif

    vec4 ditherSample = read_dither();
#define DITHER (ditherSample = ditherSample.wxyz)

    vec2 frag_coord = gl_FragCoord.xy;
    frag_coord += (DITHER.xy - vec2(0.5)) * directionDitherDepth;
    // Screenspace coordinates in range [(0, 0), (1, 1)]
    vec2 screen_offset = frag_coord * viewportSizeInverse;

    // The point in world space this pixel is looking at
    highp vec4 p = worldCameraUnprojectionMatrix * (vec4(screen_offset, depthSample, 1.0) * 2.0 - 1.0);
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

    dist += 1.0 + ditherDepth * DITHER.x;
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

#ifdef WRITE_CLOUDS_DEPTH
    float clouds_start_dist = cameraFar;
#endif

    while (dist < max_dist) {
        float d = get_cloud_distance(pos);

        if (d < densityThreshold) {
          float d_sun = get_cloud_distance(pos + sunDirection * sunCastDistance * (1.0 + ditherDepth * DITHER.x));
          float k_sun = clamp((d_sun - d), 0.0, 1.0);

          float local_transparency = mix(alpha1, alpha2, smoothstep(densityThreshold, densityThreshold - densityAlphaGradientLength, d));
          vec3 local_color = mix(colorLowDensity, colorHighDensity + colorSun * k_sun, smoothstep(densityThreshold, densityThreshold - densityColorGradientLength, d));

          float step_transparency = pow(local_transparency * prev_transparency, (dist - prev_dist) / 10.0);

          ACCUMULATE_COLOR(local_color, step_transparency);

#ifdef WRITE_CLOUDS_DEPTH
          if (transparency < depthWriteTransparencyThreshold) {
            clouds_start_dist = min(dist, clouds_start_dist);
          }
#endif

          if (transparency < transparencyThreshold) {
            break;
          }

          prev_transparency = local_transparency;
        } else {
          prev_transparency = 1.0;
        }

        d *= (rmStepScale + rmStepScalePerDistance * dist);
        d = min(d, max_dist - dist - 0.01);
        d = max(d, minRMStep + minRMStepPerDistance * dist);
        d *= 1.0 + ditherDepth * DITHER.x;
        prev_dist = dist;
        dist += d;
        pos += dir * d;

        if (fogEnabled) {
          float fog_dst = min(dist, max_dist) - prev_dist;
          float fog_step_transparency = pow(fogTransparency, fog_dst / 10.0);
          ACCUMULATE_COLOR(fogColor, fog_step_transparency);
        }
    }

    if (fogEnabled) {
      // Compute fog in the space behind clouds layer
      float remaining_dist = max(0.0, max_dist_geometry - dist);
      ACCUMULATE_COLOR(fogColor, pow(fogTransparency, remaining_dist / 10.0));
    }

    color_acc /= max(1.0 - transparency, 0.0001); // max() to prevent division by zero on non-cloudy pixels
    transparency = max(0.0, (transparency - transparencyThreshold) / (1.0 - transparencyThreshold));

#ifdef MERGE_COLOR
    outputColor.rgb = mix(color_acc, inputColor.rgb, transparency);
    outputColor.a = 1.0;
#else
    outputColor.rgb = color_acc;
    outputColor.a = 1.0 - transparency;
#endif

#ifdef WRITE_CLOUDS_DEPTH
  vec4 x = inverse(worldCameraUnprojectionMatrix)*vec4(worldCameraPosition + dir * clouds_start_dist, 1.0);
  float clouds_depth = 0.5 + 0.5 * (x.z / x.w);
#ifdef USE_LOGDEPTHBUF
  clouds_depth = logarithmize_depth(clouds_depth);
#endif

  gl_FragDepth = clouds_depth;
#endif
}
