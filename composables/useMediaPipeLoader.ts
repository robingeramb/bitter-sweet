// composables/useMediaPipeLoader.ts
import { ref } from "vue";

// Singleton State
const isMediaPipeLoaded = ref(false);
let loadingPromise: Promise<boolean> | null = null; // Speichert den laufenden Ladevorgang

export function useMediaPipeLoader() {
  const loadScript = (src: string) =>
    new Promise<void>((resolve, reject) => {
      // Check ob Skript schon im DOM ist, um Duplikate im DOM zu vermeiden
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = (e) => reject(e);
      document.head.appendChild(s);
    });

  const loadMediaPipeScripts = () => {
    // 1. Wenn bereits geladen, sofort true zurückgeben
    if (isMediaPipeLoaded.value) return Promise.resolve(true);

    // 2. Wenn gerade geladen wird, den existierenden Promise zurückgeben
    if (loadingPromise) return loadingPromise;

    // 3. Ladevorgang starten
    loadingPromise = (async () => {
      try {
        await loadScript(
          "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3/camera_utils.js"
        );
        // Pose Landmarker (BlazePose) hinzugefügt
        // Die folgenden waren bereits vorhanden
        await loadScript(
          "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/face_mesh.js"
        );
        await loadScript(
          "https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1.1675465747/selfie_segmentation.js"
        );

        isMediaPipeLoaded.value = true;
        return true;
      } catch (e) {
        loadingPromise = null; // Reset bei Fehler, damit man es nochmal versuchen kann
        return false;
      }
    })();

    return loadingPromise;
  };

  return {
    isMediaPipeLoaded,
    loadMediaPipeScripts,
  };
}
