<template>
  <ClientOnly class="pointer-events-none">
    <div
      id="ar-container"
      class="relative translate-y-1/2 pointer-events-none w-full overflow-hidden"
    >
      <canvas ref="canvasEl" class="output_canvas pointer-events-none"></canvas>
      <video
        ref="videoEl"
        autoplay
        playsinline
        crossOrigin="anonymous"
        class="webcam_video pointer-events-none"
      ></video>

      <div
        v-if="!isModelLoaded || !isCameraReady || isWarmingUp"
        class="absolute pointer-events-none inset-0 flex items-center justify-center bg-gray-900 bg-opacity-80 text-white z-20"
      >
        <div class="text-center">
          <p class="mb-2">{{ modelStatusMessage }}</p>
          <p class="text-sm opacity-50">{{ debugStatusMessage }}</p>
        </div>
      </div>
    </div>
  </ClientOnly>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from "vue";
import { useMediaPipeLoader } from "../composables/useMediaPipeLoader";
import { useWebcam } from "../composables/useWebcam";
import { ThreeJSManager } from "../composables/ThreeJSManager";
import { ARController } from "../composables/ARController";
import { useVariablesStore } from "~/stores/store";

const variablesStore = useVariablesStore();

const videoEl = ref<HTMLVideoElement | null>(null);
const canvasEl = ref<HTMLCanvasElement | null>(null);

const isModelLoaded = ref(false);
const isWarmingUp = ref(false); // Neuer Status für den Warmup
const modelStatusMessage = ref("Lade 3D-Modell...");
const debugStatusMessage = ref("Initialisiere...");

let threeJSManager: ThreeJSManager | null = null;
let arController: ARController | null = null;
let resizeObserver: ResizeObserver | null = null;

const {
  isCameraReady,
  statusMessage: webcamStatusMessage,
  startWebcam,
  stopWebcam,
} = useWebcam(videoEl);

const { loadMediaPipeScripts } = useMediaPipeLoader();

function zoomIn(i: number, t: number, vector: any) {
  arController?.freeze();
  arController?.zoom(i, t, vector);
}

onMounted(async () => {
  await nextTick();
  const video = videoEl.value!;
  const canvas = canvasEl.value!;

  // 1. Webcam starten
  const cameraOk = await startWebcam();
  if (!cameraOk) {
    debugStatusMessage.value = webcamStatusMessage.value;
    return;
  }

  // 2. Three.js Initialisierung
  threeJSManager = new ThreeJSManager(canvas);

  try {
    // 3. 3D-Modell laden
    const threeElements = await threeJSManager.loadModel((percent) => {
      modelStatusMessage.value = `Lade Modell: ${percent.toFixed(0)}%`;
    });
    isModelLoaded.value = true;

    // 4. MediaPipe Skripte & Controller Setup
    debugStatusMessage.value = "Lade AR-Skripte...";
    await loadMediaPipeScripts();

    arController = new ARController(video, threeElements);

    // --- NEU: DER WARMUP-PROZESS ---
    isWarmingUp.value = true;
    debugStatusMessage.value = "Optimiere Grafik-Leistung...";

    // Starte den Preload (lädt WASM und Modelle)
    await arController.preload();

    // Führe Warmup für Three.js (Shader) und MediaPipe (Inferenz) parallel aus
    // Der ThreeJSManager führt seinen Warmup bereits am Ende von loadModel() aus,
    // aber wir können ihn hier explizit triggern, falls nötig.
    await Promise.all([
      threeJSManager.warmUp(),
      // Falls der ARController eine explizite Warmup-Funktion hat (siehe vorherige Antwort)
      // arController.warmUp()
    ]);

    isWarmingUp.value = false;
    debugStatusMessage.value = "Bereit.";

    // 5. Start-Trigger
    watch(
      () => variablesStore.showReceiptDone,
      (done) => {
        if (done) {
          arController?.init();
          debugStatusMessage.value = "AR aktiv.";
        }
      }
    );
  } catch (error) {
    console.error("Setup-Fehler:", error);
    modelStatusMessage.value = "FEHLER beim Setup.";
  }

  const container = document.getElementById("ar-container")!;
  resizeObserver = new ResizeObserver(() => {
    if (threeJSManager) {
      threeJSManager.resize();
    }
  });
  resizeObserver.observe(container);
});

onBeforeUnmount(() => {
  stopWebcam();
  arController?.stop();
  threeJSManager?.dispose();
  resizeObserver?.disconnect();
});

defineExpose({ zoomIn });
</script>

<style scoped>
.webcam_video {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1);
  display: none;
}

.output_canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transform: scaleX(-1);
}

#ar-container {
  width: 100vw;
  height: 100vh;
}
</style>
