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
  private textureLoader = new THREE.TextureLoader();
  private isWarmedUp: boolean = false;

  // NEU: Diese Variable hält die Kamera, die aktuell gerendert wird
  private activeCamera: THREE.Camera;

  constructor(canvas: HTMLCanvasElement) {
    this.container = canvas.parentElement!;

    const pivot = new THREE.Group();
    const anchorGroup = new THREE.Group();
    pivot.add(anchorGroup);

    const aspect = this.container.clientWidth / this.container.clientHeight;
    const effectiveFrustumSize = this.frustumSize / this.currentZoomLevel;

    // Initialisierung der OrthographicCamera
    const orthoCam = new THREE.OrthographicCamera(
      (-effectiveFrustumSize * aspect) / 2,
      (effectiveFrustumSize * aspect) / 2,
      effectiveFrustumSize / 2,
      -effectiveFrustumSize / 2,
      0.1,
      2000
    );

    this.elements = {
      scene: new THREE.Scene(),
      camera: orthoCam,
      renderer: new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      }),
      teethModel: null,
      jawBoneLower: null,
      jawBoneUpper: null,
      pivot: pivot,
      anchorGroup: anchorGroup,
      topLipMarker: null,
      // NEU: Callback für den ARController zum Kamera-Wechsel
      setCamera: (newCam: THREE.Camera) => {
        this.activeCamera = newCam;
      },
    };

    // Standardmäßig ist die Ortho-Kamera aktiv
    this.activeCamera = this.elements.camera;

    this.blendingState = {
      blendUniform: { value: 0.0 },
      rottenBaseColorMap: null,
      isAnimating: false,
      animationStartTime: 0,
      animationDuration: 4000,
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
    // Nur anwenden, wenn wir noch im Ortho-Modus sind
    if (this.activeCamera instanceof THREE.OrthographicCamera) {
      const camera = this.activeCamera;
      const aspect = this.container.clientWidth / this.container.clientHeight;
      const effectiveFrustumSize = this.frustumSize / this.currentZoomLevel;

      camera.left = (-effectiveFrustumSize * aspect) / 2;
      camera.right = (effectiveFrustumSize * aspect) / 2;
      camera.top = effectiveFrustumSize / 2;
      camera.bottom = -effectiveFrustumSize / 2;
      camera.updateProjectionMatrix();
    }
  }

  public async warmUp() {
    if (this.isWarmedUp || !this.elements.teethModel) return;
    const { renderer, scene } = this.elements;

    const originalVisibility = this.elements.teethModel.visible;
    this.elements.teethModel.visible = true;

    renderer.compile(scene, this.activeCamera);
    renderer.render(scene, this.activeCamera);

    this.elements.teethModel.visible = originalVisibility;
    this.isWarmedUp = true;
  }

  public async loadModel(
    onProgress: (percent: number) => void
  ): Promise<ThreeElements> {
    const loadTexture = new Promise<void>((resolve, reject) => {
      this.textureLoader.load(
        ROTTEN_BASECOLOR_URL,
        (texture) => {
          texture.flipY = false;
          texture.colorSpace = THREE.SRGBColorSpace;
          this.blendingState.rottenBaseColorMap = texture;
          resolve();
        },
        undefined,
        reject
      );
    });

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

    teethModel.scale.set(AR_CONFIG.SCALE, AR_CONFIG.SCALE, AR_CONFIG.SCALE);
    const box = new THREE.Box3().setFromObject(teethModel);
    const center = new THREE.Vector3();
    box.getCenter(center);

    teethModel.position.set(-center.x, -box.max.y, -box.max.z);
    this.elements.anchorGroup.add(teethModel);
    teethModel.visible = false;

    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(AR_CONFIG.SCALE * 0.1, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff0000, visible: false }) // Marker meist unsichtbar
    );
    this.elements.anchorGroup.add(marker);
    this.elements.topLipMarker = marker;

    await this.warmUp();
    return this.elements;
  }

  public startAnimation() {
    const state = this.blendingState;
    if (state.targetMaterial) {
      state.startRoughness = state.targetMaterial.roughness;
      state.startColor.copy(state.targetMaterial.color);
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
      t = t * t * (3 - 2 * t);
      state.blendUniform.value = t;

      const material = state.targetMaterial;
      material.roughness = THREE.MathUtils.lerp(
        state.startRoughness,
        state.endRoughness,
        t
      );
      material.color.lerpColors(state.startColor, state.endColor, t);

      if (t >= 1) state.isAnimating = false;
    }

    // WICHTIG: Immer mit der activeCamera rendern
    this.elements.renderer.render(this.elements.scene, this.activeCamera);
  };

  public resize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.elements.renderer.setSize(width, height);

    if (this.activeCamera instanceof THREE.PerspectiveCamera) {
      this.activeCamera.aspect = width / height;
      this.activeCamera.updateProjectionMatrix();
    } else {
      this.applyZoom();
    }
  }

  public dispose() {
    this.elements.renderer.dispose();
    this.blendingState.rottenBaseColorMap?.dispose();
  }
}
