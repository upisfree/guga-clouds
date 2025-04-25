import { Data3DTexture, UnsignedByteType, RedFormat, RepeatWrapping, LinearFilter, FloatType } from 'three';

const nudge = 0.739513;
const normalizer = 1.0 / Math.sqrt(1.0 + nudge * nudge);
const scale = 100.0;

function noise1(x, y, z) {
    x *= scale; y *= scale; z *= scale;

    let n = 0;
    let iter = 1.0;

    for (let i = 0; i < 5; ++i) {
        n += (Math.sin(y * iter) + Math.cos(x * iter)) / iter;

        const x_ = z * nudge * normalizer, z_ = -x * nudge * normalizer;

        x = x_; z = z_;

        iter *= 1.33733;
    }

    return n;
}

export function createNoiseTexture3D({ size, noiseFn = noise1 }) {
    const ab = new Float32Array(size * size * size);

    let i = 0;
    for (let z = 0; z < size; ++z) {
        const zf = z / size;
        for (let y = 0; y < size; ++y) {
            const yf = y / size;
            for (let x = 0; x < size; ++x) {
                const xf = x / size;

                const vf = noiseFn(xf, yf, zf);

                ab[i++] = vf;
            }
        }
    }

    const tx = new Data3DTexture(ab, size, size, size);
    tx.wrapR = tx.wrapS = tx.wrapT = RepeatWrapping;
    tx.format = RedFormat;
    tx.type = FloatType;
    tx.needsUpdate = true;
    tx.magFilter = LinearFilter;
    tx.minFilter = LinearFilter;

    return tx;
}
