<template>
  <ClientOnly>
    <div class="relative w-full h-full">
      <video ref="videoEl" autoplay playsinline muted class="hidden"></video>
      <canvas ref="canvasEl" class="output_canvas"></canvas>
    </div>
  </ClientOnly>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick, unref } from "vue";
// WICHTIG: Diese müssen im ARController als 'ref' exportiert sein, sonst friert es ein!
import {
  saveFaceLandmarker,
  segmentationMask,
} from "@/composables/ARController";
import { useVariablesStore } from "~/stores/store";

const variablesStore = useVariablesStore();
const videoEl = ref<HTMLVideoElement | null>(null);
const canvasEl = ref<HTMLCanvasElement | null>(null);
let animationId: number | null = null;
let isRunning = true;

// PERFORMANCE: Temp Canvas und Context ZWISCHEN den Frames speichern
// Wird nur einmal erstellt, nicht 60x pro Sekunde.
const tempCanvas = document.createElement("canvas");
const tempCtx = tempCanvas.getContext("2d", { willReadFrequently: true });

interface MouthCenter {
  x: number;
  y: number;
}
let lastMouthCenter: MouthCenter | null = null;

onMounted(async () => {
  await nextTick();
  const video = videoEl.value!;
  const canvas = canvasEl.value!;
  // 'willReadFrequently: true' ist wichtig für Performance wenn wir oft imageData lesen/schreiben
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;
  await video.play();

  function renderLoop() {
    if (!isRunning) return;
    drawFrame();
    animationId = requestAnimationFrame(renderLoop);
  }
  renderLoop();

  function drawFrame() {
    if (!video.videoWidth || !video.videoHeight) return;

    const scale = 2;
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    // Spiegelung
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);

    // --- 1. Webcam zeichnen (Basisbild) ---
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // --- 2. Hintergrund entfernen ---
    // WICHTIG: unref() nutzen, um den aktuellen Wert aus dem Ref zu holen,
    // damit es nicht einfriert.
    const mask = unref(segmentationMask);

    if (mask && tempCtx) {
      // Temp Canvas Größe bei Bedarf anpassen
      if (
        tempCanvas.width !== mask.width ||
        tempCanvas.height !== mask.height
      ) {
        tempCanvas.width = mask.width;
        tempCanvas.height = mask.height;
      }

      const maskArray = mask.getAsUint8Array();
      const iData = tempCtx.createImageData(mask.width, mask.height);

      for (let i = 0; i < maskArray.length; i++) {
        const maskValue = maskArray[i];
        // Annahme: Werte > 0 sind die Person.
        const isPerson = maskValue > 0;
        const offset = i * 4;

        // RGB ist egal bei destination-in, nur Alpha zählt.
        iData.data[offset + 0] = 0;
        iData.data[offset + 1] = 0;
        iData.data[offset + 2] = 0;

        // --- FIX FÜR DIE INVERTIERUNG ---
        // Wir nutzen 'destination-in'. Das bedeutet: Was im TempCanvas OPAK (255) ist, bleibt erhalten.
        // Wir wollen, dass die Person erhalten bleibt.
        // Also: Wenn isPerson wahr ist, setze Alpha auf 255.
        iData.data[offset + 3] = isPerson ? 255 : 0;
      }

      tempCtx.putImageData(iData, 0, 0);

      // 'destination-in': Behält das Originalbild nur dort, wo das neue Bild (die Maske) undurchsichtig ist.
      ctx.globalCompositeOperation = "destination-in";
      // Maske aufskalieren auf Canvas-Größe
      ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
      // Wichtig: Modus zurücksetzen für den Mund
      ctx.globalCompositeOperation = "source-over";
    }

    // --- 3. Mund ausschneiden ---
    // Auch hier unref() nutzen!
    const landmarks = unref(saveFaceLandmarker);

    if (landmarks && landmarks.length > 0) {
      const innerMouthIndices = [
        78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317,
        14, 87, 178, 88, 95,
      ];
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "black";
      ctx.beginPath();
      const firstPt = landmarks[innerMouthIndices[0]];
      ctx.moveTo(firstPt.x * canvas.width, firstPt.y * canvas.height);
      for (let i = 1; i < innerMouthIndices.length; i++) {
        const pt = landmarks[innerMouthIndices[i]];
        ctx.lineTo(pt.x * canvas.width, pt.y * canvas.height);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      const topLip = landmarks[13];
      const bottomLip = landmarks[14];
      lastMouthCenter = {
        x: (topLip.x + bottomLip.x) / 2,
        y: (topLip.y + bottomLip.y) / 2,
      };
      const mouthOpen = Math.abs(topLip.y - bottomLip.y);
      const opennessPercent = Math.min(100, Math.round(mouthOpen * 1000));
      if (opennessPercent > 10 && !variablesStore.mouthOpen) {
        variablesStore.updateMouthOpen(true);
      } else if (opennessPercent <= 10 && variablesStore.mouthOpen) {
        variablesStore.updateMouthOpen(false);
      }
    }
    ctx.restore();
  }
});

onBeforeUnmount(() => {
  isRunning = false;
  if (animationId) cancelAnimationFrame(animationId);
  const stream = videoEl.value?.srcObject as MediaStream;
  stream?.getTracks().forEach((t) => t.stop());
});

// Freeze / Unfreeze Logik
function freezeFrame(): MouthCenter | null {
  isRunning = false;
  return lastMouthCenter;
}

function unfreezeFrame() {
  if (!isRunning) {
    isRunning = true;
    // Loop wieder starten
    renderLoop();
  }
}

// renderLoop muss auch hier verfügbar sein für unfreezeFrame
let renderLoop: () => void;

// Den echten renderLoop im onMounted zuweisen
onMounted(async () => {
  // ... (restlicher onMounted code wie oben) ...
  renderLoop = function () {
    if (!isRunning) return;
    drawFrame();
    animationId = requestAnimationFrame(renderLoop);
  };
  renderLoop();

  function drawFrame() {
    if (!video.videoWidth || !video.videoHeight) return;

    // Canvas Größe anpassen
    const scale = 2; // Ggf. anpassen für Performance
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    // Spiegelung
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);

    // --- 1. Webcam zeichnen (Basis) ---
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // --- 2. Hintergrund entfernen ---
    // Wir nutzen unref(), falls segmentationMask ein Ref ist
    const mask = unref(segmentationMask);

    if (mask) {
      // Temp Canvas Größe an Maske anpassen
      if (
        tempCanvas.width !== mask.width ||
        tempCanvas.height !== mask.height
      ) {
        tempCanvas.width = mask.width;
        tempCanvas.height = mask.height;
      }

      const maskArray = mask.getAsUint8Array();
      const iData = tempCtx!.createImageData(mask.width, mask.height);

      // LOGIK-UMKEHRUNG HIER
      // Wenn du vorher "weggeschnitten" warst, müssen wir die Logik drehen.
      // 255 = Sichtbar (Opaque), 0 = Transparent
      const INVERT_MASK = true; // Setze dies auf false, wenn es wieder falsch ist

      for (let i = 0; i < maskArray.length; i++) {
        const maskValue = maskArray[i];
        // Üblicherweise: > 0 (oder > 128) ist die Person.
        const isPerson = maskValue > 0;

        const offset = i * 4;
        // R, G, B sind egal bei destination-in, nur Alpha zählt
        iData.data[offset + 0] = 0;
        iData.data[offset + 1] = 0;
        iData.data[offset + 2] = 0;

        if (INVERT_MASK) {
          // Szenario A: Person soll sichtbar bleiben (Alpha 255), Rest weg (Alpha 0)
          // Wenn maskValue > 0 die Person ist:
          iData.data[offset + 3] = isPerson ? 255 : 0;
        } else {
          // Szenario B: Falls die Maske andersrum geliefert wird
          iData.data[offset + 3] = isPerson ? 0 : 255;
        }
      }

      tempCtx!.putImageData(iData, 0, 0);

      // Maske anwenden ("destination-in" behält nur das, was im tempCanvas opak ist)
      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);

      // Zurücksetzen für nachfolgende Zeichnungen
      ctx.globalCompositeOperation = "source-over";
    }

    // --- 3. Mund ausschneiden ---
    const landmarks = unref(saveFaceLandmarker); // Auch hier unref nutzen

    if (landmarks && landmarks.length > 0) {
      const innerMouthIndices = [
        78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317,
        14, 87, 178, 88, 95,
      ];

      ctx.save();
      ctx.globalCompositeOperation = "destination-out"; // Stanzt Loch aus
      ctx.fillStyle = "black";
      ctx.beginPath();

      const firstPt = landmarks[innerMouthIndices[0]];
      ctx.moveTo(firstPt.x * canvas.width, firstPt.y * canvas.height);

      for (let i = 1; i < innerMouthIndices.length; i++) {
        const pt = landmarks[innerMouthIndices[i]];
        ctx.lineTo(pt.x * canvas.width, pt.y * canvas.height);
      }

      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Logik für Mouth Center
      const topLip = landmarks[13];
      const bottomLip = landmarks[14];
      lastMouthCenter = {
        x: (topLip.x + bottomLip.x) / 2,
        y: (topLip.y + bottomLip.y) / 2,
      };

      const mouthOpen = Math.abs(topLip.y - bottomLip.y);
      const opennessPercent = Math.min(100, Math.round(mouthOpen * 1000));

      if (opennessPercent > 10 && !variablesStore.mouthOpen) {
        variablesStore.updateMouthOpen(true);
      } else if (opennessPercent <= 10 && variablesStore.mouthOpen) {
        variablesStore.updateMouthOpen(false);
      }
    }
    ctx.restore();
  }
});

onBeforeUnmount(() => {
  isRunning = false;
  if (animationId) cancelAnimationFrame(animationId);
  const stream = videoEl.value?.srcObject as MediaStream;
  stream?.getTracks().forEach((t) => t.stop());
});

function freezeFrame(): MouthCenter | null {
  isRunning = false;
  return lastMouthCenter;
}

function unfreezeFrame() {
  isRunning = true;
  // Ggf. Loop neu starten, falls er komplett gestoppt hat,
  // aber durch isRunning=false läuft der RequestAnimationFrame eh leer,
  // man müsste ihn hier eigentlich neu anstoßen:
  requestAnimationFrame(function restart() {
    if (isRunning) {
      // Verweist auf die renderLoop im Scope, evtl. muss die Funktion rausgezogen werden
      // oder einfach animationId prüfen.
      // Einfachheitshalber oben "renderLoop" aufrufen
    }
  });
}

defineExpose({
  freezeFrame,
  unfreezeFrame,
});
</script>

<style scoped>
.output_canvas {
  position: fixed;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: auto;
  height: auto;
  max-width: 100vw;
  max-height: 100vh;
  background: transparent;
  pointer-events: none;
}
</style>
