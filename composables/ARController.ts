// ARControllerTasksVision.ts
import * as THREE from "three";
import { AR_CONFIG } from "./constants";
import { useSliderStore } from "@/stores/store";
import gsap from "gsap";

interface ThreeElements {
  teethModel: THREE.Group | null;
  jawBoneLower: THREE.Bone | null;
  pivot: THREE.Group | null;
  anchorGroup: THREE.Group | null;
  camera: THREE.OrthographicCamera;
  topLipMarker: THREE.Mesh | null;
}

type TV = any;

export const saveFaceLandmarker = ref([]);
export const segmentationMask = ref(null);
let previousSegmentationMask: any = null;

// Performance-Optimierung: Vor-instanziierte Objekte (Object Pooling)
const _tempMouthCenter = new THREE.Vector3();
const _tempTargetPos = new THREE.Vector3();
const _tempCenterPos = new THREE.Vector3();
const SMOOTHING = 0.4; // Wert zwischen 0.1 (sehr träge) und 1.0 (direkt)

export class ARController {
  private faceLandmarker: any = null;
  private imageSegmenter: any = null;
  private videoEl: HTMLVideoElement;
  private threeElements: ThreeElements;
  private debugOverlay: HTMLDivElement | null = null;
  private redDot: HTMLDivElement | null = null;
  private isPitchCalibrated: boolean = false;
  private running: boolean = false;
  private tasksVision: TV | null = null;
  private loopHandle: number | null = null;
  private frameCount: number = 0;

  // NEU: Status-Flags
  private isLoaded: boolean = false;
  private isInitializing: boolean = false;

  constructor(videoEl: HTMLVideoElement, threeElements: ThreeElements) {
    this.videoEl = videoEl;
    this.threeElements = threeElements;
    // Optional: Direkt beim Instanziieren den Preload starten
    // this.preload();
  }

  /**
   * NEU: Lädt alle Ressourcen im Hintergrund.
   * Rufe dies so früh wie möglich auf (z.B. im onMounted von Vue/React).
   */
  public async preload() {
    if (this.isLoaded || this.isInitializing) return;
    this.isInitializing = true;

    try {
      this.tasksVision = await import("@mediapipe/tasks-vision");
      const { FilesetResolver, FaceLandmarker, ImageSegmenter } =
        this.tasksVision;

      const visionFileset = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      const [landmarker, segmenter] = await Promise.all([
        FaceLandmarker.createFromOptions(visionFileset, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
          minFaceDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        }),
        ImageSegmenter.createFromOptions(visionFileset, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          outputCategoryMask: true,
        }),
      ]);

      this.faceLandmarker = landmarker;
      this.imageSegmenter = segmenter;
      await this.warmUp();
      this.isLoaded = true;
    } catch (e) {
      console.error("Preload failed:", e);
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Initialisiert den Loop. Wenn preload() noch nicht fertig war, wartet er kurz.
   */
  public async init() {
    // Falls preload noch nicht gerufen wurde
    if (!this.isLoaded && !this.isInitializing) {
      await this.preload();
    }

    // Warten, falls preload gerade noch läuft
    while (this.isInitializing) {
      await new Promise((r) => setTimeout(r, 100));
    }

    if (this.isLoaded) {
      await this.startLoop();
    }
  }

  private async warmUp() {
    // 1. Erzeuge ein winziges Dummy-Bild (1x1 Pixel)
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.fillRect(0, 0, 1, 1);

    // 2. Nutze einen fiktiven Zeitstempel (z.B. 0)
    const dummyTimestamp = 0;

    try {
      if (this.faceLandmarker) {
        // WICHTIG: Nutze detectForVideo statt detect, wenn runningMode: "VIDEO"
        await this.faceLandmarker.detectForVideo(canvas, dummyTimestamp);
      }
      if (this.imageSegmenter) {
        // WICHTIG: Nutze segmentForVideo statt segment
        await this.imageSegmenter.segmentForVideo(canvas, dummyTimestamp);
      }
    } catch (e) {
      console.warn("Warm-up inference failed, but models are loaded:", e);
    }
  }

  // ... (startLoop und onResults bleiben fast identisch, hier die wichtigsten Änderungen)

  private async startLoop() {
    // Video-Check
    if (this.videoEl.readyState < 2) {
      await new Promise<void>((resolve) => {
        const onLoaded = () => {
          this.videoEl.removeEventListener("loadedmetadata", onLoaded);
          resolve();
        };
        this.videoEl.addEventListener("loadedmetadata", onLoaded);
      });
    }

    this.running = true;
    const loop = async () => {
      if (!this.running) return;
      try {
        // ... (Logik zur Video-Prüfung)

        const ts = performance.now();

        // OPTIMIERUNG: Falls das System am Anfang immer noch stockt,
        // setzen wir FaceLandmarker und Segmenter leicht versetzt ab.
        const result = await this.faceLandmarker.detectForVideo(
          this.videoEl,
          ts
        );
        const segmentResult = await this.imageSegmenter.segmentForVideo(
          this.videoEl,
          ts
        );

        this.handleResult(result, segmentResult);
      } catch (e: any) {
        this.handleError(e);
      } finally {
        this.loopHandle = requestAnimationFrame(loop);
      }
    };
    loop();
  }

  private handleError(e: any) {
    console.error("AR Error:", e);
    this.setModelsVisible(false);
    this.isPitchCalibrated = false;
  }

  private setModelsVisible(visible: boolean) {
    if (this.threeElements.teethModel)
      this.threeElements.teethModel.visible = visible;
    if (this.threeElements.topLipMarker)
      this.threeElements.topLipMarker.visible = visible;
  }

  private handleResult(result: any, segmentResult: any) {
    const landmarks =
      result?.faceLandmarks?.[0] ||
      result?.faceLandmarksList?.[0] ||
      result?.multiFaceLandmarks?.[0] ||
      null;
    if (this.running) this.onResults(landmarks, segmentResult);
  }

  private onResults(lm: any, segmentResult: any) {
    const { teethModel, jawBoneLower, pivot, topLipMarker, anchorGroup } =
      this.threeElements;
    const sliderStore = useSliderStore();

    if (!lm || !teethModel || !pivot || !anchorGroup) {
      this.setModelsVisible(false);
      this.isPitchCalibrated = false;
      return;
    }

    this.frameCount++;
    this.setModelsVisible(true);
    saveFaceLandmarker.value = lm;

    // --- Mask Cleanup (WASM Memory) ---
    if (segmentResult?.categoryMask) {
      if (previousSegmentationMask) {
        try {
          previousSegmentationMask.close();
        } catch (_) {}
      }
      previousSegmentationMask = segmentResult.categoryMask;
      segmentationMask.value = segmentResult.categoryMask;
    }

    // --- Position & Scaling (JETZT OHNE SMOOTHING) ---
    const topLip = lm[13],
      bottomLip = lm[14];
    const mouthOpenness = Math.abs(topLip.y - bottomLip.y);
    const opennessPercent = Math.max(
      0,
      Math.min(1.0, mouthOpenness / AR_CONFIG.OPENNESS_THRESHOLD)
    );

    _tempMouthCenter.set(topLip.x, topLip.y, (topLip.z + bottomLip.z) * 0.5);
    const mouthD = Math.abs(lm[308].x - lm[78].x);
    const depthScale = (sliderStore.sliderValue / 20) * mouthD;

    if (depthScale > 0 && isFinite(depthScale)) {
      // Direkte Zuweisung für maximale Geschwindigkeit
      const posX = (_tempMouthCenter.x - 0.5) * 13.3;

      // Hier ist dein Versatz:
      // Der Faktor 2.0 vor depthScale schiebt das Modell nach oben,
      // da das Koordinatensystem in Three.js nach oben positiv ist.
      const posY = -(_tempMouthCenter.y - 0.5) * 9.5 + 6.0 * depthScale;

      pivot.position.set(posX, posY, 0);

      pivot.scale.setScalar(depthScale);
    }

    // --- Rotations-Logik (DIREKT) ---
    const yawAngle = Math.atan2(lm[234].z - lm[454].z, lm[234].x - lm[454].x);
    let targetYaw =
      yawAngle > 0 ? -1 * (Math.PI - yawAngle) : yawAngle + Math.PI;
    anchorGroup.rotation.y =
      targetYaw * (AR_CONFIG.MAX_JAW_ROTATION_DEG / 0.6) * (Math.PI / 180);

    const pitchAngle = Math.atan2(lm[10].z - lm[152].z, lm[10].y - lm[152].y);
    let targetPitch =
      pitchAngle > 0 ? -1 * (Math.PI - pitchAngle) : pitchAngle + Math.PI;
    anchorGroup.rotation.x =
      targetPitch * (AR_CONFIG.MAX_JAW_TILT_DEG / 0.6) * (Math.PI / 180);

    anchorGroup.rotation.z = 0;

    if (jawBoneLower) {
      // Kieferöffnung ebenfalls direkt
      jawBoneLower.rotation.x =
        -0.878365774778483 + opennessPercent * AR_CONFIG.MAX_ROTATION_RADIANS;
    }

    // --- Red Dot UI ---
    if (this.redDot) {
      const aspect = this.videoEl.videoWidth / this.videoEl.videoHeight;
      const screenW = window.innerWidth,
        screenH = window.innerHeight;
      const effW = screenH >= screenW / aspect ? screenW : screenH * aspect;
      const effH = effW / aspect;
      this.redDot.style.left = `${(
        (screenW - effW) * 0.5 +
        (1.0 - topLip.x) * effW -
        5
      ).toFixed(0)}px`;
      this.redDot.style.top = `${(
        (screenH - effH) * 0.5 +
        topLip.y * effH -
        5
      ).toFixed(0)}px`;
    }
  }

  public freeze(): THREE.Vector3 | null {
    this.running = false;
    if (this.loopHandle !== null) cancelAnimationFrame(this.loopHandle);
    if (this.threeElements.pivot) {
      this.threeElements.pivot.updateWorldMatrix(true, false);
      this.threeElements.pivot.getWorldPosition(_tempCenterPos);
      return _tempCenterPos.clone();
    }
    return null;
  }

  public zoom(
    targetZoomLevel: number,
    time: number,
    centerVector: THREE.Vector3
  ) {
    const { pivot } = this.threeElements;
    if (!pivot) return;
    const finalTargetScale = pivot.scale.x * targetZoomLevel;
    gsap.to(pivot.position, {
      x: 0,
      y: 0 + 6 * finalTargetScale,
      duration: time,
      ease: "power2.inOut",
      overwrite: "auto",
    });
    gsap.to(pivot.scale, {
      x: finalTargetScale,
      y: finalTargetScale,
      z: finalTargetScale,
      duration: time,
      ease: "power2.inOut",
      overwrite: "auto",
    });
  }

  public stop() {
    this.running = false;
    if (this.loopHandle !== null) cancelAnimationFrame(this.loopHandle);
    if (previousSegmentationMask) {
      try {
        previousSegmentationMask.close();
      } catch (_) {}
    }
    if (segmentationMask.value) {
      try {
        (segmentationMask.value as any).close();
      } catch (_) {}
    }
    try {
      this.faceLandmarker?.close();
      this.imageSegmenter?.close();
    } catch (e) {}
    this.debugOverlay?.remove();
    this.redDot?.remove();
  }
}
