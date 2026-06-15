import * as THREE from "https://esm.sh/three@0.136.0";
import { OrbitControls } from "https://esm.sh/three@0.136.0/examples/jsm/controls/OrbitControls.js";

const isMobile = window.innerWidth < 768;
const PARTICLE_COUNT = isMobile ? 30000 : 100000;
const CENTER_COUNT = Math.floor(PARTICLE_COUNT * 0.5);
const MODE = {
    GALAXY: 0,
    FIST: 1,
    IMAGES: 2
};

let currentMode = MODE.GALAXY;
let lerpFactor = 0;
let targetLerp = 0;
let autoRotationAngle = 0;

const imagePaths = [];
for (let i = 1; i <= 58; i++) {
    imagePaths.push(`style/img/foto1 (${i}).jpeg`);
}


let scene = new THREE.Scene();
scene.background = new THREE.Color('#120010');
let camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000);
camera.position.set(0, 3, isMobile ? 40 : 30);

let renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (gu && gu.uTargetSize) {
        gu.uTargetSize.value = Math.min(window.innerWidth, window.innerHeight) * 0.95;
    }
});

let controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.1;

let pts = [];
let sizes = [];
let shift = [];
let targetPositions = [];
let colors = [];
let particleData = [];

function initGalaxy() {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        let p;
        if (i < CENTER_COUNT) {
            p = new THREE.Vector3().randomDirection().multiplyScalar(Math.random() * 0.5 + 9.5);
        } else {
            let r = 5, R = 25;
            let rand = Math.pow(Math.random(), 1.5);
            let radius = Math.sqrt(R * R * rand + (1 - rand) * r * r);
            p = new THREE.Vector3().setFromCylindricalCoords(radius, Math.random() * 2 * Math.PI, (Math.random() - 0.5) * 2);
        }
        pts.push(p);
        particleData.push(p.clone());
        targetPositions.push(p.x, p.y, p.z);
        sizes.push(Math.random() * 1.5 + 0.5);
        shift.push(
            Math.random() * Math.PI,
            Math.random() * Math.PI * 2,
            (Math.random() * 0.9 + 0.1) * Math.PI * 0.1,
            Math.random() * 0.9 + 0.1
        );
    }
}
initGalaxy();

const atlasSize = 2048;
const ATLAS_COLS = 8;          // 8 columns x 8 rows = 64 slots
const TILE_SIZE = atlasSize / ATLAS_COLS; // 256px per tile
const atlasCanvas = document.createElement('canvas');
let loadedCount = 0;
atlasCanvas.width = atlasSize;
atlasCanvas.height = atlasSize; // 2048x2048, fully square
const ctx = atlasCanvas.getContext('2d');
const imgSize = TILE_SIZE;

const textureIndices = new Float32Array(PARTICLE_COUNT);
const randomVals = new Float32Array(PARTICLE_COUNT);
const isCenter = new Float32Array(PARTICLE_COUNT);
const pIndices = new Float32Array(PARTICLE_COUNT);
const aspects = new Float32Array(PARTICLE_COUNT).fill(1.0);
const customRotations = new Float32Array(PARTICLE_COUNT);
const rotationSpeeds = new Float32Array(PARTICLE_COUNT);
const isGalaxyImage = new Float32Array(PARTICLE_COUNT);
const isStar = new Float32Array(PARTICLE_COUNT);
const imageParticleIndices = [];

for (let i = 0; i < PARTICLE_COUNT; i++) {
    textureIndices[i] = Math.floor(Math.random() * 64); // 64 slots in 8x8 atlas
    randomVals[i] = Math.random();
    isCenter[i] = i < CENTER_COUNT ? 1.0 : 0.0;
    pIndices[i] = i;

    if (isCenter[i] < 0.5 && randomVals[i] < 0.02) { // 4x more photo particles
        imageParticleIndices.push(i);
        customRotations[i] = (Math.random() - 0.5) * 0.8;
        rotationSpeeds[i] = Math.random() < 0.4 ? (Math.random() - 0.5) * 1.2 : 0.0;

        if (randomVals[i] < 0.001) {
            isGalaxyImage[i] = 1.0;
        }
    }

    if (Math.random() < 0.1) {
        isStar[i] = 1.0;

        const rangeX = 300;
        const rangeY = 150;
        const rangeZ = 120;

        const sx = (Math.random() - 0.5) * rangeX;
        const sy = (Math.random() - 0.5) * rangeY;
        const sz = (Math.random() - 0.5) * rangeZ - 20;

        pts[i].set(sx, sy, sz);
        particleData[i].set(sx, sy, sz);
        targetPositions[i * 3] = sx;
        targetPositions[i * 3 + 1] = sy;
        targetPositions[i * 3 + 2] = sz;
    }
}

const atlasTexture = new THREE.CanvasTexture(atlasCanvas);
// Disable mipmaps — with small 256px tiles, mipmaps cause neighboring tiles to bleed into each other
atlasTexture.minFilter = THREE.LinearFilter;
atlasTexture.magFilter = THREE.LinearFilter;
atlasTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
atlasTexture.generateMipmaps = false;

imagePaths.forEach((path, idx) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = path;
    img.onload = () => {
        const col = idx % ATLAS_COLS;
        const row = Math.floor(idx / ATLAS_COLS);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        atlasTexture.needsUpdate = true;

        const aspect = img.width / img.height;
        const aspectsArray = geo.attributes.aspect.array;
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            if (textureIndices[i] === idx) {
                aspectsArray[i] = aspect;
            }
        }
        geo.attributes.aspect.needsUpdate = true;

        loadedCount++;
    };
});

const icons = ["🌺", "💗", "💝", "💖", "🌹", "🪷"];
icons.forEach((icon, idx) => {
    const actualIdx = 58 + idx; // slots 58-63 (last 6 slots in 8x8 atlas)
    const col = actualIdx % ATLAS_COLS;
    const row = Math.floor(actualIdx / ATLAS_COLS);
    ctx.font = `${TILE_SIZE * 0.78}px Arial`; // 200px for 256px tiles
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "white";
    ctx.fillText(icon, col * TILE_SIZE + TILE_SIZE / 2, row * TILE_SIZE + TILE_SIZE / 2);
    atlasTexture.needsUpdate = true;
});

let geo = new THREE.BufferGeometry().setFromPoints(pts);
geo.setAttribute("sizes", new THREE.Float32BufferAttribute(sizes, 1));
geo.setAttribute("shift", new THREE.Float32BufferAttribute(shift, 4));
geo.setAttribute("targetPos", new THREE.Float32BufferAttribute(targetPositions, 3));
geo.setAttribute("texIdx", new THREE.Float32BufferAttribute(textureIndices, 1));
geo.setAttribute("randomVal", new THREE.Float32BufferAttribute(randomVals, 1));
geo.setAttribute("isCenter", new THREE.Float32BufferAttribute(isCenter, 1));
geo.setAttribute("pIdx", new THREE.Float32BufferAttribute(pIndices, 1));
geo.setAttribute("aspect", new THREE.Float32BufferAttribute(aspects, 1));
geo.setAttribute("customRot", new THREE.Float32BufferAttribute(customRotations, 1));
geo.setAttribute("rotSpeed", new THREE.Float32BufferAttribute(rotationSpeeds, 1));
geo.setAttribute("isGalaxyImage", new THREE.Float32BufferAttribute(isGalaxyImage, 1));
geo.setAttribute("isStar", new THREE.Float32BufferAttribute(isStar, 1));

let gu = {
    time: { value: 0 },
    lerp: { value: 0 },
    showImages: { value: 0 },
    scatter: { value: 0 },
    atlas: { value: atlasTexture },
    zoomIdx: { value: -1 },
    zoomFactor: { value: 0 },
    uTargetSize: { value: Math.min(window.innerWidth, window.innerHeight) * 0.85 }
};

let mat = new THREE.PointsMaterial({
    size: 0.12,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    onBeforeCompile: shader => {
        shader.uniforms.time = gu.time;
        shader.uniforms.lerp = gu.lerp;
        shader.uniforms.showImages = gu.showImages;
        shader.uniforms.scatter = gu.scatter;
        shader.uniforms.atlas = gu.atlas;
        shader.uniforms.zoomIdx = gu.zoomIdx;
        shader.uniforms.zoomFactor = gu.zoomFactor;
        shader.uniforms.uTargetSize = gu.uTargetSize;
        shader.vertexShader = `
                    uniform float time;
                    uniform float lerp;
                    uniform float showImages;
                    uniform float scatter;
                    uniform float zoomIdx;
                    uniform float zoomFactor;
                    uniform float uTargetSize;
                    attribute float sizes;
                    attribute vec4 shift;
                    attribute vec3 targetPos;
                    attribute float texIdx;
                    attribute float randomVal;
                    attribute float isCenter;
                    attribute float pIdx;
                    attribute float aspect;
                    attribute float customRot;
                    attribute float rotSpeed;
                    attribute float isGalaxyImage;
                    attribute float isStar;
                    varying vec3 vColor;
                    varying float vTexIdx;
                    varying float vVisible;
                    varying float vIsCenter;
                    varying float vIsZoomed;
                    varying float vAspect;
                    varying float vRotation;
                    varying float vIsGalImg;
                    varying float vIsStar;
                    ${shader.vertexShader}
                `.replace(
            `gl_PointSize = size;`,
            `
                    float isSelect = step(randomVal, 0.02); 
                    
                    float visibleInGalaxy = 1.0;
                    float visibleInPhoto = max(mix(isSelect, 1.0, isCenter), isStar); 
                    vVisible = mix(visibleInGalaxy, visibleInPhoto, showImages);
                    
                    float isIcon = step(11.5, texIdx);
                    float baseScale = mix(20.0, 8.0, isIcon); 
                    vIsZoomed = step(abs(pIdx - zoomIdx), 0.5) * (1.0 - isIcon);

                    float zSmooth = zoomFactor * zoomFactor * (3.0 - 2.0 * zoomFactor);
                    
                    float angle = (customRot + time * rotSpeed * 0.2);
                    vRotation = angle * (1.0 - vIsZoomed * zSmooth) * showImages;

                    float scaleDelta = (baseScale - 1.0) * isSelect * (1.0 - isCenter);
                    float finalScale = 1.0 + scaleDelta * showImages;
                    
                    float galaxyImgScale = mix(1.0, 12.0, isGalaxyImage * (1.0 - showImages));
                    
                    float rotScale = 1.0 + abs(sin(vRotation * 2.0)) * 0.414;
                    float starScale = mix(1.0, 6.0, isStar * step(0.1, zoomFactor));
                    gl_PointSize = size * sizes * finalScale * rotScale * galaxyImgScale * starScale;

                    if (vIsZoomed < 0.5) {
                        gl_PointSize *= mix(1.0, 0.5, zSmooth * showImages);
                    }
                    `
        ).replace(
            `#include <project_vertex>`,
            `
                    #include <project_vertex>
                    if (vIsZoomed > 0.5) {
                        float zSmooth = zoomFactor * zoomFactor * (3.0 - 2.0 * zoomFactor);
                        float totalZoom = zSmooth * showImages;
                        gl_Position.xy = mix(gl_Position.xy, vec2(0.0), totalZoom);
                        gl_Position.z = mix(gl_Position.z, -0.5 * gl_Position.w, totalZoom);
                    }
                    `
        ).replace(
            `#include <color_vertex>`,
            `
                    float d = length(abs(position) / vec3(40., 10., 40));
                    d = clamp(d, 0., 1.);
                    vColor = mix(vec3(255,158,181), vec3(255,240,160), d) / 255.;
                    vTexIdx = texIdx;
                    vIsCenter = isCenter;
                    vAspect = aspect;
                    vIsGalImg = isGalaxyImage;
                    vIsStar = isStar;
                    `
        ).replace(
            `#include <begin_vertex>`,
            `
                    float t = time;
                    float moveT = mod(shift.x + shift.z * t, PI2);
                    float moveS = mod(shift.y + shift.z * t, PI2);
                    vec3 noise = vec3(cos(moveS) * sin(moveT), cos(moveT), sin(moveS) * sin(moveT)) * shift.a;
                    
                    vec3 finalNoise = noise * (1.0 - showImages);
                    
                    vec3 transformed = mix(position + finalNoise, targetPos, lerp);
                    
                    transformed += finalNoise * scatter * 100.0;
                    `
        ).replace(
            `#include <fog_vertex>`,
            `#include <fog_vertex>
                    if (vIsZoomed > 0.5) {
                        float zSmooth = zoomFactor * zoomFactor * (3.0 - 2.0 * zoomFactor);
                        gl_PointSize = mix(gl_PointSize, uTargetSize, zSmooth * showImages);
                    }
                    `
        );

        shader.fragmentShader = `
                    varying vec3 vColor;
                    varying float vTexIdx;
                    varying float vVisible;
                    varying float vIsCenter;
                    varying float vIsZoomed;
                    varying float vAspect;
                    varying float vRotation;
                    varying float vIsGalImg;
                    varying float vIsStar;
                    uniform float time;
                    uniform float showImages;
                    uniform float zoomFactor;
                    uniform sampler2D atlas;
                    ${shader.fragmentShader}
                `.replace(
            `#include <clipping_planes_fragment>`,
            `#include <clipping_planes_fragment>
                    if (vVisible < 0.1) discard;
                    float d = length(gl_PointCoord.xy - 0.5);
                    if (showImages < 0.1 && vIsGalImg < 0.5 && d > 0.5) discard;
                    `
        ).replace(
            `vec4 diffuseColor = vec4( diffuse, opacity );`,
            `
                    vec4 diffuseColor;
                    
                    float zSmooth = zoomFactor * zoomFactor * (3.0 - 2.0 * zoomFactor);
                    float blurSmooth = pow(zSmooth, 0.05); 
                    float blurFade = mix(1.0, 0.09, blurSmooth * (1.0 - vIsZoomed) * showImages);

                    if ((showImages > 0.1 || vIsGalImg > 0.5) && vIsCenter < 0.5 && vIsStar < 0.5) {
                        vec2 uv = gl_PointCoord.xy;
                        
                        float currentRot = mix(0.0, vRotation, mix(1.0, showImages, vIsGalImg));
                        if (abs(currentRot) > 0.001) {
                            vec2 p_rot = uv - 0.5;
                            float cosR = cos(currentRot);
                            float sinR = sin(currentRot);
                            uv.x = p_rot.x * cosR - p_rot.y * sinR + 0.5;
                            uv.y = p_rot.x * sinR + p_rot.y * cosR + 0.5;
                            if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;
                        }

                        if (vAspect > 1.0) { 
                            uv.y = (uv.y - 0.5) * vAspect + 0.5;
                            if (uv.y < 0.0 || uv.y > 1.0) discard;
                        } else { 
                            uv.x = (uv.x - 0.5) / vAspect + 0.5;
                            if (uv.x < 0.0 || uv.x > 1.0) discard;
                        }

                        vec2 p = uv - 0.5;
                        float rad = 0.05; 
                        
                        vec2 cornerP = abs(p) - (0.5 - rad);
                        float dist = length(max(cornerP, 0.0)) - rad;
                        if (dist > 0.0) discard;
                        
                        float col = mod(vTexIdx, 8.0);
                        float row = floor(vTexIdx / 8.0);
                        
                        vec2 uvInPart = vec2(uv.x, 1.0 - uv.y);
                        // 8x8 atlas: tile=0.125 UV, inset 6px (0.003) to prevent tile bleeding
                        float inset = 0.003;
                        float tileContent = 0.125 - inset * 2.0;
                        vec2 finalUV = vec2(
                            (uvInPart.x * tileContent + inset) + (col * 0.125),
                            (uvInPart.y * tileContent + inset) + ((7.0 - row) * 0.125)
                        );
                        
                        vec4 texColor = texture2D(atlas, finalUV);
                        if(texColor.a < 0.3) discard;
                        
                        float finalAlpha = mix(texColor.a * 0.7, texColor.a, showImages);
                        diffuseColor = vec4(texColor.rgb, finalAlpha);
                        
                        diffuseColor.a *= blurFade;
                    } else {
                        vec2 uv = gl_PointCoord.xy - 0.5;
                        float d = length(uv);
                        
                        float dotAlpha = 0.0;
                        if (d <= 0.5) {
                            dotAlpha = smoothstep(0.5, 0.1, d) * (1.0 - showImages);
                            dotAlpha *= blurFade;
                        }

                        float starAlpha = 0.0;
                        if (vIsStar > 0.5 && zoomFactor > 0.1 && showImages > 0.5) {
                             float cX = smoothstep(0.04, 0.0, abs(uv.x)) * smoothstep(0.5, 0.0, abs(uv.y));
                             float cY = smoothstep(0.04, 0.0, abs(uv.y)) * smoothstep(0.5, 0.0, abs(uv.x));
                             float cross = clamp(cX + cY, 0.0, 1.0);
                             cross *= smoothstep(0.5, 0.2, d);
                             
                             float sparkle = 0.5 + 0.5 * sin(time * 5.0 + vTexIdx * 50.0);
                             starAlpha = cross * sparkle * smoothstep(0.1, 0.8, zoomFactor);
                        }

                        float finalAlpha = max(dotAlpha, starAlpha);
                        if (finalAlpha < 0.001) discard;
                        
                        vec3 finalColor = mix(vColor, vec3(1.0), starAlpha > dotAlpha ? 1.0 : 0.0);
                        diffuseColor = vec4(finalColor, finalAlpha);
                    }
                    `
        );
    }
});

mat.alphaTest = 0.1;

let points = new THREE.Points(geo, mat);
points.rotation.order = "ZYX";
points.rotation.z = 0.2;
scene.add(points);

let showImagesTarget = 0;

function toggleImages(visible) {
    showImagesTarget = visible ? 1.0 : 0.0;
}

function updateTargetPositions(modeId) {
    const targets = geo.attributes.targetPos.array;
    if (modeId === MODE.GALAXY || modeId === MODE.FIST) {
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const origin = particleData[i];
            targets[i * 3] = origin.x;
            targets[i * 3 + 1] = origin.y;
            targets[i * 3 + 2] = origin.z;
        }
    }
    geo.attributes.targetPos.needsUpdate = true;
}

const loadingEl = document.getElementById('loading');

let scatterPulse = 0;

// ─── Sakura Petals ───
const petalEmojis = ['🌸', '🌺', '🌼', '💮', '🏵️'];
const sakuraContainer = document.getElementById('sakura');

function spawnPetal() {
    const petal = document.createElement('div');
    petal.className = 'petal';
    petal.textContent = petalEmojis[Math.floor(Math.random() * petalEmojis.length)];
    const startX = Math.random() * 110 - 5;
    const duration = 6 + Math.random() * 8;
    const delay = Math.random() * 2;
    const size = 0.8 + Math.random() * 0.8;
    petal.style.cssText = `
        left: ${startX}vw;
        font-size: ${size}rem;
        animation-duration: ${duration}s;
        animation-delay: ${delay}s;
        animation-name: fall;
    `;
    sakuraContainer.appendChild(petal);
    setTimeout(() => petal.remove(), (duration + delay) * 1000 + 200);
}

// Start spawning petals after entry
let sakuraInterval = null;
function startSakura() {
    spawnPetal();
    sakuraInterval = setInterval(spawnPetal, 600);
}

// ─── Intro Screen & Audio ───
const hideLoading = () => {
    if (loadingEl.style.display === 'none') return;
    loadingEl.style.opacity = '0';
    setTimeout(() => {
        loadingEl.style.display = 'none';
        const audio = new Audio('style/nhac.mp3');
        audio.loop = true;
        audio.volume = 0.6;
        audio.play().catch(e => console.log("Audio play failed:", e));
        startSakura();
    }, 1200);
};

// After scene is ready, show personal intro for Chitato
setTimeout(() => {
    const loader = loadingEl.querySelector('.loader');
    if (loader) loader.style.display = 'none';
    const existingText = loadingEl.querySelector('p');
    if (existingText) existingText.remove();

    const intro = document.createElement('div');
    intro.id = 'intro-screen';
    intro.innerHTML = `
        <div class="to-label">From Ken,</div>
        <div class="to-label">For.</div>
        <div class="name" style="font-family: 'Playfair Display', serif;">Chitato</div>
        <div class="hearts-row">💗 💛 💗</div>
        <div class="tagline">I Love u in every universe</div>
        <div class="enter-btn" id="enter-btn">✨ My Universe ✨</div>
    `;
    loadingEl.appendChild(intro);

    document.getElementById('enter-btn').addEventListener('click', hideLoading, { once: true });
}, 800);


let clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
    controls.update();
    let delta = clock.getDelta();
    let t = clock.getElapsedTime() * 0.2;
    gu.time.value = t * Math.PI;
    lerpFactor += (targetLerp - lerpFactor) * 0.05;
    gu.lerp.value = lerpFactor;
    gu.showImages.value += (showImagesTarget - gu.showImages.value) * 0.05;
    scatterPulse *= 0.92;
    gu.scatter.value = scatterPulse;
    if (gu.showImages.value > 0.5) {
        if (mat.blending !== THREE.NormalBlending) {
            mat.blending = THREE.NormalBlending;
            mat.depthTest = true;
            mat.depthWrite = true;
            mat.needsUpdate = true;
        }
    } else {
        if (mat.blending !== THREE.AdditiveBlending) {
            mat.blending = THREE.AdditiveBlending;
            mat.depthTest = false;
            mat.depthWrite = false;
            mat.needsUpdate = true;
        }
    }
    autoRotationAngle += delta * 0.1;
    points.rotation.y = autoRotationAngle;
    points.rotation.z = 0.2;
    points.rotation.x = 0.0;

    renderer.render(scene, camera);
});
