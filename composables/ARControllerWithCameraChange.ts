// ARControllerTasksVision.ts
import * as THREE from "three";
import { AR_CONFIG } from "./constants";
import { useSliderStore } from "@/stores/store";
import gsap from "gsap";
import GUI from "lil-gui"; // npm install lil-gui

interface ThreeElements {
  teethModel: THREE.Group | null;
  jawBoneLower: THREE.Bone | null;
  scene: THREE.Scene;
  pivot: THREE.Group | null;
  anchorGroup: THREE.Group | null;
  camera: THREE.OrthographicCamera;
  topLipMarker: THREE.Mesh | null;
  renderer: THREE.WebGLRenderer;
  setCamera: any;
}

type TV = any;

export const saveFaceLandmarker = ref([]);
export const segmentationMask = ref(null);
let previousSegmentationMask: any = null;

// Performance-Optimierung: Vor-instanziierte Objekte
const _tempMouthCenter = new THREE.Vector3();
const _tempCenterPos = new THREE.Vector3();

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

  // Status-Flags
  private isLoaded: boolean = false;
  private isInitializing: boolean = false;

  // NEU: Speichert Landmarks für Updates im Freeze-Zustand
  private lastLandmarks: any = null;

  // NEU: Debug GUI
  private gui: GUI | null = null;
  private debugParams = {
    // Manuelle Verschiebung
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
    // Berechnungs-Faktoren (Magic Numbers)
    scaleFactorY: 6.0, // Wie stark wirkt sich die Tiefe auf Y aus?
    magicFactorY: 9.5, // Skalierung Y-Achse Screen
    magicFactorX: 13.3, // Skalierung X-Achse Screen
  };

  constructor(videoEl: HTMLVideoElement, threeElements: ThreeElements) {
    this.videoEl = videoEl;
    this.threeElements = threeElements;

    // Debug UI starten
    this.initDebugUI();
  }

  /**
   * Initialisiert das Debug-Panel (lil-gui)
   */
  private initDebugUI() {
    this.gui = new GUI({ title: "AR Position Debugger" });

    // Diese Funktion wird gefeuert, wenn ein Regler bewegt wird
    const onParamChange = () => {
      // Wenn das Tracking gestoppt ist (Freeze), erzwingen wir ein Update
      // basierend auf den letzten bekannten Landmarks.
      if (!this.running && this.lastLandmarks) {
        this.updatePlacement(this.lastLandmarks);
      }
    };

    // Ordner für manuelle Offsets
    const folderPos = this.gui.addFolder("Manual Offsets");
    folderPos
      .add(this.debugParams, "offsetX", -20, 20, 0.1)
      .name("X Offset")
      .onChange(onParamChange);
    folderPos
      .add(this.debugParams, "offsetY", -20, 20, 0.1)
      .name("Y Offset")
      .onChange(onParamChange);
    folderPos
      .add(this.debugParams, "offsetZ", -20, 20, 0.1)
      .name("Z Offset")
      .onChange(onParamChange);

    // Ordner für Multiplikatoren
    const folderFactors = this.gui.addFolder("Calculations");
    folderFactors
      .add(this.debugParams, "scaleFactorY", 0, 20, 0.1)
      .name("Depth Y Impact (6.0)")
      .onChange(onParamChange);
    folderFactors
      .add(this.debugParams, "magicFactorY", 0, 20, 0.1)
      .name("Screen Y Scale (9.5)")
      .onChange(onParamChange);
    folderFactors
      .add(this.debugParams, "magicFactorX", 0, 20, 0.1)
      .name("Screen X Scale (13.3)")
      .onChange(onParamChange);

    // Reset Button
    this.gui
      .add(
        {
          reset: () => {
            this.debugParams.offsetX = 0;
            this.debugParams.offsetY = 0;
            this.debugParams.offsetZ = 0;
            this.debugParams.scaleFactorY = 6.0;
            this.debugParams.magicFactorY = 9.5;
            this.debugParams.magicFactorX = 13.3;

            // GUI visuell updaten
            this.gui?.controllers.forEach((c) => c.updateDisplay());
            // Sofort anwenden
            onParamChange();
          },
        },
        "reset"
      )
      .name("Reset Values");
  }

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

  public async init() {
    if (!this.isLoaded && !this.isInitializing) {
      await this.preload();
    }
    while (this.isInitializing) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (this.isLoaded) {
      await this.startLoop();
    }
  }

  private async warmUp() {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.fillRect(0, 0, 1, 1);
    const dummyTimestamp = 0;

    try {
      if (this.faceLandmarker) {
        await this.faceLandmarker.detectForVideo(canvas, dummyTimestamp);
      }
      if (this.imageSegmenter) {
        await this.imageSegmenter.segmentForVideo(canvas, dummyTimestamp);
      }
    } catch (e) {
      console.warn("Warm-up inference failed:", e);
    }
  }

  private async startLoop() {
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
        const ts = performance.now();
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

  /**
   * Berechnet Position und Rotation und wendet sie an.
   * Ausgelagert, damit es auch im Freeze-Modus manuell aufgerufen werden kann.
   */
  private updatePlacement(lm: any) {
    const { pivot, anchorGroup, jawBoneLower } = this.threeElements;
    const sliderStore = useSliderStore();
    const params = this.debugParams; // Zugriff auf Debug Values

    if (!pivot || !anchorGroup) return;

    // --- Geometrie-Berechnungen ---
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

    // --- Positionierung mit Debug Parametern ---
    if (depthScale > 0 && isFinite(depthScale)) {
      // X Position: Magic Factor + Manueller Offset
      const posX =
        (_tempMouthCenter.x - 0.5) * params.magicFactorX + params.offsetX;

      // Y Position: Magic Factor + Depth Impact + Manueller Offset
      // (Original: -... * 9.5 + 6.0 * depthScale)
      const posY =
        -(_tempMouthCenter.y - 0.5) * params.magicFactorY +
        params.scaleFactorY * depthScale +
        params.offsetY;

      // Z Position
      const posZ = 0 + params.offsetZ;

      pivot.position.set(posX, posY, posZ);
      pivot.scale.setScalar(depthScale);
    }

    // --- Rotation (Yaw / Pitch) ---
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

    // --- Kieferöffnung ---
    if (jawBoneLower) {
      jawBoneLower.rotation.x =
        -0.878365774778483 + opennessPercent * AR_CONFIG.MAX_ROTATION_RADIANS;
    }
  }

  private onResults(lm: any, segmentResult: any) {
    const { teethModel, pivot, anchorGroup } = this.threeElements;

    if (!lm || !teethModel || !pivot || !anchorGroup) {
      this.setModelsVisible(false);
      this.isPitchCalibrated = false;
      return;
    }

    this.frameCount++;
    this.setModelsVisible(true);
    saveFaceLandmarker.value = lm;

    // WICHTIG: Speichern für Freeze-Modus
    this.lastLandmarks = lm;

    // --- Mask Cleanup ---
    if (segmentResult?.categoryMask) {
      if (previousSegmentationMask) {
        try {
          previousSegmentationMask.close();
        } catch (_) {}
      }
      previousSegmentationMask = segmentResult.categoryMask;
      segmentationMask.value = segmentResult.categoryMask;
    }

    // --- Positionierung anwenden ---
    this.updatePlacement(lm);

    // --- Red Dot UI (Overlay im DOM) ---
    if (this.redDot && lm[13]) {
      const topLip = lm[13];
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
    const { pivot, camera: orthoCam, setCamera } = this.threeElements;
    if (!pivot || !orthoCam) return;

    // --- SCHRITT 1: PERSPECTIVE CAMERA SETUP ---
    const fov = 35;
    const aspect = window.innerWidth / window.innerHeight;
    const perspectiveCam = new THREE.PerspectiveCamera(fov, aspect, 0.1, 2000);

    // --- SCHRITT 2: MATCH-CUT (Distanz berechnen) ---
    // Damit der Wechsel unsichtbar ist, berechnen wir die exakte Z-Distanz
    const orthoHeight = (orthoCam.top - orthoCam.bottom) / orthoCam.zoom;
    const distance = orthoHeight / (2 * Math.atan((fov * Math.PI) / 360));

    // Neue Kamera exakt dort positionieren, wo die Ortho-Kamera "schaut"
    perspectiveCam.position.set(
      orthoCam.position.x,
      orthoCam.position.y,
      distance
    );
    perspectiveCam.lookAt(orthoCam.position.x, orthoCam.position.y, 0);
    perspectiveCam.updateMatrixWorld();

    // Kamera im ThreeJSManager umschalten
    if (setCamera) setCamera(perspectiveCam);

    // --- SCHRITT 3: ZOOM ANIMATION (Die Annäherung) ---
    const tl = gsap.timeline({
      onComplete: () => {
        // Erst wenn dieser Zoom fertig ist, starten wir die Fahrt "hinein"
        this.intoMouthFade(perspectiveCam, pivot);
      },
    });
    const finalTargetScale = pivot.scale.x * targetZoomLevel;
    // Kamera fährt näher ran, aber noch NICHT durch das Modell hindurch
    // Wir fahren auf etwa 15-20% der Ursprungsdistanz heran
    tl.to(
      perspectiveCam.position,
      {
        x: 0,
        y: 0 - 8 * finalTargetScale,
        z: distance * 0.18,
        duration: time,
        ease: "power2.inOut",
        onUpdate: () => perspectiveCam.updateProjectionMatrix(),
      },
      0
    );

    // Das Modell gleichzeitig etwas größer skalieren
    tl.to(
      pivot.scale,
      {
        x: pivot.scale.x * targetZoomLevel,
        y: pivot.scale.y * targetZoomLevel,
        z: pivot.scale.z * targetZoomLevel,
        duration: time,
        ease: "power2.inOut",
      },
      0
    );
  }

  private intoMouthFade(camera: THREE.PerspectiveCamera, pivot: THREE.Group) {
    console.log("Starte Fahrt in den Mund...");

    const tl = gsap.timeline();

    // Jetzt fahren wir RICHTIG rein (hinter die Z-Ebene 0)
    tl.to(camera.position, {
      z: -15, // Wir fahren "hinter" das Gebiss
      duration: 2.5,
      ease: "power1.in",
      onUpdate: () => camera.updateProjectionMatrix(),
    });

    // Während wir reinfahren, können wir das Modell leicht ausfaden oder
    // die Kamera leicht nach unten neigen, um "in den Hals" zu schauen
    tl.to(
      camera.rotation,
      {
        x: -Math.PI * 0.1, // Leichter Blick nach unten
        duration: 2.5,
        ease: "power1.in",
      },
      0
    );
  }

  public stop() {
    this.running = false;
    if (this.loopHandle !== null) cancelAnimationFrame(this.loopHandle);

    // GUI Aufräumen
    if (this.gui) {
      this.gui.destroy();
      this.gui = null;
    }

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
