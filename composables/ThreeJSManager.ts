// ThreeJSManager.ts
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  BONE_NAME_LOWER,
  BONE_NAME_UPPER,
  AR_CONFIG,
  MODEL_URL,
  ROTTEN_BASECOLOR_URL,
} from "./constants";
import type { ThreeElements, BlendingState } from "./types";
import { setupMaterialBlending } from "./materialUtils";
import gsap from "gsap";

export class ThreeJSManager {
  private container: HTMLElement;
  private elements: ThreeElements;
  private blendingState: BlendingState;
  private currentZoomLevel: number = 1.0;
  private frustumSize: number = 10;
  private time = 4;
  private textureLoader = new THREE.TextureLoader();
  private isWarmedUp: boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    this.container = canvas.parentElement!;

    const pivot = new THREE.Group();
    const anchorGroup = new THREE.Group();
    pivot.add(anchorGroup);

    const aspect = this.container.clientWidth / this.container.clientHeight;
    const effectiveFrustumSize = this.frustumSize / this.currentZoomLevel;

    this.elements = {
      scene: new THREE.Scene(),
      camera: new THREE.OrthographicCamera(
        (-effectiveFrustumSize * aspect) / 2,
        (effectiveFrustumSize * aspect) / 2,
        effectiveFrustumSize / 2,
        -effectiveFrustumSize / 2,
        0.1,
        1000
      ),
      renderer: new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance", // Fordert die dedizierte GPU an
      }),
      teethModel: null,
      jawBoneLower: null,
      jawBoneUpper: null,
      pivot: pivot,
      anchorGroup: anchorGroup,
      topLipMarker: null,
    };

    this.blendingState = {
      blendUniform: { value: 0.0 },
      rottenBaseColorMap: null,
      isAnimating: false,
      animationStartTime: 0,
      animationDuration: 4000, // ms
      startRoughness: 0.5,
      endRoughness: 0.8,
      startColor: new THREE.Color(),
      endColor: new THREE.Color(0.7, 0.7, 0.7),
      targetMaterial: null,
    };

    this.initRenderer();
    this.initLights();
    this.initCamera();
    this.elements.scene.add(this.elements.pivot);
    this.animate();
  }

  private initRenderer() {
    const renderer = this.elements.renderer;
    renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Begrenzung auf 2 für Performance
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  private initLights() {
    this.elements.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 3);
    directionalLight.position.set(0, 10, 10);
    this.elements.scene.add(directionalLight);
  }

  private initCamera() {
    this.elements.camera.position.z = 10;
    this.applyZoom();
  }

  private applyZoom() {
    const { camera } = this.elements;
    const aspect = this.container.clientWidth / this.container.clientHeight;
    const effectiveFrustumSize = this.frustumSize / this.currentZoomLevel;

    camera.left = (-effectiveFrustumSize * aspect) / 2;
    camera.right = (effectiveFrustumSize * aspect) / 2;
    camera.top = effectiveFrustumSize / 2;
    camera.bottom = -effectiveFrustumSize / 2;
    camera.updateProjectionMatrix();
  }

  /**
   * NEU: GPU Warm-up Funktion.
   * Compiliert Shader und lädt Texturen vorab hoch.
   */
  public async warmUp() {
    if (this.isWarmedUp || !this.elements.teethModel) return;

    const { renderer, scene, camera, teethModel } = this.elements;

    // 1. Sichtbarkeit kurz erzwingen, damit der Renderer das Modell beachtet
    const originalVisibility = teethModel.visible;
    teethModel.visible = true;

    // 2. Shader Vorkompilierung
    renderer.compile(scene, camera);

    // 3. Texture Upload erzwingen (Null-Frame Rendering)
    renderer.render(scene, camera);

    // 4. Zurücksetzen
    teethModel.visible = originalVisibility;
    this.isWarmedUp = true;

    console.log("ThreeJS GPU Warm-up complete.");
  }

  public async loadModel(
    onProgress: (percent: number) => void
  ): Promise<ThreeElements> {
    // Textur-Lade-Promise
    const loadTexture = new Promise<void>((resolve, reject) => {
      this.textureLoader.load(
        ROTTEN_BASECOLOR_URL,
        (texture) => {
          texture.flipY = false;
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.minFilter = THREE.LinearFilter; // Performance: Kein Mipmapping nötig bei festem Abstand
          this.blendingState.rottenBaseColorMap = texture;
          resolve();
        },
        undefined,
        reject
      );
    });

    // Modell-Lade-Promise
    const loader = new GLTFLoader();
    const loadMainModel = new Promise<THREE.Group>((resolve, reject) => {
      loader.load(
        MODEL_URL,
        (gltf) => resolve(gltf.scene),
        (xhr) => onProgress((xhr.loaded / xhr.total) * 100),
        reject
      );
    });

    const [_, teethModel] = await Promise.all([loadTexture, loadMainModel]);

    this.elements.teethModel = teethModel;

    teethModel.traverse((child: any) => {
      if (child.isMesh && child.material) {
        if (child.material.name.toLowerCase().includes("teeth_tongue")) {
          const meshMaterial =
            child.material.clone() as THREE.MeshStandardMaterial;
          child.material = meshMaterial;
          setupMaterialBlending(meshMaterial, this.blendingState);
        }
      }
      if (child.isBone) {
        if (child.name === BONE_NAME_LOWER) this.elements.jawBoneLower = child;
        if (child.name === BONE_NAME_UPPER) this.elements.jawBoneUpper = child;
      }
    });

    // Modell-Setup (Ankerpunkt-Logik)
    teethModel.scale.set(AR_CONFIG.SCALE, AR_CONFIG.SCALE, AR_CONFIG.SCALE);
    const box = new THREE.Box3().setFromObject(teethModel);
    const center = new THREE.Vector3();
    box.getCenter(center);

    teethModel.position.set(-center.x, -box.max.y, -box.max.z);
    this.elements.anchorGroup.add(teethModel);
    teethModel.visible = false;

    // Debug Marker
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(AR_CONFIG.SCALE * 0.1, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    this.elements.anchorGroup.add(marker);
    this.elements.topLipMarker = marker;

    // Direkt nach dem Laden aufwärmen
    await this.warmUp();

    return this.elements;
  }

  public startAnimation(material?: THREE.MeshStandardMaterial) {
    const state = this.blendingState;

    if (material) {
      state.targetMaterial = material;
      state.startRoughness = material.roughness;
      state.startColor.copy(material.color);
    }

    state.blendUniform.value = 0;
    state.animationStartTime = performance.now();
    state.isAnimating = true;
  }

  private animate = () => {
    requestAnimationFrame(this.animate);

    const state = this.blendingState;

    if (state.isAnimating && state.targetMaterial) {
      const now = performance.now();
      const elapsed = now - state.animationStartTime;

      let t = Math.min(elapsed / state.animationDuration, 1);
      // Smoothstep
      t = t * t * (3 - 2 * t);

      state.blendUniform.value = t;

      const material = state.targetMaterial;
      material.roughness = THREE.MathUtils.lerp(
        state.startRoughness,
        state.endRoughness,
        t
      );
      material.color.lerpColors(state.startColor, state.endColor, t);

      if (t >= 1) {
        state.isAnimating = false;
      }
    }

    this.elements.renderer.render(this.elements.scene, this.elements.camera);
  };

  public zoom(
    targetZoomLevel: number,
    time: number,
    centerVector: THREE.Vector3
  ) {
    gsap.to(this, {
      currentZoomLevel: targetZoomLevel,
      duration: time,
      ease: "power2.inOut",
      onUpdate: () => this.applyZoom(),
    });

    gsap.to(this.elements.camera.position, {
      x: centerVector.x,
      y: centerVector.y,
      duration: time,
      ease: "power2.inOut",
    });
  }

  public resize() {
    this.elements.renderer.setSize(
      this.container.clientWidth,
      this.container.clientHeight
    );
    this.applyZoom();
  }

  public dispose() {
    this.elements.renderer.dispose();
    if (this.blendingState.rottenBaseColorMap)
      this.blendingState.rottenBaseColorMap.dispose();
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
