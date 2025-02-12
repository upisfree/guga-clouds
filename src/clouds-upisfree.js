import {
  BackSide,
  BoxGeometry, Data3DTexture, DataTexture, DoubleSide, GLSL3,
  Group, LinearFilter,
  Mesh, MeshNormalMaterial,
  NearestFilter,
  PlaneGeometry, RawShaderMaterial, RedFormat, RepeatWrapping,
  ShaderMaterial, SRGBColorSpace, TextureLoader,
  Vector2,
  Vector3,
  Vector4
} from 'three';
import { ImprovedNoise } from 'three/addons';

// основано на
// https://www.shadertoy.com/view/ll2SWd

// для копирования мировых координат во время обновления
const _cameraPosition = new Vector3();

// noise related constants
const nudge = 0.739513; // size of perpendicular vector
const normalizer = 1.0 / Math.sqrt(1.0 + nudge * nudge); // pythagorean theorem on that perpendicular to maintain scale

// это неточная функция из-за проблем double.
// например, для 3.02 она вернет 0.019999999999999928,
// но для генерации шума такой точности хватит
// TODO: или нет?))) проверь и удали этот коммент
function fract(a) {
  return a * 10 % 10 / 10;
}

function fractVector3(vector) {
  vector.x = fract(vector.x);
  vector.y = fract(vector.y);
  vector.z = fract(vector.z);

  return vector;
}

function mix(x, y, a) {
  return x * (1 - a) + y * a;
}

// // mrdoob: calculate fragment depth
// vec3 pCorrected = p; pCorrected.y -= 2.0 * SEA_HEIGHT;
// vec4 depth = (projectionMatrix * modelViewMatrix * vec4(pCorrected, 1.0));
// gl_FragDepthEXT = ((depth.z/depth.w) + 1.0)/2.0;

// depth in shader: https://raw.githack.com/Oxynt/cloud/main/index.html

// Что нужно сделать, чтобы зарелизить облака:
// + сделать облака видимыми со стороны домов (скорее всего связано с туманом)
// + научиться двигать туман/фейд
// * сделать размер меша гораздо больше
// * убрать небо в шейдере
// + убрать ровные полоски между облаками (будто порезы)
// * сделать шум похожим на оригинал с мягкостью и пушистостью
// * ускорить рендеринг, перенеся генерацию шума в js и использовать аттрибуты для доступа из шейдера,
//   чтобы не исполнять шум для каждого пикселя каждый кадр
// * что-то поменялось и теперь белое небо просвечивает сквозь стоячие облака, такого не было

// language=GLSL
const vertexShader = `
uniform vec3 cameraPos;

varying vec3 vPosition; // TODO: unused
varying vec2 vUv;

out vec3 vOrigin;
out vec3 vDirection;

void main() { 
  vPosition = position;
  vUv = uv;
    
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  
  vOrigin = vec3(inverse(modelMatrix) * vec4(cameraPos, 1.0)).xyz;
  vDirection = position - vOrigin;
  
  gl_Position = projectionMatrix * mvPosition;
    
  // TODO: считать Z в зависимости от 3д текстуры шума
    // строчка ниже это не то
    //  gl_Position.z = gl_Position.w; // set z to camera.far
}
`;

// language=GLSL
const fragmentShader = `
precision highp sampler3D;

#include <common>

uniform sampler2D iChannel0;
uniform vec3 iResolution;
uniform float iTime;
uniform vec3 cameraPos;
uniform sampler3D noiseMap;

varying vec3 vPosition; // TODO: unused
varying vec2 vUv;

in vec3 vOrigin;
in vec3 vDirection;

// "Above the clouds" by Duke
//----------------------------
// Clouds lighting technique came from IQ's "Clouds" https://www.shadertoy.com/view/XslGRr shader
// Raymarcher based on Shane's "Fiery Spikeball" https://www.shadertoy.com/view/4lBXzy shader (I think that his implementation is more understandable than the original :) ) 
// Some noises came from otaviogood's "Alien Beacon" https://www.shadertoy.com/view/ld2SzK shader
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0

// Comment this string to see different coloring technique
#define IQCOLOUR
// I am still not sure that this part works right. Commenting this string will improve performance a lot
//#define IQLIGHT

#define DITHERING

// iq's noise
// pixel? noise
float pn(vec3 x) {
  vec3 p = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
    
  vec2 uv = (p.xy + vec2(37.0, 17.0) * p.z) + f.xy;
  vec2 rg = textureLod(iChannel0, (uv + 0.5) / 256.0, 0.0).yx;
    
  return -1.0 + 2.4 * mix(rg.x, rg.y, f.z);
}

float fpn(vec3 p) {
  return pn(p * 0.06125) * 0.5 + pn(p * 0.125) * 0.25 + pn(p * 0.25) * 0.125;
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

float Clouds(vec3 p) { 
  float final = p.y + 4.5;
    
  final -= SpiralNoiseC(p.xyz);  // mid-range noise
  final += SpiralNoiseC(p.zxy * 0.123 + 100.0) * 3.0; // large scale terrain features
  final -= SpiralNoise3D(p); // more large scale features, but 3d, so not just a height map.
  final -= SpiralNoise3D(p*49.0)*0.0625*0.125; // small scale noise for variation

  return final;
}

float map(vec3 p) {
//  return texture(iChannel0, p).r;
  return Clouds(p);
//  return Clouds(p) + fpn(p * 50.0 + iTime * 5.0);
}

vec2 hitBox(vec3 orig, vec3 dir) { 
  const vec3 box_min = vec3(-0.5);
  const vec3 box_max = vec3(0.5);
    
  vec3 inv_dir = 1.0 / dir;
  
  vec3 tmin_tmp = (box_min - orig) * inv_dir;
  vec3 tmax_tmp = (box_max - orig) * inv_dir;
    
  vec3 tmin = min(tmin_tmp, tmax_tmp);
  vec3 tmax = max(tmin_tmp, tmax_tmp);
  
  float t0 = max(tmin.x, max(tmin.y, tmin.z));
  float t1 = min(tmax.x, min(tmax.y, tmax.z));
  
  return vec2(t0, t1);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  // rd: direction of the ray
  vec3 rd = normalize(vDirection);
  vec2 bounds = hitBox(vOrigin, rd);

//  if ( bounds.x > bounds.y ) discard;
//  bounds.x = max( bounds.x, 0.0 );

  // ro: ray origin
  vec3 ro = vOrigin + cameraPos;
    
  // ld, td: local, total density 
  // w: weighting factor
  float ld = 0.0;
  float td = 0.0;
  float w;

  // d: distance function
  // t: length of the ray
  float d = 1.0;
  float t = 0.0;

  // Distance threshold.
  const float h = 0.1;
    
  vec3 sundir = normalize(vec3(-1.0, 0.75, 1.0));
  
  // background sky     
  float sun = clamp(dot(sundir, rd), 0.0, 1.0);
  vec3 col = vec3(0.6, 0.71, 0.75) - rd.y * 0.2 * vec3(1.0, 0.5, 1.0) + 0.15 * 0.5;
  col += 0.2 * vec3(1.0, 0.6, 0.1) * pow(sun, 8.0);

  // clouds  
  vec3 bgcol = col;
  vec4 sum = vec4(0.0);

  #ifdef DITHERING
    vec2 pos1 = (fragCoord.xy / iResolution.xy);
    vec2 seed = pos1 + fract(iTime);
    t = (1.0 + 0.2 * random(seed * vec2(1)));
  #endif

//  if (bounds.x > bounds.y) {
//    discard;
//  }

  bounds.x = max(bounds.x, 0.0);

  // uniform
  float steps = 200.0;
    
  vec3 p = vOrigin + bounds.x * rd;
  vec3 inc = 1.0 / abs(rd);
  float delta = min(inc.x, min(inc.y, inc.z));
  delta /= steps;
    
  // rm loop
//  for (int i = 0; i < 64; i++) {
  for (float i = bounds.x; i < bounds.y; i += delta) {
    vec3 pos = ro + t * rd;

    // Loop break conditions.
//    if (td > (1.-1. / 80.) || d < 0.0006*t || t > 120. || pos.y < -5.0 || pos.y > 30.0 || sum.a > 0.99) {
//      break;  
//    }

//    if (td > (1.-1. / 80.) || d < 0.0006*t || t > 120. || pos.y < -5.0 || pos.y > 30.0 || sum.a > 0.99) {
//      break;  
//    }

//    if (td > (1.0 - 1.0 / 80.0) || d < 0.0006 * t || sum.a > 0.99) {
//      break;
//    }

    // evaluate distance function
//      d = map(pos) * 0.326;
    d = map(pos + 0.5) * 0.326; // + 0.5;

    // fix holes deep inside clouds
//    d = max(d, -0.4);

    // check whether we are close enough
    if (d < 0.4) {
      // compute local density and weighting factor 
      ld = 0.1 - d;

      #ifdef IQLIGHT
        ld *= clamp((ld - map(pos + 0.3 * sundir)) / 0.6, 0.0, 1.0);
        const float kmaxdist = 0.6;
      #else
        ld *= 0.15;
        const float kmaxdist = 0.6;
      #endif
        
      w = (1.0 - td) * ld;   
   
      // accumulate density
      td += w; // + 1./90.;
            
      vec3 lin = vec3(0.65, 0.68, 0.7) * 1.3 + 0.5 * vec3(0.7, 0.5, 0.3) * ld;
    
      #ifdef IQCOLOUR
        vec4 col = vec4(mix(1.15*vec3(1.0, 0.95, 0.8), vec3(0.765), d), max(kmaxdist, d));
      #else
        vec4 col = vec4(vec3(1.0 / exp(d * 0.2) * 1.05), max(kmaxdist, d));
      #endif
                            
      col.xyz *= lin;
        
      // фейд
       col.xyz = mix(col.xyz, bgcol, 1.0 - exp(-0.0004 * t * t));
        
                    // TODO: front to back blending и DITHERING важен для картинки!
        
      // эффект пропадания от дальности камеры
      // front to back blending
      col.a *= 0.4;
      col.rgb *= col.a;
        
      sum = sum + col * (1.0 - sum.a);
    }

    td += 1.0 / 70.0;

    // enforce minimum stepsize
    d = max(d, 0.04);
    
    #ifdef DITHERING
      // add in noise to reduce banding and create fuzz
      d = abs(d) * (1. + 0.28 * random(seed * vec2(i)));
    #endif
                  
    // step forward
    t += d * 0.5;
  }
 
  sum = clamp(sum, 0.0, 1.0);
  // первый вектор — это цвет
  col = vec3(0.6, 0.71, 0.75) - rd.y * 0.2 * vec3(1.0, 0.5, 1.0) + 0.15 * 0.5;
  col = col * (1.0 - sum.w) + sum.xyz;

  // sun glare
  col += 0.1 * vec3(1.0, 0.4, 0.2) * pow(sun, 3.0);

  fragColor = vec4(col, 1.0);
}
 
void main() {
  mainImage(gl_FragColor, gl_FragCoord.xy);
//  mainImage(gl_FragColor, vUv);
}
`;

class CloudsUpisfree extends Group {
  constructor(camera, pane) {
    super();

    this.camera = camera;
    this.pane = pane;

    const textureLoader = new TextureLoader();
    textureLoader.loadAsync('./assets/noise.png').then((noiseTexture) => {
      const cloudsNoise = this.initNoiseTexture(noiseTexture);
      const noiseMap = this.generateNoiseMap();

      this.uniforms = {
        // time: { value: 1.0 },
        // resolution: { value: new Vector2() }
        cameraPos: { value: new Vector3() },
        iTime: { value: 0 },
        // iResolution: { value: new Vector3(128, 128, 1) },
        iResolution: { value: new Vector3(800, 450, 1) },
        iChannel0: { value: cloudsNoise },
        noiseMap: { value: noiseMap }
      };

      this.material = new ShaderMaterial({
        name: 'CloudsShader',
        uniforms: this.uniforms,
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        // side: DoubleSide // мне кажется, что дважды рендеринг происходит потому что когда я внутри блока, то фпс умирает
        side: BackSide
      });

      this.geometry = new BoxGeometry(1, 1, 1);

      this.clouds = new Mesh(
        this.geometry,
        this.material
      );

      this.scale.setScalar(1000);
      this.position.set(0, 0, 0);

      this.add(this.clouds);

      this.initFolder();
    });
  }

  initFolder() {
    const params = {
      time: 0,
      resolution: { x: 800, y: 450 }
    };

    const onChange = () => {
      this.material.uniforms.iTime.value = params.time;
      this.material.uniforms.iResolution.value.set(params.resolution.x, params.resolution.y);
    };

    const folder = this.pane.addFolder({
      title: 'clouds upisfree',
      expanded: false,
    });

    folder.addBinding(params, 'time', {
      min: 0,
      max: 10000,
      step: 1
    }).on('change', onChange);

    folder.addBinding(params, 'resolution').on('change', onChange);
  }

  update() {
    // текстура еще не загрузилась, нечего обновлять
    if (!this.clouds) {
      return;
    }

    const { camera } = this;
    // const startTime = clock.getElapsedTime();
    const startTime = 1;

    camera.getWorldPosition(_cameraPosition);
    // this.worldToLocal(_cameraPosition);
    this.uniforms.cameraPos.value.copy(_cameraPosition);

    this.uniforms.iTime.value = startTime;
  }

  initNoiseTexture(texture) {
    const cloudsNoise = texture;

    // очень важно, иначе появляются полосы на шуме
    cloudsNoise.minFilter = LinearFilter; // NearestFilter прикольно поломанный, но не более
    cloudsNoise.magFilter = LinearFilter; // NearestFilter
    cloudsNoise.wrapS = RepeatWrapping;
    cloudsNoise.wrapT = RepeatWrapping;
    cloudsNoise.flipY = false;
    cloudsNoise.generateMipmaps = false;

    const image = cloudsNoise.image;
    const width = image.naturalWidth;
    const height = image.naturalHeight;

    // получаем буфер текстур через канвас, т.к. renderer.copyTextureToTexture(cloudsNoise, dataTexture)
    // почему-то не работает вообще никак совсем, что бы я не попробовал
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = false;
    context.drawImage(image, 0, 0, width, height);
    const imageData = context.getImageData(0, 0, width, height);

    // console.log(imageData);

    // cloudsNoise.center.set(0.5, 0.5)
    // cloudsNoise.anisotropy = renderer.capabilities.getMaxAnisotropy();
    // cloudsNoise.needsUpdate = true;

    const dataTexture = new DataTexture(imageData, width, height);
    dataTexture.minFilter = LinearFilter // NearestFilter прикольно поломанный, но не более
    dataTexture.magFilter = LinearFilter // NearestFilter
    dataTexture.wrapS = RepeatWrapping
    dataTexture.wrapT = RepeatWrapping
    dataTexture.flipY = false;
    dataTexture.generateMipmaps = false;
    dataTexture.needsUpdate = true;

    return dataTexture;
  }

  generateNoiseMap() {
    const size = 2;
    const data = new Uint8Array( size * size * size );

    let i = 0;
    const scale = 0.05;
    const position = new Vector3();

    for (let z = 0; z < size; z++) {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          // const d = 1.0 - vector.set( x, y, z ).subScalar( size / 2 ).divideScalar( size ).length();
          // data[i] = ( 128 + 128 * perlin.noise( x * scale / 1.5, y * scale, z * scale / 1.5 ) ) * d * d;
          // i++;

          position.set( x, y, z ).divideScalar( size );

          const d = this.map(position);

          data[i++] = d * 128 + 128;
        }
      }
    }

    // console.log(data);

    const texture = new Data3DTexture(data, size, size, size);
    texture.format = RedFormat;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.unpackAlignment = 1;
    texture.needsUpdate = true;

    return texture;
  }

  /**
   * @param {Vector3} position
   * @return {number}
   */
  map(position) {
    const p = position.clone();

    const time = 1;
    // const fpnPosition = p.clone().multiplyScalar(50).add(time * 5);

    // return this.cloudsNoise(p) + this.fpn(fpnPosition);
    return this.cloudsNoise(p);
  }

  /**
   * @param {Vector3} position
   * @return {number}
   */
  cloudsNoise(position) {
    // далее везде я копирую аргументы внутри функции, потому что в glsl для аргумента по-умолчанию
    // используется ключевое слово in, которое копирует значение и мы не должны менять его in-place
    const p = position.clone();

    let final = p.y + 4.5;

//  final -= SpiralNoiseC(p.xyz);  // mid-range noise
    // TODO: надо
//     final += SpiralNoiseC(p.zxy * 0.123 + 100.0) * 3.0; // large scale terrain features
    final -= this.spiralNoise3D(p); // more large scale features, but 3d, so not just a height map.
//  final -= SpiralNoise3D(p*49.0)*0.0625*0.125; // small scale noise for variation

    return final;
  }

  // otaviogood's noise from https://www.shadertoy.com/view/ld2SzK
  //--------------------------------------------------------------
  // This spiral noise works by successively adding and rotating sin waves while increasing frequency.
  // It should work the same on all computers since it's not based on a hash function like some other noises.
  // It can be much faster than other noise functions if you're ok with some repetition.
  /**
   * @param {Vector3} position
   * @return {number}
   * */
  spiralNoise3D(position) {
    const p = position.clone();

    let n = 0.0;
    let iter = 1.0;

    for (let i = 0; i < 5; i++) {
      n += (Math.sin(p.y * iter) + Math.cos(p.x * iter)) / iter;

      // было закомменчено в оригинальном шейдере
      //p.xy += vec2(p.y, -p.x) * nudge;
      //p.xy *= normalizer;

      // p.xz += vec2(p.z, -p.x) * nudge;
      const nudged = new Vector2(p.z, -p.x).multiplyScalar(nudge);
      p.x += nudged.x;
      p.z += nudged.y;

      // p.xz *= normalizer;
      p.x *= normalizer;
      p.z *= normalizer;

      iter *= 1.33733;
    }

    return n;
  }

  /**
   * @param {Vector3} position
   * @return {number}
   * */
  spiralNoiseС(position) {
    const p = position.clone();

    let n = 0.0;
    let iter = 1.0;

    for (let i = 0; i < 8; i++) {
      // add sin and cos scaled inverse with the frequency
      n += -Math.abs(Math.sin(p.y * iter) + Math.cos(p.x * iter)) / iter; // abs for a ridged look

      // rotate by adding perpendicular and scaling down
      // p.xy += vec2(p.y, -p.x) * nudge;
      const nudgedY = new Vector2(p.y, -p.x).multiplyScalar(nudge);
      p.x += nudgedY.x;
      p.y += nudgedY.y;

      // p.xy *= normalizer;
      p.x *= normalizer;
      p.y *= normalizer;

      // rotate on other axis
      // p.xz += vec2(p.z, -p.x) * nudge;
      const nudgedZ = new Vector2(p.z, -p.x).multiplyScalar(nudge);
      p.x += nudgedZ.x;
      p.z += nudgedZ.y;

      // p.xz *= normalizer;
      p.x *= normalizer;
      p.z *= normalizer;

      // increase the frequency
      iter *= 1.733733;
    }

    return n;
  }

  /**
   * @param {Vector2} coefficient?
   * @return {number}
   * */
  random(coefficient) {
    // implementation found at: http://lumina.sourceforge.net/Tutorials/Noise.html
    // float random(vec2 co) {
    //   return fract(sin(dot(co * 0.123, vec2(12.9898, 78.233))) * 43758.5453);
    // }

    const co = coefficient.clone();

    const x = co.multiplyScalar(0.123);
    const y = new Vector2(12.9898, 78.233);
    const dot = x.dot(y);
    const result = Math.sin(dot) * 43758.5453;

    return fract(result);
  }

  /**
   * @param {Vector3} position
   * @return {number}
   * */
  fpn(position) {
    // float fpn(vec3 p) {
    //   return pn(p * 0.06125) * 0.5 + pn(p * 0.125) * 0.25 + pn(p * 0.25) * 0.125;
    // }

    const p = position.clone();
    const p1 = p.clone().multiplyScalar(0.06125);
    const p2 = p.clone().multiplyScalar(0.125);
    const p3 = p.clone().multiplyScalar(0.25);

    return
    this.pn(p1) * 0.5 +
    this.pn(p2) * 0.25 +
    this.pn(p3) * 0.125;
  }

  /**
   * iq's noise
   * pixel noise?
   * @param {Vector3} position
   * @return {number}
   * */
  pn(position) {
    const x = position.clone();

    const p = x.clone().floor();
    const f = fractVector3(x.clone());
    // f = f * f * (3.0 - 2.0 * f);
    f.set(
      f.x * f.x * (3.0 - 2.0 * f.x),
      f.y * f.y * (3.0 - 2.0 * f.y),
      f.z * f.z * (3.0 - 2.0 * f.z)
    );

    const uv = new Vector2(
      (p.x + 37.0 * p.z) + f.x,
      (p.y + 17.0 * p.z) + f.y
    );

    // 256 — noise texture size
    const normalizedUv = new Vector2(
      (uv.x + 0.5) / 256.0,
      (uv.y + 0.5) / 256.0
    );

    // TODO: texture lookup
    // vec2 rg = textureLod(iChannel0, (uv + 0.5) / 256.0, 0.0).yx;
    const rg = new Vector2(0, 0);

    return -1.0 + 2.4 * mix(rg.x, rg.y, f.z);
    // сделать DataTexture, передать ее сюда
    // не забыть поменять .yx!!!
    // сделать реализацию mix()
    // обновить триху до последней версии
  }

  // let color = getPixelFromTextureBuffer(
  //   Math.round((1 - uv.x) * textureBuffer.width),
  //   Math.round((1 - uv.y) * textureBuffer.height)
  // );
  //
  // function getPixelFromTextureBuffer(x, y) {
  //   let i = ((y * (textureBuffer.width * 4)) + (x * 4));
  //
  //   return {
  //     r: textureBuffer.data[i],
  //     g: textureBuffer.data[i + 1],
  //     b: textureBuffer.data[i + 2],
  //     a: textureBuffer.data[i + 3]
  //   };
  // }
}

export default CloudsUpisfree;