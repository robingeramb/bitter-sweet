<template>
  <ClientOnly>
    <div>
      <video
        ref="videoEl"
        autoplay
        playsinline
        class="input_video hidden"
      ></video>
      <canvas ref="canvasEl" class="output_canvas"></canvas>
    </div>
  </ClientOnly>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from "vue";

const videoEl = ref<HTMLVideoElement | null>(null);
const canvasEl = ref<HTMLCanvasElement | null>(null);

onMounted(async () => {
  await nextTick();
  const video = videoEl.value!;
  const canvas = canvasEl.value!;
  const ctx = canvas.getContext("2d")!;

  // Webcam starten
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;
  await video.play();

  // MediaPipe Scripts laden
  const loadScript = (src: string) =>
    new Promise<void>((resolve) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => resolve();
      document.head.appendChild(s);
    });

  await loadScript(
    "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"
  );
  await loadScript(
    "https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js"
  );
  await loadScript(
    "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js"
  );

  const segmentation = new (window as any).SelfieSegmentation({
    locateFile: (file: string) =>
      // KORREKTUR: Muss ein String sein (Backticks verwenden)
      `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
  });
  segmentation.setOptions({ modelSelection: 1 });

  const faceMesh = new (window as any).FaceMesh({
    locateFile: (file: string) =>
      // KORREKTUR: Muss ein String sein (Backticks verwenden)
      `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
  });
  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true, // Wichtig für Lippen-Details
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  let latestSegmentation: any = null;
  let latestFace: any = null;

  segmentation.onResults((results: any) => {
    latestSegmentation = results;
    drawFrame();
  });

  faceMesh.onResults((results: any) => {
    latestFace = results;
    drawFrame();
  });

  function drawFrame() {
    if (!latestSegmentation || !latestFace) return;

    // Canvas interne Auflösung setzen (Video-Seitenverhältnis)
    const scale = 0.5; // Canvas auf 25% der Video-Größe
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Hintergrund entfernen
    ctx.save();
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
    ctx.restore();

    // Mundöffnung berechnen
    if (latestFace.multiFaceLandmarks?.length) {
      const lm = latestFace.multiFaceLandmarks[0];
      const cw = canvas.width;
      const ch = canvas.height;

      const topLip = lm[13];
      const bottomLip = lm[14];
      const mouthOpen = Math.abs(topLip.y - bottomLip.y);
      const opennessPercent = Math.min(100, Math.round(mouthOpen * 1000));

      // --- NEU: Filter "Vergammelte Zähne" ---
      // Dies sind die Landmark-Indizes für die innere Lippenkontur
      const innerMouthIndices = [
        78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317,
        14, 87, 178, 88, 95,
      ];

      // Filter nur anwenden, wenn der Mund etwas offen ist
      if (opennessPercent > 5) {
        // Schwellenwert (kann angepasst werden)
        ctx.save();

        // Setzt den Composite-Modus auf "color"
        // Behält die Helligkeit des Videos, aber nutzt den Farbton/Sättigung der Füllfarbe
        ctx.globalCompositeOperation = "color";

        // Eine "vergammelte" Farbe. (SaddleBrown mit 80% Deckkraft)
        // Du kannst hier mit Farbe und Deckkraft experimentieren.
        ctx.fillStyle = "rgba(139, 69, 19, 1)";

        // Zeichne das Polygon, das den Mundinnenraum füllt
        ctx.beginPath();
        const firstPt = lm[innerMouthIndices[0]];
        ctx.moveTo(firstPt.x * cw, firstPt.y * ch);

        for (let i = 1; i < innerMouthIndices.length; i++) {
          const pt = lm[innerMouthIndices[i]];
          ctx.lineTo(pt.x * cw, pt.y * ch);
        }
        ctx.closePath();
        ctx.fill();

        ctx.restore(); // Setzt globalCompositeOperation zurück
      }
      // --- ENDE: Filter "Vergammelte Zähne" ---

      // UI für Mundöffnung (Balken)
      ctx.fillStyle = "rgba(255,0,0,0.6)";
      ctx.fillRect(10, 10, opennessPercent * 1.5, 15);
      ctx.strokeStyle = "red";
      ctx.strokeRect(10, 10, 150, 15);
      ctx.fillStyle = "white";
      ctx.font = "12px sans-serif";
      ctx.fillText(`Mundöffnung: ${opennessPercent}%`, 10, 40);
    }
  }

  const camera = new (window as any).Camera(video, {
    onFrame: async () => {
      await segmentation.send({ image: video });
      await faceMesh.send({ image: video });
    },
    width: 1280,
    height: 720,
  });
  camera.start();
});

onBeforeUnmount(() => {
  const stream = videoEl.value?.srcObject as MediaStream;
  stream?.getTracks().forEach((t) => t.stop());
});
</script>

<style scoped>
.input_video {
  display: none;
}
.output_canvas {
  position: fixed;
  top: 0px; /* Abstand oben */
  left: 10%; /* Abstand links */
  transform: translate(-50%, 0);
  width: auto; /* CSS Skaliert proportional */
  height: auto;
  max-width: 100vw; /* maximale Breite */
  max-height: 100vh; /* maximale Höhe */
  background: transparent;
  pointer-events: none;
}
</style>
