let lightsEnabled = true;
let numberKeysBound = false;

const fixedOrder = [
    'gameAmbient',
    'gameDirectional',
    'gamePointLights',
    'menuAmbient',
    'menuDirectional'
];

const lightRegistry = new Map();
const lightStates = new Map();

function applyLightStateByKey(key) {
    const light = lightRegistry.get(key);
    if (!light) {
        return;
    }
    const isEnabled = lightStates.get(key) !== false;
    light.visible = lightsEnabled && isEnabled;
}

export function registerLight(key, light) {
    if (!key || !light) {
        return light;
    }

    lightRegistry.set(key, light);
    if (!lightStates.has(key)) {
        lightStates.set(key, true);
    }
    applyLightStateByKey(key);
    return light;
}

export function setLightEnabledByKey(key, enabled) {
    if (!key || !lightRegistry.has(key)) {
        return false;
    }
    lightStates.set(key, Boolean(enabled));
    applyLightStateByKey(key);
    return true;
}

export function toggleLightByKey(key) {
    if (!key || !lightRegistry.has(key)) {
        return false;
    }
    const nextEnabled = !(lightStates.get(key) !== false);
    lightStates.set(key, nextEnabled);
    applyLightStateByKey(key);
    return true;
}

export function setLightsEnabled(enabled) {
    lightsEnabled = Boolean(enabled);
    for (const key of lightRegistry.keys()) {
        applyLightStateByKey(key);
    }
}

export function toggleLights() {
    setLightsEnabled(!lightsEnabled);
    return lightsEnabled;
}

export function getLightsEnabled() {
    return lightsEnabled;
}

export function getLightCount() {
    return lightRegistry.size;
}

export function getLightBindings() {
    return fixedOrder.map((key, index) => ({
        key,
        number: index + 1,
        registered: lightRegistry.has(key)
    }));
}

export function bindLightNumberKeys(target = window) {
    if (numberKeysBound || !target?.addEventListener) {
        return;
    }

    numberKeysBound = true;
    target.addEventListener('keydown', (event) => {
        if (!event?.key) {
            return;
        }
        if (event.key < '1' || event.key > String(fixedOrder.length)) {
            return;
        }

        const index = Number(event.key) - 1;
        const key = fixedOrder[index];
        if (key) {
            toggleLightByKey(key);
        }
    });
}
