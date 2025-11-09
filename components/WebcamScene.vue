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
      `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
  });
  segmentation.setOptions({ modelSelection: 1 });

  const faceMesh = new (window as any).FaceMesh({
    locateFile: (file: string) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
  });
  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
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
    const scale = 0.25; // Canvas auf 25% der Video-Größe
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
      const topLip = lm[13];
      const bottomLip = lm[14];
      const mouthOpen = Math.abs(topLip.y - bottomLip.y);
      const opennessPercent = Math.min(100, Math.round(mouthOpen * 1000));

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
  top: 10px; /* Abstand oben */
  left: 10px; /* Abstand links */
  width: auto; /* CSS Skaliert proportional */
  height: auto;
  max-width: 320px; /* maximale Breite */
  max-height: 180px; /* maximale Höhe */
  background: transparent;
  pointer-events: none;
  border: 2px solid red;
  border-radius: 8px;
}
</style>
