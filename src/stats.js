const MB = 1024 * 1024; // это сколько байтов в мегабайте :~)
const SEC = 1000;

/**
 * Statistics class.
 *
 * Uses by {@link StatsScreen}.
 *
 * Written for Krono — artlebedev.ru/krono
 *
 * Available info:
 * 1. video card info
 * 2. webgl context info
 * 3. max texture size
 * 4. heap usage and limit
 * 5. fps, average fps
 * 6. cpu cores count (if available)
 */
class Stats {
  videoCardInfo;
  videoCardVendor;
  videoCardRenderer;

  contextName;
  precision;
  maxTextureSize;

  isMemoryInfoAvailable;
  heapUsage;
  heapPercentage;
  heapLimit;

  hardwareConcurrency;

  lastUpdate;

  constructor(demo, renderer) {
    this.demo = demo;
    this.renderer = renderer;

    let context = this.renderer.getContext();

    this.videoCardInfo = this.renderer.extensions.get('WEBGL_debug_renderer_info');
    this.videoCardVendor = context.getParameter(this.videoCardInfo.UNMASKED_VENDOR_WEBGL);
    this.videoCardRenderer = context.getParameter(this.videoCardInfo.UNMASKED_RENDERER_WEBGL);

    this.precision = this.renderer.capabilities.precision;
    this.contextName = this.renderer.getContext().constructor.name;
    this.maxTextureSize = this.renderer.capabilities.maxTextureSize;

    this.isMemoryInfoAvailable = performance.memory !== undefined;

    if (this.isMemoryInfoAvailable) {
      this.heapLimit = performance.memory.jsHeapSizeLimit / MB;
    }

    if (navigator.hardwareConcurrency) {
      this.hardwareConcurrency = navigator.hardwareConcurrency;
    }
  }

  getText() {
    let t = '';

    if (this.isMemoryInfoAvailable) {
      t +=
        `mem: ${ this.heapLimit } MB`
    }

    t += `
${ navigator.platform }`;

    if (navigator.hardwareConcurrency) {
      t += `, ${ navigator.hardwareConcurrency } core`;

      if (navigator.hardwareConcurrency > 1) {
        t += 's';
      }
    }

    if (navigator.deviceMemory) {
      t += `, ${ navigator.deviceMemory } GB of RAM`;
    }

    t += `
${ this.demo.containerBounds.width }×${ this.demo.containerBounds.height }, ${ window.devicePixelRatio }x pixel ratio, ${ screen.colorDepth }-bit color (${ this.videoCardVendor })
${ this.videoCardRenderer }
precision: ${ this.precision }
max texture size: ${ this.maxTextureSize.toLocaleString() }
`;

    return t;
  }
}

export default Stats;
