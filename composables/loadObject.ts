import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { loadingManager } from "./useThree";

// KORREKTUR: Initialisiere den Loader erst bei Bedarf, um zirkuläre Abhängigkeiten zu vermeiden.
let loader: GLTFLoader | null = null;
function getLoader() {
  if (!loader) loader = new GLTFLoader(loadingManager);
  return loader;
}
let models = {};

export function loadModel(name: string): Promise<any> {
  if (models[name]) {
    let newModel = models[name].clone();
    newModel.position.copy(models[name].position.clone());
    newModel.rotation.copy(models[name].rotation.clone());
    newModel.scale.set(1, 1, 1);
    return Promise.resolve(newModel);
  }

  return new Promise((resolve, reject) => {
    getLoader().load(
      `/models/${name}`, // Pfad zum GLB-Modell
      (gltf) => {
        const model = gltf.scene;
        model.castShadow = true;
        model.receiveShadow = true;
        models[name] = model;
        resolve(model); // Modell wird erfolgreich zurückgegeben
      },
      undefined, // Fortschrittsanzeige, falls gewünscht
      (error) => {
        reject(error); // Fehler an die Promise weitergeben
      }
    );
  });
}
