// composables/constants.ts

import * as THREE from "three";

/**
 * Globale Konstanten für die AR-Anwendung.
 */

// Knochennamen (MÜSSEN an dein 3D-Modell angepasst werden!)
export const BONE_NAME_LOWER = "bottomBone2";
export const BONE_NAME_UPPER = "topBone2";

// AR-Kalibrierung (muss experimentell angepasst werden)
export const AR_CONFIG = {
  MAX_ROTATION_RADIANS: THREE.MathUtils.degToRad(50),
  OPENNESS_THRESHOLD: 0.1,
  MAX_JAW_ROTATION_DEG: 40,
  MAX_JAW_TILT_DEG: 27,
  UPPER_JAW_INITIAL_OFFSET_DEG: 30,
  LOWER_JAW_INITIAL_OFFSET_DEG: -27,
  SCALE: 1.6,
};
export const ROTTEN_BASECOLOR_URL = "/models/textures/rottenTeeth_color.webp";
// Pfad zum 3D-Modell
export const MODEL_URL = "/models/dental5.glb";
