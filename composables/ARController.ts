// ARControllerTasksVision.ts
import * as THREE from "three";
import { AR_CONFIG } from "./constants";
import { useSliderStore } from "@/stores/store";
import gsap from "gsap"; // Fügen Sie gsap für die Animation hinzu

interface ThreeElements {
  teethModel: THREE.Group | null;
  jawBoneLower: THREE.Bone | null;
  pivot: THREE.Group | null;
  anchorGroup: THREE.Group | null;
  camera: THREE.OrthographicCamera;
  topLipMarker: THREE.Mesh | null;
}

type TV = any; // lightweight alias for tasks-vision module (zur Laufzeit geladen)

export class ARController {
  private faceLandmarker: any = null;
  private videoEl: HTMLVideoElement;
  private threeElements: ThreeElements;
  private debugOverlay: HTMLDivElement | null = null;
  private redDot: HTMLDivElement | null = null;
  private isPitchCalibrated: boolean = false;
  private pitchCalibrationY: number = 0.5;
  private running: boolean = false;
  private tasksVision: TV | null = null;
  private loopHandle: number | null = null;

  constructor(videoEl: HTMLVideoElement, threeElements: ThreeElements) {
    this.videoEl = videoEl;
    this.threeElements = threeElements;
    this.createDebugOverlay();
    this.createRedDot();
  }

  // ... (private Methoden wie createDebugOverlay, createRedDot, init, startLoop, handleResult, onResults bleiben unverändert)

  private createDebugOverlay() {
    this.debugOverlay = document.createElement("div");
    Object.assign(this.debugOverlay.style, {
      position: "absolute",
      top: "10px",
      left: "10px",
      padding: "10px",
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      color: "#00ff00",
      fontFamily: "monospace",
      fontSize: "14px",
      zIndex: "9999",
      pointerEvents: "none",
      borderRadius: "8px",
      whiteSpace: "pre",
    });
    document.body.appendChild(this.debugOverlay);
  }

  private createRedDot() {
    this.redDot = document.createElement("div");
    Object.assign(this.redDot.style, {
      position: "absolute",
      width: "10px",
      height: "10px",
      backgroundColor: "red",
      zIndex: "9999",
      pointerEvents: "none",
      borderRadius: "50%",
    });
    //document.body.appendChild(this.redDot);
  }

  /**
   * Initialisiert FaceLandmarker (Tasks Vision) und startet die Frame-Loop.
   */
  public async init() {
    this.tasksVision = await import("@mediapipe/tasks-vision");

    const { FilesetResolver, FaceLandmarker } = this.tasksVision;

    const visionFileset = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );

    this.faceLandmarker = await FaceLandmarker.createFromOptions(
      visionFileset,
      {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        },
        runningMode: "VIDEO",
        numFaces: 1,
        minFaceDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      }
    );

    await this.startLoop();
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
        if (
          !this.videoEl ||
          this.videoEl.videoWidth === 0 ||
          this.videoEl.videoHeight === 0 ||
          this.videoEl.paused
        ) {
          this.loopHandle = requestAnimationFrame(loop);
          return;
        }

        if (this.faceLandmarker) {
          if (typeof this.faceLandmarker.detectForVideo === "function") {
            const ts =
              performance && performance.now ? performance.now() : Date.now();
            const result = await this.faceLandmarker.detectForVideo(
              this.videoEl,
              ts
            );
            this.handleResult(result);
          } else if (typeof this.faceLandmarker.detect === "function") {
            const off = document.createElement("canvas");
            off.width = this.videoEl.videoWidth;
            off.height = this.videoEl.videoHeight;
            const ctx = off.getContext("2d");
            if (ctx) {
              ctx.drawImage(this.videoEl, 0, 0, off.width, off.height);
              const result = await this.faceLandmarker.detect(off);
              this.handleResult(result);
            }
          } else {
            throw new Error(
              "faceLandmarker has no detect/detectForVideo methods"
            );
          }
        }
      } catch (e: any) {
        console.error("FaceLandmarker detect error:", e);
        if (this.debugOverlay)
          this.debugOverlay.innerText = `FEHLER: ${e.name ?? "Error"}: ${
            e.message ?? e
          }`;
        const { teethModel, topLipMarker } = this.threeElements;
        if (teethModel) teethModel.visible = false;
        if (topLipMarker) topLipMarker.visible = false;
        this.isPitchCalibrated = false;

        if (e?.message?.includes?.("table index is out of bounds")) {
          try {
            if (
              this.faceLandmarker &&
              typeof this.faceLandmarker.close === "function"
            ) {
              this.faceLandmarker.close();
            }
          } catch (_) {}
          setTimeout(() => {
            console.warn(
              "Attempting to re-init faceLandmarker after WASM error (manual re-init recommended)."
            );
          }, 500);
        }
      } finally {
        this.loopHandle = requestAnimationFrame(loop);
      }
    };

    loop();
  }

  private handleResult(result: any) {
    const multiFaceLandmarks =
      result?.faceLandmarks ??
      result?.faceLandmarksList ??
      result?.multiFaceLandmarks ??
      null;

    const resultsLike: any = {
      multiFaceLandmarks:
        multiFaceLandmarks && multiFaceLandmarks.length
          ? multiFaceLandmarks
          : null,
    };

    if (this.running) {
      this.onResults(resultsLike);
    }
  }

  private onResults(results: any) {
    const { teethModel, jawBoneLower, pivot, topLipMarker, anchorGroup } =
      this.threeElements;
    const sliderStore = useSliderStore();

    if (!results?.multiFaceLandmarks || !teethModel || !pivot || !anchorGroup) {
      if (teethModel) teethModel.visible = false;
      if (topLipMarker) topLipMarker.visible = false;
      this.isPitchCalibrated = false;
      if (this.debugOverlay)
        this.debugOverlay.innerText = "Kein Gesicht erkannt";
      return;
    }

    try {
      teethModel.visible = true;
      if (topLipMarker) topLipMarker.visible = true;

      const lm = results.multiFaceLandmarks[0];

      if (!Array.isArray(lm) || lm.length === 0) {
        if (this.debugOverlay)
          this.debugOverlay.innerText = "FEHLER: ungültige Landmarks";
        return;
      }

      // ... (Rest der Tracking-Logik, die Pivot/AnchorGroup/jawBoneLower aktualisiert)
      const noseTip = lm[1];
      if (!noseTip) return;

      if (!this.isPitchCalibrated) {
        this.pitchCalibrationY = noseTip.y;
        this.isPitchCalibrated = true;
      }

      const topLip = lm[13];
      const bottomLip = lm[14];
      const mouthOpennessDistance = Math.abs(topLip.y - bottomLip.y);
      let opennessPercent = Math.min(
        1.0,
        mouthOpennessDistance / AR_CONFIG.OPENNESS_THRESHOLD
      );
      opennessPercent = Math.max(0.0, opennessPercent);

      const mouthCenter = new THREE.Vector3(
        topLip.x,
        topLip.y,
        (topLip.z + bottomLip.z) / 2
      );
      const mouthR = lm[308];
      const mouthL = lm[78];
      const mouthD = mouthR.x - mouthL.x;
      const depthScale = (sliderStore.sliderValue / 20) * Math.abs(mouthD);

      const targetPosition = new THREE.Vector3(
        (mouthCenter.x - 0.5) * 13.3,
        -(mouthCenter.y - 0.5) * 9.5 + 2 * depthScale,
        0
      );

      pivot.position.copy(targetPosition);

      if (depthScale <= 0 || !isFinite(depthScale)) {
        if (this.debugOverlay)
          this.debugOverlay.innerText =
            "FEHLER: Ungültiger Skalierungsfaktor (depthScale <= 0)";
        return;
      }

      pivot.scale.set(depthScale, depthScale, depthScale);

      if (topLipMarker) {
        topLipMarker.position.set(0, 0, 0);
      }

      const pLeft = lm[234];
      const pRight = lm[454];

      const yawDiffZ = pLeft.z - pRight.z;
      const yawDiffX = pLeft.x - pRight.x;

      const yawRadiansRaw = Math.atan2(yawDiffZ, yawDiffX);
      const maxYawDeg = AR_CONFIG.MAX_JAW_ROTATION_DEG;
      let yawTilt: number;

      if (yawRadiansRaw > 0) {
        yawTilt = -1 * (Math.PI - yawRadiansRaw) * (maxYawDeg / 0.6);
      } else {
        yawTilt = (yawRadiansRaw + Math.PI) * (maxYawDeg / 0.6);
      }

      anchorGroup.rotation.y = THREE.MathUtils.degToRad(yawTilt);

      const pTop = lm[10];
      const pBottom = lm[152];

      const diffZ = pTop.z - pBottom.z;
      const diffY = pTop.y - pBottom.y;

      const pitchRadiansRaw = Math.atan2(diffZ, diffY);
      const maxPitchDeg = AR_CONFIG.MAX_JAW_TILT_DEG;
      let pitchTilt: number;

      if (pitchRadiansRaw > 0) {
        pitchTilt = -1 * (Math.PI - pitchRadiansRaw) * (maxPitchDeg / 0.6);
      } else {
        pitchTilt = (pitchRadiansRaw + Math.PI) * (maxPitchDeg / 0.6);
      }

      anchorGroup.rotation.x = THREE.MathUtils.degToRad(pitchTilt);
      anchorGroup.rotation.z = 0;

      if (jawBoneLower) {
        jawBoneLower.rotation.x =
          -0.878365774778483 + opennessPercent * AR_CONFIG.MAX_ROTATION_RADIANS;
      }

      // ... (Red Dot Positionierung unverändert)
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      const aspect = this.videoEl.videoWidth / this.videoEl.videoHeight;
      const effectiveWidth =
        screenHeight >= screenWidth / aspect
          ? screenWidth
          : screenHeight * aspect;
      const effectiveHeight = effectiveWidth / aspect;
      const offsetX = (screenWidth - effectiveWidth) / 2;
      const offsetY = (screenHeight - effectiveHeight) / 2;

      if (this.redDot) {
        const mirroredX = 1.0 - topLip.x;

        this.redDot.style.left = `${(
          offsetX +
          mirroredX * effectiveWidth -
          5
        ).toFixed(0)}px`;
        this.redDot.style.top = `${(
          offsetY +
          topLip.y * effectiveHeight -
          5
        ).toFixed(0)}px`;
      }
    } catch (e: any) {
      console.error("Fehler bei der AR-Verarbeitung:", e);
      if (this.debugOverlay) {
        this.debugOverlay.innerText = `FEHLER: ${e.name}: ${e.message}`;
      }
      const { teethModel, topLipMarker } = this.threeElements;
      if (teethModel) teethModel.visible = false;
      if (topLipMarker) topLipMarker.visible = false;
      this.isPitchCalibrated = false;
    }
  }

  /**
   * **NEU:** Friert das 3D-Modell in der aktuellen Position ein und gibt den Mittelpunkt zurück.
   * @returns Die Weltposition des Pivot-Punktes (Zentrum der 3D-Welt im AR-Raum).
   */
  public freeze(): THREE.Vector3 | null {
    this.running = false;

    if (this.loopHandle !== null) {
      cancelAnimationFrame(this.loopHandle);
      this.loopHandle = null;
    }

    if (this.threeElements.pivot) {
      this.threeElements.pivot.updateWorldMatrix(true, false);

      const centerPosition = new THREE.Vector3();
      this.threeElements.pivot.getWorldPosition(centerPosition);

      console.log("AR-Tracking gestoppt. Modell-Zentrum:", centerPosition);
      return centerPosition;
    }

    console.warn("AR-Tracking gestoppt, aber Pivot-Objekt nicht gefunden.");
    return null;
  }

  /**
   * **NEUE METHODE:** Skaliert und positioniert das Pivot-Objekt (das gesamte 3D-Modell)
   * im Weltraum, um auf den Zielvektor zu zoomen.
   * @param targetZoomLevel Der gewünschte neue Zoom-Faktor (z.B. 2.0 für 2x Zoom).
   * @param time Die Dauer der Animation in Sekunden.
   * @param centerVector Der Weltvektor (THREE.Vector3) des Punkts, der zentriert werden soll (von `freeze()` zurückgegeben).
   */
  // ARControllerTasksVision.ts (innerhalb der ARController Klasse)

  public zoom(
    targetZoomLevel: number,
    time: number,
    centerVector: THREE.Vector3
  ) {
    const { pivot } = this.threeElements;

    if (!pivot) {
      console.warn("Pivot-Objekt nicht gefunden, Zoom nicht möglich.");
      return;
    }

    // 1. ZIELPOSITION DES PIVOT BERECHNEN:
    const targetX = centerVector.x;
    const targetY = centerVector.y;

    // **KORREKTUR:** Z-Position auf 0 setzen, da die Zentrierung nur in X/Y erfolgen soll.
    // Wir animieren die Position des PIVOT in der Szene, wo die Kamera bei Z=10 ist.
    // Die Z-Koordinate des PIVOT sollte auf ihrem letzten gültigen Wert bleiben (der in onResults auf 0 gesetzt wurde).
    const targetZ = pivot.position.z; // Letzten gültigen Wert beibehalten (wahrscheinlich 0)

    // ... (Skalierung bleibt korrekt)
    const currentBaseScale = pivot.scale.x;
    const finalTargetScale = currentBaseScale * targetZoomLevel;

    // 2. GSAP Animation starten

    // Animation der Position (Zentrierung)
    gsap.to(pivot.position, {
      x: targetX,
      y: targetY,
      z: targetZ, // Stellt sicher, dass Z nicht unerwartet verschoben wird
      duration: time,
      ease: "power2.inOut",
    });

    // ... (Skalierung bleibt gleich)
    gsap.to(pivot.scale, {
      x: finalTargetScale,
      y: finalTargetScale,
      z: finalTargetScale,
      duration: time,
      ease: "power2.inOut",
    });

    console.log(
      `ARController: Zoome von ${currentBaseScale.toFixed(
        2
      )} auf Skala ${finalTargetScale.toFixed(2)}.`
    );
  }

  /**
   * Stoppt Loop und räumt auf (ursprüngliche `stop`-Methode)
   */
  public stop() {
    this.running = false;
    if (this.loopHandle !== null) {
      cancelAnimationFrame(this.loopHandle);
      this.loopHandle = null;
    }

    if (
      this.faceLandmarker &&
      typeof this.faceLandmarker.close === "function"
    ) {
      try {
        this.faceLandmarker.close();
      } catch (e) {
        // ignore
      }
    }

    if (this.debugOverlay) {
      this.debugOverlay.remove();
      this.debugOverlay = null;
    }
    if (this.redDot) {
      this.redDot.remove();
      this.redDot = null;
    }
  }
}
