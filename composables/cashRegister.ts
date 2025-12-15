import * as THREE from "three";
import { useVariablesStore } from "~/stores/store";
import { camera, taskDone, endScreen } from "@/composables/useThree";
// Wichtig: GSAP für die Animation importieren
import { gsap } from "gsap";

let clickedObject;
const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const CAMERA_DISTANCE_OFFSET = 0.6;
const RECEIPT_CAMERA_DISTANCE_OFFSET = 0.14;
const CAMERA_ANGLE_DEG = 180;
export let cashCounter: any;

/**
 * * @param event
 * @param selectedCheckout
 */
export function clickCheckout(event, selectedCheckout) {
  const variablesStore = useVariablesStore();
  mouse.x = 0;
  mouse.y = 0;
  cashCounter = selectedCheckout;
  raycaster.setFromCamera(mouse, camera);
  let intersects = raycaster.intersectObjects([selectedCheckout], true);
  if (intersects.length > 0) {
    clickedObject = selectedCheckout;
    let focusObject = clickedObject.getObjectByName("Display");
    if (!focusObject) {
      console.warn(
        "Display object not found. Falling back to parent object position."
      );
      focusObject = clickedObject;
    }
    variablesStore.updatePlayerMotion(false);
    const objectPos = new THREE.Vector3();
    focusObject.getWorldPosition(objectPos);

    const angleRad = (CAMERA_ANGLE_DEG * Math.PI) / 180;
    const targetX = objectPos.x + CAMERA_DISTANCE_OFFSET * Math.cos(angleRad);
    const targetZ = objectPos.z + CAMERA_DISTANCE_OFFSET * Math.sin(angleRad);
    const targetY = camera.position.y;

    gsap.to(camera.position, {
      x: targetX,
      z: targetZ,
      duration: 1.8, // Dauer der Kamerabewegung in Sekunden
      ease: "power2.inOut", // Sanfter Start und Ende
      onUpdate: () => {
        // Die Kamera soll während der gesamten Bewegung kontinuierlich auf das Objekt blicken.
        camera.lookAt(objectPos);
      },
      onComplete: () => {
        camera.lookAt(objectPos);
        if (taskDone.value == true) {
          endScreen.value = true;
        }
      },
    });
  }
}

export function recieptPrint(selectedCheckout) {
  const variablesStore = useVariablesStore();
  mouse.x = 0;
  mouse.y = 0;

  clickedObject = selectedCheckout;

  let focusObject = clickedObject.getObjectByName("paperPosition");

  const objectPos = new THREE.Vector3();
  focusObject.getWorldPosition(objectPos);

  const angleRad = (CAMERA_ANGLE_DEG * Math.PI) / 180;
  const targetX =
    objectPos.x + RECEIPT_CAMERA_DISTANCE_OFFSET * Math.cos(angleRad);
  const targetZ =
    objectPos.z + RECEIPT_CAMERA_DISTANCE_OFFSET * Math.sin(angleRad);
  const targetY = objectPos.y + RECEIPT_CAMERA_DISTANCE_OFFSET / 2;

  gsap.to(camera.position, {
    x: targetX,
    y: targetY,
    z: targetZ,
    duration: 1.8, // Dauer der Kamerabewegung in Sekunden
    ease: "power2.inOut", // Sanfter Start und Ende
    onUpdate: () => {
      // Die Kamera soll während der gesamten Bewegung kontinuierlich auf das Objekt blicken.
      //camera.lookAt(objectPos);
    },
    onComplete: () => {
      //camera.lookAt(objectPos);
      if (taskDone.value == true) {
        endScreen.value = true;
      }
    },
  });
}
