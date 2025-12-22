import * as THREE from "three";
import { useVariablesStore } from "~/stores/store";
import { useShoppingCartStore } from "~/stores/store";
import {
  camera,
  taskDone,
  endScreen,
  unloadObjectsByDistance,
} from "@/composables/useThree";

import { startAnimation } from "@/composables/displayController";
// Wichtig: GSAP für die Animation importieren
import { gsap } from "gsap";

// NEU: Sound für die Kamerafahrt
const whooshSound =
  typeof Audio !== "undefined" ? new Audio("/sound/whoosh.mp3") : null;
if (whooshSound) whooshSound.volume = 0.5;

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
  if (!selectedCheckout) {
    console.log("No checkout selected");
    return;
  }
  const variablesStore = useVariablesStore();

  // NEU: Die Kasse ist nur anklickbar, wenn der Einkauf erledigt ist.
  if (!variablesStore.shoppingDone) return;

  mouse.x = 0;
  mouse.y = 0;

  cashCounter = selectedCheckout;
  raycaster.setFromCamera(mouse, camera);
  let intersects = raycaster.intersectObjects([selectedCheckout], true);
  if (intersects.length > 0) {
    // NEU: Sound abspielen
    if (whooshSound) {
      whooshSound.currentTime = 0;
      whooshSound.play().catch(() => {});
    }

    clickedObject = selectedCheckout;
    let focusObject = clickedObject.getObjectByName("Display");
    if (!focusObject) {
      console.warn(
        "Display object not found. Falling back to parent object position."
      );
      focusObject = clickedObject;
    }
    variablesStore.updatePlayerMotion(false);
    variablesStore.updateCashoutStart(true);

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
        unloadObjectsByDistance(5);
        setTimeout(() => {
          startAnimation();
        }, 500);
        if (taskDone.value == true) {
          //endScreen.value = true;
        }
      },
    });
  }
}

export function recieptPrint(selectedCheckout) {
  const variablesStore = useVariablesStore();
  const shoppingCartStore = useShoppingCartStore();
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
    onComplete: () => {
      const zoom = 1.21;
      const targetX2 =
        objectPos.x +
        (RECEIPT_CAMERA_DISTANCE_OFFSET / zoom) * Math.cos(angleRad);
      const targetZ2 =
        objectPos.z +
        (RECEIPT_CAMERA_DISTANCE_OFFSET / zoom) * Math.sin(angleRad);
      const targetY2 = objectPos.y + RECEIPT_CAMERA_DISTANCE_OFFSET / zoom / 2;
      const dur = shoppingCartStore.itemsInCart.length * 0.3 + 4;
      gsap.to(camera.position, {
        x: targetX2,
        y: targetY2,
        z: targetZ2,
        duration: dur,
        delay: 1.9,
        ease: "power1.inOut", // Dauer der Kamerabewegung in Sekunden
      });
    },
  });
}
