<template>
  <SliderInput />
  <ClientOnly class="pointer-events-none">
    <div class="pointer-events-none">
      <video
        ref="videoEl"
        autoplay
        playsinline
        crossOrigin="anonymous"
        class="input_video hidden pointer-events-none"
      ></video>
      <canvas ref="canvasEl" class="output_canvas" pointer-events-none></canvas>
    </div>
  </ClientOnly>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from "vue";
import { useVariablesStore } from "~/stores/store";

const variablesStore = useVariablesStore();

const videoEl = ref<HTMLVideoElement | null>(null);
const canvasEl = ref<HTMLCanvasElement | null>(null);

// **NEU:** Instanzen global definieren
let cameraInstance: any = null;
let segmentationInstance: any = null;
let faceMeshInstance: any = null;
let latestSegmentation: any = null;
let latestFace: any = null;
let isRunning = ref(true); // Verfolgt, ob die Verarbeitung aktiv ist

// **NEU:** Speichert das letzte berechnete Mundzentrum (normierte Koordinaten x, y)
interface MouthCenter {
  x: number;
  y: number;
  z?: number; // Optional, falls benötigt
}
let lastMouthCenter: MouthCenter | null = null;

// ... (onMounted-Hook unverändert bis zur drawFrame-Definition)

onMounted(async () => {
  await nextTick();
  const video = videoEl.value!;
  const canvas = canvasEl.value!;
  const ctx = canvas.getContext("2d")!;

  // Webcam starten
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;
  await video.play();

  // Initialisierung der MediaPipe-Instanzen
  segmentationInstance = new (window as any).SelfieSegmentation({
    locateFile: (file: string) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
  });
  segmentationInstance.setOptions({ modelSelection: 1 });

  faceMeshInstance = new (window as any).FaceMesh({
    locateFile: (file: string) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
  });
  faceMeshInstance.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  segmentationInstance.onResults((results: any) => {
    latestSegmentation = results;
    drawFrame();
  });

  faceMeshInstance.onResults((results: any) => {
    latestFace = results;
    drawFrame();
  });

  function drawFrame() {
    if (!latestSegmentation || !latestFace) return;

    // Canvas interne Auflösung setzen (Video-Seitenverhältnis)
    const scale = 2;
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // --- TRANSFORMATION FÜR SPIEGELUNG START ---
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);
    // --- TRANSFORMATION FÜR SPIEGELUNG ENDE ---

    // ... (Anwendung der Maske unverändert)
    // Video-Frame zeichnen
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (latestSegmentation.segmentationMask) {
      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(
        latestSegmentation.segmentationMask,
        0,
        0,
        canvas.width,
        canvas.height
      );
      ctx.globalCompositeOperation = "source-over";
    }
    // --- ENDE: ANWENDUNG DER MASKE ---

    // Mundöffnung berechnen
    if (latestFace.multiFaceLandmarks?.length) {
      const lm = latestFace.multiFaceLandmarks[0];
      const cw = canvas.width;
      const ch = canvas.height;

      const topLip = lm[13];
      const bottomLip = lm[14];
      const mouthOpen = Math.abs(topLip.y - bottomLip.y);
      const opennessPercent = Math.min(100, Math.round(mouthOpen * 1000));

      // **AKTUALISIERUNG:** Letztes Mundzentrum speichern (normierte Koordinaten)
      lastMouthCenter = {
        x: (topLip.x + bottomLip.x) / 2, // Mittelpunkt zwischen Lippen
        y: (topLip.y + bottomLip.y) / 2,
      };

      // --- Mund Transparent machen (Ausschneiden) ---
      const innerMouthIndices = [
        78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317,
        14, 87, 178, 88, 95,
      ];

      if (opennessPercent > 5) {
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = "black";

        ctx.beginPath();
        const firstPt = lm[innerMouthIndices[0]];

        ctx.moveTo(firstPt.x * cw, firstPt.y * ch);

        for (let i = 1; i < innerMouthIndices.length; i++) {
          const pt = lm[innerMouthIndices[i]];
          ctx.lineTo(pt.x * cw, pt.y * ch);
        }
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      }

      if (opennessPercent > 10 && !variablesStore.mouthOpen) {
        variablesStore.updateMouthOpen(true);
      } else if (opennessPercent <= 10 && variablesStore.mouthOpen) {
        variablesStore.updateMouthOpen(false);
      }
      // --- ENDE: Mund Transparent machen ---

      // UI für Mundöffnung (Balken)
      ctx.fillStyle = "rgba(255,0,0,0.6)";
      ctx.fillRect(10, 10, opennessPercent * 1.5, 15);
      ctx.strokeStyle = "red";
      ctx.strokeRect(10, 10, 150, 15);
      ctx.fillStyle = "white";
      ctx.font = "12px sans-serif";
      ctx.fillText(`Mundöffnung: ${opennessPercent}%`, 10, 40);
    }

    // --- ZUSTAND DER SPIEGELUNG WIEDERHERSTELLEN ---
    ctx.restore();
  }

  cameraInstance = new (window as any).Camera(video, {
    onFrame: async () => {
      // **NEU:** Nur senden, wenn isRunning true ist
      if (isRunning.value) {
        await segmentationInstance.send({ image: video });
        await faceMeshInstance.send({ image: video });
      }
    },
    width: 1280,
    height: 720,
  });
  cameraInstance.start();
});

// **ANGEPASSTE FUNKTION:** Friert das aktuelle Frame auf dem Canvas ein und gibt das Mundzentrum zurück
function freezeFrame(): MouthCenter | null {
  console.log("freezeFrame aufgerufen");
  if (!cameraInstance || !isRunning.value) return null; // Rückgabe null, falls bereits gestoppt

  // 1. Die MediaPipe-Loop stoppen
  cameraInstance.stop();
  isRunning.value = false;

  // 2. Den Video-Stream im Hintergrund pausieren (optional, spart Ressourcen)
  if (videoEl.value) {
    videoEl.value.pause();
  }

  // Da drawFrame das letzte Ergebnis gezeichnet hat, bleibt das Frame auf dem Canvas erhalten.
  console.log("Webcam-Verarbeitung gestoppt und Frame eingefroren.");

  // 3. Letztes bekanntes Mundzentrum zurückgeben
  return lastMouthCenter;
}

// **NEUE FUNKTION:** Startet das Frame-Processing neu
function unfreezeFrame() {
  if (!cameraInstance || isRunning.value) return;

  // 1. Video im Hintergrund wieder starten
  if (videoEl.value) {
    videoEl.value.play();
  }

  // 2. Die MediaPipe-Loop neu starten
  cameraInstance.start();
  isRunning.value = true;
  console.log("Webcam-Verarbeitung und Frame-Update neugestartet.");
}

onBeforeUnmount(() => {
  const stream = videoEl.value?.srcObject as MediaStream;
  stream?.getTracks().forEach((t) => t.stop());
  if (cameraInstance) {
    cameraInstance.stop(); // Stellt sicher, dass die Kamera-Loop beendet wird
  }
});

// **Exponiere die neue Funktion**
defineExpose({
  freezeFrame,
  unfreezeFrame,
});
</script>
<style scoped>
/* ... (Styles unverändert) */
.input_video {
  display: none;
}
.output_canvas {
  position: fixed;
  opacity: 1;
  top: 0px; /* Abstand oben */
  left: 50%; /* Abstand links */
  transform: translate(-50%, 0);
  width: auto; /* CSS Skaliert proportional */
  height: auto;
  max-width: 100vw; /* maximale Breite */
  max-height: 100vh; /* maximale Höhe */
  /* Hintergrund auf transparent setzen, um den "ausgeschnittenen" Mundbereich zu zeigen */
  background: transparent;
  pointer-events: none;
}
</style>
