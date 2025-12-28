import * as THREE from "three";
import { useVariablesStore, useShoppingCartStore } from "~/stores/store";
import {
  camera,
  taskDone,
  unloadObjectsByDistance,
} from "@/composables/useThree";
import { startAnimation } from "@/composables/displayController";
import { gsap } from "gsap";

// Modul-Variablen
let clickedObject: THREE.Object3D | null = null;
export let cashCounter: any = null;
let activeTimeout: NodeJS.Timeout | null = null;

const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const CAMERA_DISTANCE_OFFSET = 0.6;
const RECEIPT_CAMERA_DISTANCE_OFFSET = 0.14;
const CAMERA_ANGLE_DEG = 180;

// Sound Setup
const whooshSound =
  typeof Audio !== "undefined" ? new Audio("/sound/whoosh.mp3") : null;
if (whooshSound) whooshSound.volume = 0.5;

/**
 * NEU: Diese Funktion MUSS in deine restartGame() in useThree.ts integriert werden!
 */
export function cleanupCheckoutLogic() {
  // 1. Alle GSAP Animationen auf der Kamera sofort stoppen
  gsap.killTweensOf(camera.position);

  // 2. Laufende Timeouts löschen
  if (activeTimeout) {
    clearTimeout(activeTimeout);
    activeTimeout = null;
  }

  // 3. Variablen nullen
  clickedObject = null;
  cashCounter = null;

  // 4. Sound stoppen
  if (whooshSound) {
    whooshSound.pause();
    whooshSound.currentTime = 0;
  }

  console.log("🧹 Checkout-Logik wurde gereinigt");
}

export function clickCheckout(
  event: MouseEvent,
  selectedCheckout: THREE.Object3D
) {
  const variablesStore = useVariablesStore();

  if (!selectedCheckout || !variablesStore.shoppingDone) return;

  mouse.x = 0;
  mouse.y = 0;

  cashCounter = selectedCheckout;
  raycaster.setFromCamera(mouse, camera);

  let intersects = raycaster.intersectObjects([selectedCheckout], true);

  if (intersects.length > 0) {
    if (whooshSound) {
      whooshSound.currentTime = 0;
      whooshSound.play().catch(() => {});
    }

    clickedObject = selectedCheckout;
    let focusObject = clickedObject.getObjectByName("Display") || clickedObject;

    variablesStore.updatePlayerMotion(false);
    variablesStore.updateCashoutStart(true);

    const objectPos = new THREE.Vector3();
    focusObject.getWorldPosition(objectPos);

    const angleRad = (CAMERA_ANGLE_DEG * Math.PI) / 180;
    const targetX = objectPos.x + CAMERA_DISTANCE_OFFSET * Math.cos(angleRad);
    const targetZ = objectPos.z + CAMERA_DISTANCE_OFFSET * Math.sin(angleRad);

    // GSAP Animation stoppen, falls eine alte läuft
    gsap.killTweensOf(camera.position);

    gsap.to(camera.position, {
      x: targetX,
      z: targetZ,
      duration: 1.8,
      ease: "power2.inOut",
      onUpdate: () => {
        camera.lookAt(objectPos);
      },
      onComplete: () => {
        camera.lookAt(objectPos);
        unloadObjectsByDistance(5);

        // Timeout sicher speichern
        activeTimeout = setTimeout(() => {
          // Check ob wir uns noch im Cashout befinden (verhindert Ausführung nach Reset)
          if (variablesStore.cashoutStart) {
            startAnimation();
          }
        }, 500);
      },
    });
  }
}

export function recieptPrint(selectedCheckout: THREE.Object3D) {
  if (!selectedCheckout) return;
  const shoppingCartStore = useShoppingCartStore();

  let focusObject =
    selectedCheckout.getObjectByName("paperPosition") || selectedCheckout;
  const objectPos = new THREE.Vector3();
  focusObject.getWorldPosition(objectPos);

  const angleRad = (CAMERA_ANGLE_DEG * Math.PI) / 180;
  const targetX =
    objectPos.x + RECEIPT_CAMERA_DISTANCE_OFFSET * Math.cos(angleRad);
  const targetZ =
    objectPos.z + RECEIPT_CAMERA_DISTANCE_OFFSET * Math.sin(angleRad);
  const targetY = objectPos.y + RECEIPT_CAMERA_DISTANCE_OFFSET / 2;

  gsap.killTweensOf(camera.position);

  gsap.to(camera.position, {
    x: targetX,
    y: targetY,
    z: targetZ,
    duration: 1.8,
    ease: "power2.inOut",
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
        ease: "power1.inOut",
      });
    },
  });
}
