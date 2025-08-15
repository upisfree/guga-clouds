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

function noise2_x(x, y, z) {
    const n = noise1(x, y, z);
    const nn = noise1(x - 1.0, y, z);
    return (1 - x) * n + x * nn;
}

function noise2_xy(x, y, z) {
    const n = noise2_x(x, y, z);
    const nn = noise2_x(x, y - 1.0, z);
    return (1 - y) * n + y * nn;
}

function noise2_xyz(x, y, z) {
    const n = noise2_xy(x, y, z);
    const nn = noise2_xy(x, y, z - 1.0);
    return (1 - z) * n + z * nn;
}

const rangeMin = -6, rangeMax = 6;

export function createNoiseTexture3D({ size, noiseFn = noise2_xyz }) {
    const ab = new Uint8Array(size * size * size);

    let i = 0;
    for (let z = 0; z < size; ++z) {
        const zf = z / size;
        for (let y = 0; y < size; ++y) {
            const yf = y / size;
            for (let x = 0; x < size; ++x) {
                const xf = x / size;

                const vf = noiseFn(xf, yf, zf);

                const vff = (vf - rangeMin) / (rangeMax - rangeMin);

                ab[i++] = vff * 255.0;
            }
        }
    }

    const tx = new Data3DTexture(ab, size, size, size);
    tx.wrapR = tx.wrapS = tx.wrapT = RepeatWrapping;
    tx.format = RedFormat;
    tx.type = UnsignedByteType;
    tx.needsUpdate = true;
    tx.magFilter = LinearFilter;
    tx.minFilter = LinearFilter;

    return tx;
}
