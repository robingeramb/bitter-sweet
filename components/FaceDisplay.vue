<template>
  <ClientOnly>
    <div class="relative w-full h-full">
      <video ref="videoEl" autoplay playsinline muted class="hidden"></video>
      <canvas ref="canvasEl" class="output_canvas"></canvas>
    </div>
  </ClientOnly>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, unref } from "vue";
import {
  saveFaceLandmarker,
  segmentationMask,
} from "@/composables/ARController";
import { useVariablesStore } from "~/stores/store";

const videoEl = ref<HTMLVideoElement | null>(null);
const canvasEl = ref<HTMLCanvasElement | null>(null);
const variablesStore = useVariablesStore();

let gl: WebGL2RenderingContext;
let program: WebGLProgram;
let videoTexture: WebGLTexture;
let maskTexture: WebGLTexture;

let animationId: number | null = null;
let isRunning = true;

interface MouthCenter {
  x: number;
  y: number;
}
let lastMouthCenter: MouthCenter | null = null;

// ---------- Shader ----------
const vsSource = `#version 300 es
in vec2 a_position;
in vec2 a_uv;
out vec2 v_uv;
void main() {
  gl_Position = vec4(a_position,0,1);
  v_uv = a_uv;
}`;

const fsSource = `#version 300 es
precision mediump float;
uniform sampler2D u_video;
uniform sampler2D u_mask;
uniform vec2 u_mouth[20];
in vec2 v_uv;
out vec4 outColor;

float getMouthAlpha(vec2 p) {
    bool inside = false;
    for(int i = 0; i < 20; i++){
        vec2 a = u_mouth[i];
        vec2 b = u_mouth[(i+1)%20];
        if((a.y > p.y) != (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x){
            inside = !inside;
        }
    }
    return inside ? 0.0 : 1.0;
}

void main(){
    vec2 uv = vec2(1.0 - v_uv.x, v_uv.y); 

    // --- OPTIMIERTE MASKE ---
    // Wir sampeln die Maske an mehreren Stellen, um sie weicher zu machen
    float maskSum = 0.0;
    float blurOffset = 0.003; // Stärke der Randglättung
    
    for(float x = -1.0; x <= 1.0; x++) {
        for(float y = -1.0; y <= 1.0; y++) {
            maskSum += texture(u_mask, uv + vec2(x, y) * blurOffset).r;
        }
    }
    float maskVal = maskSum / 9.0;

    // EROSION: Wir machen die Maske "strenger", um weiße Ränder zu fressen
    // Alles unter 0.2 wird komplett transparent, über 0.8 komplett deckend
    maskVal = smoothstep(0.7, 0.8, maskVal);
    
    float alphaMask = 1.0 - maskVal;

    // --- MUND GLÄTTUNG ---
    float d = 0.0015;
    float alphaMouth = (
        getMouthAlpha(uv) + 
        getMouthAlpha(uv + vec2(d, d)) + 
        getMouthAlpha(uv + vec2(-d, -d)) + 
        getMouthAlpha(uv + vec2(d, -d)) + 
        getMouthAlpha(uv + vec2(-d, d))
    ) / 5.0;

    float finalAlpha = min(alphaMask, alphaMouth);

    // Wenn der Rand immer noch pixelig wirkt, schneiden wir extrem weiche Werte ab
    if(finalAlpha < 0.01) discard;

    vec4 videoCol = texture(u_video, uv);
    
    // Farbsättigung am Rand leicht reduzieren (hilft gegen helle Säume)
    float edgeDecon = smoothstep(0.0, 0.2, finalAlpha);
    vec3 finalRGB = mix(videoCol.rgb * 0.9, videoCol.rgb, edgeDecon);

    outColor = vec4(finalRGB, finalAlpha);
}`;

// ---------- Shader Helpers ----------
function createShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string
) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
    console.error(gl.getShaderInfoLog(shader));
  return shader;
}

function createProgram(gl: WebGL2RenderingContext, vs: string, fs: string) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vs);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fs);
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vertexShader);
  gl.attachShader(prog, fragmentShader);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
    console.error(gl.getProgramInfoLog(prog));
  return prog;
}

// ---------- Init WebGL ----------
function initWebGL() {
  const canvas = canvasEl.value!;
  gl = canvas.getContext("webgl2")!;
  program = createProgram(gl, vsSource, fsSource);

  // Fullscreen quad
  const vertices = new Float32Array([
    -1, -1, 0, 1, 1, -1, 1, 1, -1, 1, 0, 0, 1, 1, 1, 0,
  ]);
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  const buffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  const posLoc = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);

  const uvLoc = gl.getAttribLocation(program, "a_uv");
  gl.enableVertexAttribArray(uvLoc);
  gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 16, 8);

  // Textures
  videoTexture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, videoTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  maskTexture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, maskTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
}

// ---------- Update Textures ----------
function updateVideoTexture() {
  gl.bindTexture(gl.TEXTURE_2D, videoTexture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    videoEl.value!
  );
}

function updateMaskTexture(mask: any) {
  if (!mask) return;
  gl.bindTexture(gl.TEXTURE_2D, maskTexture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.R8,
    mask.width,
    mask.height,
    0,
    gl.RED,
    gl.UNSIGNED_BYTE,
    mask.getAsUint8Array()
  );
}

// ---------- Mouth Uniforms ----------
function updateMouthUniforms(lm: any[]) {
  if (!lm?.length) return;
  const mouthIndices = [
    78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14,
    87, 178, 88, 95,
  ];
  const uMouth = new Float32Array(40);
  for (let i = 0; i < 20; i++) {
    const pt = lm[mouthIndices[i]];
    uMouth[i * 2] = pt.x;
    uMouth[i * 2 + 1] = pt.y;
  }
  gl.useProgram(program);
  gl.uniform2fv(gl.getUniformLocation(program, "u_mouth"), uMouth);
}

// ---------- Draw Frame ----------
function drawFrame() {
  if (!gl || !videoEl.value) return;
  const canvas = canvasEl.value!;
  canvas.width = videoEl.value.videoWidth * 2;
  canvas.height = videoEl.value.videoHeight * 2;
  gl.viewport(0, 0, canvas.width, canvas.height);

  updateVideoTexture();
  updateMaskTexture(unref(segmentationMask));
  if (saveFaceLandmarker.value?.length)
    updateMouthUniforms(saveFaceLandmarker.value);

  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(program);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, videoTexture);
  gl.uniform1i(gl.getUniformLocation(program, "u_video"), 0);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, maskTexture);
  gl.uniform1i(gl.getUniformLocation(program, "u_mask"), 1);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  // Mouth Center + Open State
  const lm = saveFaceLandmarker.value;
  if (lm?.length) {
    const top = lm[13],
      bottom = lm[14];
    lastMouthCenter = { x: (top.x + bottom.x) / 2, y: (top.y + bottom.y) / 2 };
    const openness = Math.abs(top.y - bottom.y) * 1000;
    const isOpen = openness > 10;
    if (isOpen !== variablesStore.mouthOpen)
      variablesStore.updateMouthOpen(isOpen);
  }
}

// ---------- Render Loop ----------
function renderLoop() {
  if (!isRunning) return;
  drawFrame();
  animationId = requestAnimationFrame(renderLoop);
}

// ---------- Lifecycle ----------
onMounted(async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  videoEl.value!.srcObject = stream;
  await videoEl.value!.play();
  initWebGL();
  renderLoop();
});

onBeforeUnmount(() => {
  isRunning = false;
  if (animationId) cancelAnimationFrame(animationId);
  const stream = videoEl.value?.srcObject as MediaStream;
  stream?.getTracks().forEach((t) => t.stop());
});

// ---------- Public API ----------
function freezeFrame(): MouthCenter | null {
  isRunning = false;
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  return lastMouthCenter;
}

function unfreezeFrame() {
  if (isRunning) return;
  isRunning = true;
  renderLoop();
}

defineExpose({ freezeFrame, unfreezeFrame });
</script>

<style scoped>
.output_canvas {
  position: fixed;
  top: 0;
  left: 50%;
  transform: translate(-50%, 0);
  width: auto;
  height: auto;
  max-width: 100vw;
  max-height: 100vh;
  background: transparent;
  pointer-events: none;
}
</style>
