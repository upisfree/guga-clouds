/**
 * Прокси, позволяющий обновлять uniform'ы нескольких шейдеров одновременно.
 * 
 * @param {Map<string, import("three").Uniform>[]} uniformMaps 
 */
export function makeUniformsProxy(uniformMaps) {
    return new Proxy({}, {
        get(_, key) {
            const value = uniformMaps[0].get(key)?.value;

            this.set(null, key, value);

            return value;
        },

        set(_, key, value) {
            let set = false;
            for (const map of uniformMaps) {
                if (map.has(key)) {
                    map.get(key).value = value;
                    set = true;
                }
            }
            return set;
        }
    });
}
