// composables/useWebcam.ts

import { ref, type Ref } from "vue"; // 'type Ref' für bessere Typisierung

export function useWebcam(videoEl: Ref<HTMLVideoElement | null>) {
  const isCameraReady = ref(false);
  const statusMessage = ref("Initialisiere...");

  async function startWebcam() {
    if (!videoEl.value) {
      statusMessage.value = "FEHLER: Video-Element nicht verfügbar.";
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoEl.value.srcObject = stream;
      await videoEl.value.play();
      isCameraReady.value = true;
      statusMessage.value = "Webcam bereit.";
      return true;
    } catch (err) {
      console.error("Fehler beim Zugriff auf die Webcam:", err);
      statusMessage.value = "FEHLER: Webcam-Zugriff verweigert.";
      isCameraReady.value = false;
      return false;
    }
  }

  function stopWebcam() {
    const stream = videoEl.value?.srcObject as MediaStream;
    stream?.getTracks().forEach((t) => t.stop());
  }

  return {
    isCameraReady,
    statusMessage,
    startWebcam,
    stopWebcam,
  };
}
