<template>
  <ClientOnly class="pointer-events-none">
    <div
      id="ar-container"
      class="relative pointer-events-none w-full overflow-hidden"
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
        v-if="!isModelLoaded || !isCameraReady"
        class="absolute pointer-events-none inset-0 flex items-center justify-center bg-gray-900 bg-opacity-80 text-white z-20"
      ></div>
    </div>
  </ClientOnly>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from "vue";
import * as THREE from "three";

// Importiere jetzt auch das zentrale Lade-Composable
import { useMediaPipeLoader } from "../composables/useMediaPipeLoader";

import { useWebcam } from "../composables/useWebcam";
import { ThreeJSManager } from "../composables/ThreeJSManager";
import { ARController } from "../composables/ARController";

// --- Refs für DOM und Status ---
const videoEl = ref<HTMLVideoElement | null>(null);
const canvasEl = ref<HTMLCanvasElement | null>(null);

const isModelLoaded = ref(false);
const modelStatusMessage = ref("Lade 3D-Modell...");
const debugStatusMessage = ref("Initialisiere...");

// --- Instanzen der Manager-Klassen ---
let threeJSManager: ThreeJSManager | null = null;
let arController: ARController | null = null;
let resizeObserver: ResizeObserver | null = null;

// --- Composables ---
const {
  isCameraReady,
  statusMessage: webcamStatusMessage,
  startWebcam,
  stopWebcam,
} = useWebcam(videoEl);

// NEU: Importiere die zentrale Ladefunktion
const { loadMediaPipeScripts } = useMediaPipeLoader();

// --- Lifecycle Hooks ---

function zoomIn(i: number, t: number, vector: any) {
  let center = arController?.freeze();
  console.log("Zoom In auf:", i, "über", t, "Sekunden. Zentrum:", center);
  arController?.zoom(i, t, vector);
}

onMounted(async () => {
  await nextTick();
  const video = videoEl.value!;
  const canvas = canvasEl.value!;

  // 1. Starte Webcam
  const cameraOk = await startWebcam();
  if (!cameraOk) {
    debugStatusMessage.value = webcamStatusMessage.value;
    return;
  }

  // 2. Initialisiere Three.js und starte die Render-Schleife
  threeJSManager = new ThreeJSManager(canvas);

  // 3. Lade das 3D-Modell
  try {
    const threeElements = await threeJSManager.loadModel((percent) => {
      modelStatusMessage.value = `Lade Modell: ${percent.toFixed(0)}%`;
    });
    isModelLoaded.value = true;
    modelStatusMessage.value = "Modell geladen.";

    // --- 4. MEDIA PIPE LADE-LOGIK AUSGELAGERT ---
    debugStatusMessage.value = "Lade AR-Skripte...";

    // Anstatt ARController.loadMediaPipeScripts() aufzurufen:
    await loadMediaPipeScripts();

    debugStatusMessage.value = "Suche Gesicht...";

    // 5. Initialisiere und starte den ARController
    // (Der ARController muss jetzt die statische loadMediaPipeScripts Methode nicht mehr haben)
    arController = new ARController(video, threeElements);
    arController.init();

    debugStatusMessage.value = "AR-Anwendung gestartet.";
  } catch (error) {
    console.error("Setup-Fehler:", error);
    modelStatusMessage.value = "FEHLER beim Laden oder Initialisieren.";
    debugStatusMessage.value = modelStatusMessage.value;
  }

  // 6. Responsive Anpassung
  const container = document.getElementById("ar-container")!;
  resizeObserver = new ResizeObserver(() => {
    if (threeJSManager) {
      threeJSManager.resize();
      setTimeout(() => {
        threeJSManager.triggerRottingTransition();
      }, 3000);
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

defineExpose({
  zoomIn,
});
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
  display: none; /* Verstecke das Videoelement */
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
