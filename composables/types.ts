import * as THREE from "three";

/**
 * Enthält alle initialisierten THREE.js-Elemente, auf die extern zugegriffen wird.
 */
export interface ThreeElements {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
  teethModel: THREE.Group | null;
  jawBoneLower: THREE.Bone | null;
  jawBoneUpper: THREE.Bone | null;
  pivot: THREE.Group;
  anchorGroup: THREE.Group;
  topLipMarker: THREE.Mesh | null;
}

/**
 * Verwaltet den Zustand für das Texture-Blending und die Animation.
 */
export interface BlendingState {
  blendUniform: { value: number };
  rottenBaseColorMap: THREE.Texture | null;

  isAnimating: boolean;
  animationStartTime: number | null;
  animationDuration: number;
  startRoughness: number;
  endRoughness: number;
  startColor: THREE.Color;
  endColor: THREE.Color;
  targetMaterial: THREE.MeshStandardMaterial | null;
}
