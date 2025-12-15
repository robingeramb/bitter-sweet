import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// Lokale Imports
import {
  BONE_NAME_LOWER,
  BONE_NAME_UPPER,
  AR_CONFIG,
  MODEL_URL,
  ROTTEN_BASECOLOR_URL,
} from "./constants";
// Korrektur: Verwendung von 'import type' für Interfaces
import type { ThreeElements, BlendingState } from "./types";
import { setupMaterialBlending } from "./materialUtils";
import gsap from "gsap";

// --- HAUPTKLASSE ---

export class ThreeJSManager {
  private container: HTMLElement;
  private elements: ThreeElements;
  private blendingState: BlendingState;

  // NEU: Variablen für die Zoom-Steuerung
  private currentZoomLevel: number = 1.0;
  private frustumSize: number = 10;
  private textureLoader = new THREE.TextureLoader();

  /**
   * Initialisiert den ThreeJSManager.
   * @param canvas Das HTMLCanvasElement, in dem die Szene gerendert wird.
   */
  constructor(canvas: HTMLCanvasElement) {
    this.container = canvas.parentElement!;

    // Wir verwenden jetzt drei Gruppen für die korrekte Rotationshierarchie:
    // 1. Scene -> Pivot (Positionierung in der AR-Welt)
    // 2. Pivot -> AnchorGroup (Rotation um den Ankerpunkt)
    // 3. AnchorGroup -> teethModel
    const pivot = new THREE.Group();
    const anchorGroup = new THREE.Group(); // Wird nun rotiert
    pivot.add(anchorGroup);
    const aspect = this.container.clientWidth / this.container.clientHeight;

    // Frustum-Größen initial berechnen (basierend auf currentZoomLevel = 1.0)
    const effectiveFrustumSize = this.frustumSize / this.currentZoomLevel;

    this.elements = {
      scene: new THREE.Scene(),

      camera: new THREE.OrthographicCamera(
        (-effectiveFrustumSize * aspect) / 2, // left
        (effectiveFrustumSize * aspect) / 2, // right
        effectiveFrustumSize / 2, // top
        -effectiveFrustumSize / 2, // bottom
        0.1, // near
        1000 // far
      ),
      renderer: new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true,
      }),
      teethModel: null,
      jawBoneLower: null,
      jawBoneUpper: null,
      pivot: pivot,
      anchorGroup: anchorGroup, // Jetzt in den Elementen
      topLipMarker: null,
    };

    this.blendingState = {
      blendUniform: { value: 0.0 },
      rottenBaseColorMap: null,
      isAnimating: false,
      animationStartTime: null,
      animationDuration: 4000,
      startRoughness: 0.5,
      endRoughness: 0.8,
      startColor: new THREE.Color(),
      endColor: new THREE.Color(0.7, 0.7, 0.7),
      targetMaterial: null,
    };

    this.initRenderer();
    this.initLights();
    this.initCamera(); // Ruft jetzt applyZoom() auf

    // Pivot (mit angehängter AnchorGroup) zur Szene hinzufügen
    this.elements.scene.add(this.elements.pivot);

    this.animate(0);
  }

  private initRenderer() {
    this.elements.renderer.setSize(
      this.container.clientWidth,
      this.container.clientHeight
    );
    this.elements.renderer.setPixelRatio(window.devicePixelRatio);
  }

  private initLights() {
    this.elements.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 3);
    directionalLight.position.set(0, 10, 10);
    this.elements.scene.add(directionalLight);
  }

  private initCamera() {
    // Z-Position wird gesetzt, beeinflusst den Zoom aber nicht.
    this.elements.camera.position.z = 10;
    // NEU: Frustum-Parameter werden initial angewendet
    this.applyZoom();
  }

  /**
   * WENDET DEN AKTUELLEN ZOOM-LEVEL AUF DIE ORTHOGRAFISCHE KAMERA AN.
   */
  private applyZoom() {
    const camera = this.elements.camera;
    const aspect = this.container.clientWidth / this.container.clientHeight;

    // Die effektive Frustum-Größe wird durch den Zoom-Level bestimmt.
    // Zoom-Level 2.0 halbiert die Größe -> Verdopplung des Zooms (Zoom In).
    const effectiveFrustumSize = this.frustumSize / this.currentZoomLevel;

    camera.left = (-effectiveFrustumSize * aspect) / 2;
    camera.right = (effectiveFrustumSize * aspect) / 2;
    camera.top = effectiveFrustumSize / 2;
    camera.bottom = -effectiveFrustumSize / 2;

    camera.updateProjectionMatrix();
  }

  /**
   * Lädt das 3D-Modell und die Blending-Textur asynchron.
   * @param onProgress Callback für den Ladefortschritt.
   * @returns Eine Promise, die die initialisierten Elemente zurückgibt.
   */
  public loadModel(
    onProgress: (percent: number) => void
  ): Promise<ThreeElements> {
    // 1. Rotten BaseColor Map laden
    const loadRottenTexture = new Promise<void>((resolve, reject) => {
      this.textureLoader.load(
        ROTTEN_BASECOLOR_URL,
        (texture) => {
          // --- FIX FÜR MAPPING/FARBE ---
          texture.flipY = false;
          texture.wrapS = THREE.ClampToEdgeWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;
          texture.colorSpace = THREE.SRGBColorSpace;
          // -----------------------------

          this.blendingState.rottenBaseColorMap = texture;
          resolve();
        },
        undefined,
        (error) => {
          console.error("Fehler beim Laden der Rotten BaseColor:", error);
          reject(error);
        }
      );
    });

    // 2. Hauptmodell laden
    const loadMainModel = new Promise<THREE.Group>((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.load(
        MODEL_URL,
        (gltf) => {
          resolve(gltf.scene);
        },
        (xhr) => {
          onProgress((xhr.loaded / xhr.total) * 100);
        },
        (error) => {
          console.error("Fehler beim Laden des 3D-Modells:", error);
          reject(error);
        }
      );
    });

    // 3. Beides parallel ausführen und die Szene vorbereiten
    return Promise.all([loadRottenTexture, loadMainModel]).then(
      ([_, teethModel]) => {
        this.elements.teethModel = teethModel;

        teethModel.traverse((child: any) => {
          if (child.isMesh && child.material) {
            const material = child.material as THREE.Material;

            // Finde das Material für die Zähne/Zunge (Annahme: Name enthält "teeth_tongue")
            if (
              material.name &&
              material.name.toLowerCase().includes("teeth_tongue")
            ) {
              // Klone das Material und wende das Blending-Utility an
              const meshMaterial =
                material.clone() as THREE.MeshStandardMaterial;
              child.material = meshMaterial;
              setupMaterialBlending(meshMaterial, this.blendingState);
            }
          }
          if (child.isBone) {
            if (child.name === BONE_NAME_LOWER) {
              this.elements.jawBoneLower = child;
            }
            if (child.name === BONE_NAME_UPPER) {
              this.elements.jawBoneUpper = child;
            }
          }
        });

        // Positionierung und Skalierung des Modells
        this.elements.teethModel.scale.set(1, 1, 1);
        this.elements.teethModel.updateMatrixWorld();

        const box = new THREE.Box3().setFromObject(this.elements.teethModel);
        const center = new THREE.Vector3();
        box.getCenter(center);

        // --- NEUE LOGIK FÜR ROTATION UM DEN ANKERPUNKT ---
        // Verschiebe das Modell so, dass der Ankerpunkt (oben, vorne, Mitte) im Ursprung
        // der AnchorGroup (Elternobjekt) liegt.
        this.elements.teethModel.position.x = -center.x; // Mitte
        this.elements.teethModel.position.y = -box.max.y; // Oberkante (Rotation)
        this.elements.teethModel.position.z = -box.max.z; // Vorderkante (Rotation)
        // ------------------------------------------------

        this.elements.teethModel.scale.set(
          AR_CONFIG.SCALE,
          AR_CONFIG.SCALE,
          AR_CONFIG.SCALE
        );

        // AnchorGroup ist die Rotationsgruppe. Sie selbst bleibt bei 0,0,0 im Pivot.
        this.elements.anchorGroup.position.set(0, 0, 0);
        this.elements.anchorGroup.scale.set(1, 1, 1);

        this.elements.anchorGroup.add(this.elements.teethModel);
        this.elements.teethModel.visible = false;

        // Debug-Marker für den Ankerpunkt
        const markerGeometry = new THREE.SphereGeometry(
          AR_CONFIG.SCALE * 0.1,
          8,
          8
        );
        const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);

        // Der Marker wird nun am Zentrum der AnchorGroup platziert (das ist der Rotationspunkt!)
        marker.position.set(0, 0, 0);
        this.elements.anchorGroup.add(marker);
        this.elements.topLipMarker = marker;

        return this.elements;
      }
    );
  }

  /**
   * Startet die Texture-Blending-Animation.
   */
  public triggerRottingTransition() {
    if (!this.blendingState.isAnimating) {
      this.blendingState.isAnimating = true;
      this.blendingState.animationStartTime = performance.now();
    }
  }

  /**
   * Die Haupt-Animationsschleife.
   */
  private animate = (time: number) => {
    requestAnimationFrame(this.animate);

    if (this.blendingState.isAnimating && this.blendingState.targetMaterial) {
      const material = this.blendingState.targetMaterial;
      const state = this.blendingState;

      const elapsedTime = time - state.animationStartTime!;
      // Ease-In/Out Funktion (Smootherstep)
      let t = elapsedTime / state.animationDuration;
      t = t * t * (3.0 - 2.0 * t);
      t = Math.min(Math.max(t, 0.0), 1.0);

      // 1. Shader-Uniform (Blending) aktualisieren
      state.blendUniform.value = t;

      // 2. Materialeigenschaften interpolieren
      const newRoughness =
        state.startRoughness + (state.endRoughness - state.startRoughness) * t;
      material.roughness = newRoughness;
      material.color.lerpColors(state.startColor, state.endColor, t);

      // 3. Animation beenden
      if (elapsedTime >= state.animationDuration) {
        state.isAnimating = false;
        state.blendUniform.value = 1.0;
        material.roughness = state.endRoughness;
        material.color.copy(state.endColor);
      }
    }

    this.elements.renderer.render(this.elements.scene, this.elements.camera);
  };

  /**
   * Passt die Render-Größe und Kamera an die Container-Größe an.
   */
  public resize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.elements.renderer.setSize(width, height);

    // Orthografische Kamera: Frustum-Parameter neu berechnen
    this.applyZoom();
  }

  /**
   * ÄNDERT DEN ZOOM-LEVEL DER ORTHOGRAFISCHEN KAMERA.
   * @param targetZoomLevel Der gewünschte neue Zoom-Faktor (z.B. 2.0 für 2x Zoom).
   */
  public zoom(
    targetZoomLevel: number,
    time: number,
    centerVector: THREE.Vector3
  ) {
    console.log(
      "Zoom to level:",
      targetZoomLevel,
      "Centering on:",
      centerVector
    );

    // Zielposition der Kamera ist die Weltposition des gewünschten Mittelpunkts.
    // Wenn die Kamera sich zu (X, Y) bewegt, schaut sie genau auf diesen Punkt.
    const targetX = centerVector.x;
    const targetY = centerVector.y;

    // Wir animieren zwei Dinge gleichzeitig:
    // 1. Die interne Zoom-Variable (currentZoomLevel)
    // 2. Die Position der Kamera (camera.position.x und camera.position.y)

    // Animation des Zoom-Levels (aktualisiert die Frustum-Größe)
    gsap.to(this, {
      currentZoomLevel: targetZoomLevel,
      duration: time,
      ease: "power2.inOut",
      // Nach jeder Aktualisierung die Kamera-Projektionsmatrix neu berechnen
      onUpdate: () => {
        this.applyZoom();
      },
    });

    // Animation der Kamera-Position (zentriert den gewünschten Vektor)
    gsap.to(this.elements.camera.position, {
      x: targetX,
      y: targetY,
      duration: time,
      ease: "power2.inOut",
      // Es ist nicht notwendig, onUpdate hier zu verwenden, da updateProjectionMatrix
      // nur die Frustum-Größe und nicht die Position der Kamera betrifft.
      // Die THREE.js-Renderer-Schleife (in animate) rendert die neue Position automatisch.
    });
  }

  /**
   * Gibt die THREE.js-Elemente zurück.
   */
  public getElements(): ThreeElements {
    return this.elements;
  }

  /**
   * Gibt den Renderer und das Canvas frei.
   */
  public dispose() {
    this.elements.renderer.dispose();
  }
  public freeze(): THREE.Vector3 {
    // Stoppe die Animation, falls sie läuft
    this.blendingState.isAnimating = false;

    // Berechne die zentrale Position des Modells
    const box = new THREE.Box3().setFromObject(this.elements.teethModel);
    const center = new THREE.Vector3();
    box.getCenter(center);

    // Setze die Position des Modells auf die aktuelle Position
    this.elements.teethModel.position.copy(center);

    return center;
  }
}
/**
 * Stoppt das Modell an der aktuellen Position und gibt die zentrale Position zurück.
 * @returns Die zentrale Position des Modells als THREE.Vector3.
 */
