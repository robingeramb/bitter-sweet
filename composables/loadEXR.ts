import * as THREE from "three";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";
import { loadingManager } from "./useThree";

let exrLoader: EXRLoader | null = null;
function getLoader() {
  if (!exrLoader) exrLoader = new EXRLoader(loadingManager);
  return exrLoader;
}

export function loadEXR(path: string): Promise<any> {
  return new Promise((resolve, reject) => {
    getLoader().load(
      `/models/globallights/${path}`,
      (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping; // Für Reflexionen
        //scene.environment = texture;
        resolve(texture);
      },
      undefined, // Fortschrittsanzeige, falls gewünscht
      (error) => {
        console.error("An error occurred while loading the model:", error);
        reject(error); // Fehler an die Promise weitergeben
      }
    );
  });
}
