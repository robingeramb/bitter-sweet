import * as THREE from "three";
import { camera, scene } from "@/composables/useThree";
import { spotLight } from "@/composables/createLights";

export const activateProductView = (clickedObject) => {
  // KORREKTUR: Positioniere das Produkt direkt vor der aktuellen Kameraansicht.
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  const distance = 1.5; // Abstand des Produkts von der Kamera
  const productPosition = camera.position.clone().add(forward.multiplyScalar(distance));

  clickedObject.position.copy(productPosition);

  spotLight.intensity = 4;
  spotLight.target = clickedObject; // Das Ziel ist das Objekt, das beleuchtet werden soll
  spotLight.position.copy(camera.position); // Lichtquelle von der Kameraposition

  let defaultRotation = 0;
  if (clickedObject.userData.rotation) {
    defaultRotation = clickedObject.userData.rotation;
  }

  // KORREKTUR: Richte das Produkt zur Kamera aus.
  // Wir setzen die Rotation so, dass es den Spieler direkt ansieht.
  if (clickedObject.isMesh) {
    clickedObject.lookAt(camera.position);
    clickedObject.rotation.x = 0; // Optional: Rotation auf X-Achse zurücksetzen
  } else {
    clickedObject.lookAt(camera.position);
  }

  scene.add(clickedObject);
};
