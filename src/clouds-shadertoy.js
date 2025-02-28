import {
  BackSide,
  BoxGeometry,
  Group,
  LinearFilter,
  Mesh, RepeatWrapping,
  ShaderMaterial,
  TextureLoader,
  Vector2,
  Vector3
} from 'three';

// language=GLSL
const vertexShader = `
varying vec2 vUv;

void main () {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vUv = uv;
}
`;

// language=GLSL
const fragmentShader = `
#include <common>

uniform sampler2D iChannel0;
uniform vec3 iResolution;
uniform float iTime;

varying vec2 vUv;

//vec4 texture(sampler2D sampler, vec2 coord){
//  return texture2D(sampler,  coord);
//}

// "Above the clouds" by Duke
//----------------------------
// Clouds lighting technique came from IQ's "Clouds" https://www.shadertoy.com/view/XslGRr shader
// Raymarcher based on Shane's "Fiery Spikeball" https://www.shadertoy.com/view/4lBXzy shader (I think that his implementation is more understandable than the original :) ) 
// Some noises came from otaviogood's "Alien Beacon" https://www.shadertoy.com/view/ld2SzK shader
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0

// Comment this string to see different coloring technique
#define IQCOLOUR
// I am still not sure that this part works right. Commenting this string will improve performance a lot
#define IQLIGHT
// Uncomment this string to be able to find "cloudy caves" :)
//#define MOUSE_CONTROL

#define DITHERING

#define pi 3.14159265
#define R(p, a) p=cos(a)*p+sin(a)*vec2(p.y, -p.x)

// iq's noise
float pn( in vec3 x )
{
    vec3 p = floor(x);
    vec3 f = fract(x);
    f = f*f*(3.0-2.0*f);
    vec2 uv = (p.xy+vec2(37.0,17.0)*p.z) + f.xy;
    vec2 rg = textureLod( iChannel0, (uv+ 0.5)/256.0, 0.0 ).yx;
    return -1.0+2.4*mix( rg.x, rg.y, f.z );
}


float fpn(vec3 p)
{
    return pn(p*.06125)*.5 + pn(p*.125)*.25 + pn(p*.25)*.125;
}

// rand() переименована в random(), т.к. где-то в шейдерах three.js уже есть rand()
float random(vec2 co)
{// implementation found at: lumina.sourceforge.net/Tutorials/Noise.html
    return fract(sin(dot(co*0.123,vec2(12.9898,78.233))) * 43758.5453);
}

// otaviogood's noise from https://www.shadertoy.com/view/ld2SzK
//--------------------------------------------------------------
// This spiral noise works by successively adding and rotating sin waves while increasing frequency.
// It should work the same on all computers since it's not based on a hash function like some other noises.
// It can be much faster than other noise functions if you're ok with some repetition.
const float nudge = 0.739513; // size of perpendicular vector
float normalizer = 1.0 / sqrt(1.0 + nudge*nudge); // pythagorean theorem on that perpendicular to maintain scale
float SpiralNoiseC(vec3 p)
{
    float n = 0.0;  // noise amount
    float iter = 1.0;
    for (int i = 0; i < 8; i++)
    {
        // add sin and cos scaled inverse with the frequency
        n += -abs(sin(p.y*iter) + cos(p.x*iter)) / iter;  // abs for a ridged look
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

float SpiralNoise3D(vec3 p)
{
    float n = 0.0;
    float iter = 1.0;
    for (int i = 0; i < 5; i++)
    {
        n += (sin(p.y*iter) + cos(p.x*iter)) / iter;
        //p.xy += vec2(p.y, -p.x) * nudge;
        //p.xy *= normalizer;
        p.xz += vec2(p.z, -p.x) * nudge;
        p.xz *= normalizer;
        iter *= 1.33733;
    }
    return n;
}

float Clouds(vec3 p)
{
    float final = p.y + 4.5;
    //final -= SpiralNoiseC(p.xyz); // mid-range noise
    final += SpiralNoiseC(p.zxy*0.123+100.0)*3.0; // large scale terrain features
    final -= SpiralNoise3D(p);  // more large scale features, but 3d, so not just a height map.
    //final -= SpiralNoise3D(p*49.0)*0.0625*0.125;  // small scale noise for variation

    return final;
}

float map(vec3 p)
{
//    #ifdef MOUSE_CONTROL
//        R(p.yz, -0.4+iMouse.y*0.003);
//    #else
//        R(p.yz, -25.53);
//    #endif

    R(p.yz, -25.53);
    
    R(p.xz, 0.008*pi+iTime*0.1);
    
    return Clouds(p) +  fpn(p*50.+iTime*5.);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    // ro: ray origin
    // rd: direction of the ray
    vec3 rd = normalize(vec3((gl_FragCoord.xy-0.5*iResolution.xy)/iResolution.y, 1.));
    vec3 ro = vec3(0., 0., -11.);

    // ld, td: local, total density 
    // w: weighting factor
    float ld=0., td=0., w;

    // t: length of the ray
    // d: distance function
    float d=1., t=0.;

    // Distance threshold.
    const float h = .1;

    vec3 sundir = normalize( vec3(-1.0,0.75,1.0) );
    // background sky     
    float sun = clamp( dot(sundir,rd), 0.0, 1.0 );
    vec3 col = vec3(0.6,0.71,0.75) - rd.y*0.2*vec3(1.0,0.5,1.0) + 0.15*0.5;
    col += 0.2*vec3(1.0,.6,0.1)*pow( sun, 8.0 );
    // clouds  
    vec3 bgcol = col;
    vec4 sum = vec4(0.0);

    #ifdef DITHERING
    vec2 pos1 = ( fragCoord.xy / iResolution.xy );
    vec2 seed = pos1 + fract(iTime);
    t=(1.+0.2*random(seed*vec2(1)));
    #endif

    // rm loop
    for (int i=0; i<64; i++) {

        vec3 pos = ro + t*rd;

        // Loop break conditions.
        if(td>(1.-1./80.) || d<0.0006*t || t>120. || pos.y<-5.0 || pos.y>30.0 || sum.a > 0.99) break;

        // evaluate distance function
        d = map(pos)*0.326;

        // fix holes deep inside clouds
        d=max(d,-.4);

        // check whether we are close enough
        if (d<0.4)
        {
            // compute local density and weighting factor 
            ld = 0.1 - d;

            #ifdef IQLIGHT
            ld *= clamp((ld - map(pos+0.3*sundir))/0.6, 0.0, 1.0 );
            const float kmaxdist = 0.6;
            #else
            ld *= 0.15;
            const float kmaxdist = 0.6;
            #endif

            w = (1. - td) * ld;

            // accumulate density
            td += w;// + 1./90.;

            vec3 lin = vec3(0.65,0.68,0.7)*1.3 + 0.5*vec3(0.7, 0.5, 0.3)*ld;

            #ifdef IQCOLOUR
            vec4 col = vec4( mix( 1.15*vec3(1.0,0.95,0.8), vec3(0.765), d ), max(kmaxdist,d) );
            #else
            vec4 col = vec4(vec3(1./exp( d * 0.2 ) * 1.05), max(kmaxdist,d));
            #endif

            col.xyz *= lin;
            col.xyz = mix( col.xyz, bgcol, 1.0-exp(-0.0004*t*t) );
            // front to back blending    
            col.a *= 0.4;
            col.rgb *= col.a;
            sum = sum + col*(1.0-sum.a);

        }

        td += 1./70.;

        // enforce minimum stepsize
        d = max(d, 0.04);

        #ifdef DITHERING
        // add in noise to reduce banding and create fuzz
        d=abs(d)*(1.+0.28*random(seed*vec2(i)));
        #endif

        // step forward
        t += d*.5;

    }

    sum = clamp( sum, 0.0, 1.0 );
    col = vec3(0.6,0.71,0.75) - rd.y*0.2*vec3(1.0,0.5,1.0) + 0.15*0.5;
    col = col*(1.0-sum.w) + sum.xyz;

    // sun glare    
    col += 0.1*vec3(1.0,0.4,0.2)*pow( sun, 3.0 );

    fragColor = vec4(col, 1.0);
}

void main() {
  mainImage(gl_FragColor, gl_FragCoord.xy);
//  mainImage(gl_FragColor, vUv);
}
`;

class CloudsShadertoy extends Group {
  timeScale = 1;

  constructor(camera, pane) {
    super();

    this.pane = pane;

    const textureLoader = new TextureLoader();
    textureLoader.loadAsync('./assets/noise.png').then((noiseTexture) => {
      const cloudsNoise = this.initNoiseTexture(noiseTexture);

      this.uniforms = {
        iTime: { value: 0 },
        iResolution: { value: new Vector3(1000, 1000, 1) },
        iChannel0: { value: cloudsNoise },
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

      this.scale.set(1000, 1000, 1000);
      this.position.set(0, 0, 0);

      this.add(this.clouds);

      this.initFolder();
    });
  }

  update() {
    // текстура еще не загрузилась, нечего обновлять
    if (!this.clouds) {
      return;
    }

    this.uniforms.iTime.value = performance.now() / 1000 * this.timeScale;
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

    return cloudsNoise;
  }

  initFolder() {
    const params = {
      time: 1,
      resolution: { x: 1000, y: 1000 }
    };

    const onChange = () => {
      this.timeScale = params.time;
      this.uniforms.iResolution.value.set(params.resolution.x, params.resolution.y);
    };

    const folder = this.pane.addFolder({
      title: 'clouds shadertoy',
      expanded: true,
    });

    folder.addBinding(params, 'time', {
      min: -100,
      max: 100,
      step: 1,
      title: 'time scale'
    }).on('change', onChange);

    folder.addBinding(params, 'resolution').on('change', onChange);
  }
}

export default CloudsShadertoy;