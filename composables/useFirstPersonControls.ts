import * as THREE from "three";
import { selectMode, productView } from "@/composables/useThree"; // NEU: selectMode und productView importieren
import { watch } from "vue";

export const useFirstPersonControls = (
  camera: THREE.Camera,
  domElement: HTMLElement
) => {
  // Manuelle Steuerung für sanfte Kamerabewegung
  const euler = new THREE.Euler(0, 0, 0, "YXZ");
  const PI_2 = Math.PI / 2;

  const moveState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
  };

  const velocity = new THREE.Vector3();
  const rotationVelocity = new THREE.Vector2(); // Für sanfte Mausbewegung
  const direction = new THREE.Vector3();
  let prevTime = performance.now();

  // Zustand, ob die Steuerung aktiv ist (Maus gesperrt)
  // KORREKTUR: isLocked wird jetzt direkt von der Pointer Lock API verwaltet.
  // Der Klick-Handler in Box.vue sorgt für das (erneute) Sperren.
  let isLocked = false;

  // NEU: Variablen zur Einschränkung der Kamerabewegung im selectMode
  let initialSelectModeEuler = new THREE.Euler(0, 0, 0, "YXZ");
  const maxRotation = { x: Math.PI / 8, y: Math.PI / 4 }; // Max. 22.5° hoch/runter, 45° seitlich

  const onKeyDown = (event: KeyboardEvent) => {
    // KORREKTUR: Bewegungseingaben nur verarbeiten, wenn wir NICHT im selectMode sind.
    if (selectMode.value) return;

    switch (event.code) {
      case "KeyW":
      case "ArrowUp":
        moveState.forward = true;
        break;
      case "KeyA":
      case "ArrowLeft":
        moveState.left = true;
        break;
      case "KeyS":
      case "ArrowDown":
        moveState.backward = true;
        break;
      case "KeyD":
      case "ArrowRight":
        moveState.right = true;
        break;
    }
  };

  const onKeyUp = (event: KeyboardEvent) => {
    switch (event.code) {
      case "KeyW":
      case "ArrowUp":
        moveState.forward = false;
        break;
      case "KeyA":
      case "ArrowLeft":
        moveState.left = false;
        break;
      case "KeyS":
      case "ArrowDown":
        moveState.backward = false;
        break;
      case "KeyD":
      case "ArrowRight":
        moveState.right = false;
        break;
    }
  };

  const onMouseMove = (event: MouseEvent) => {
    // KORREKTUR: Die Mausbewegung soll die Kamera immer steuern, außer in der Produkt-Detailansicht.
    // Wir entfernen die `!isLocked` Prüfung.
    const movementX = event.movementX || 0; 
    const movementY = event.movementY || 0;

    // Addiere Mausbewegung zur Rotationsgeschwindigkeit
    rotationVelocity.x += movementX * 0.001;
    rotationVelocity.y += movementY * 0.001;
  };

  const onPointerLockChange = () => {
    isLocked = document.pointerLockElement === domElement;
    console.log("FPV: PointerLock changed. isLocked:", isLocked); // NEU: Debug-Log
  };

  const onPointerLockError = () => {
    console.error("PointerLockControls: Unable to lock pointer.");
  };

  const lock = () => {
    domElement.requestPointerLock();
  };

  const unlock = () => {
    document.exitPointerLock();
  };

  const connect = () => {
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("pointerlockchange", onPointerLockChange);
    document.addEventListener("pointerlockerror", onPointerLockError);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    domElement.addEventListener("click", lock);
  };

  const disconnect = () => {
    unlock();
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("pointerlockchange", onPointerLockChange);
    document.removeEventListener("pointerlockerror", onPointerLockError);
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("keyup", onKeyUp);
    domElement.removeEventListener("click", lock);
  };

  const update = () => {
    const time = performance.now();
    const delta = (time - prevTime) / 1000;

    // Dämpfung für sanfteres Stoppen
    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;

    // Dämpfung für sanfte Kamerarotation
    rotationVelocity.x *= 0.7;
    rotationVelocity.y *= 0.7;

    direction.z = Number(moveState.forward) - Number(moveState.backward);
    direction.x = Number(moveState.right) - Number(moveState.left);
    direction.normalize(); // Stellt konstante Geschwindigkeit in alle Richtungen sicher

    console.log("FPV Update: isLocked =", isLocked, "selectMode =", selectMode.value, "Camera quaternion before FPV rotation:", camera.quaternion.toArray()); // NEU: Debug-Log
    // KORREKTUR: Wende die Kamerarotation an, solange wir NICHT im selectMode sind.
    // Dies ermöglicht die Kamerasteuerung per Maus sofort nach dem Verlassen des selectMode (via ESC),
    // auch wenn der Pointer noch nicht wieder gesperrt ist. Der Benutzer muss dann nur noch klicken, um die Bewegung zu starten.
    // KORREKTUR: Die Kamerarotation soll nur von der `productView` abhängen, nicht mehr vom `isLocked`-Status.
    // Die Bewegung (velocity) wird weiterhin durch `isLocked` und `selectMode` gesteuert.
    if (!productView.value) {
      euler.setFromQuaternion(camera.quaternion);
      euler.y -= rotationVelocity.x;
      euler.x -= rotationVelocity.y;

      if (selectMode.value) {
        // Im selectMode: Rotation relativ zur initialen Ausrichtung begrenzen
        const deltaX = THREE.MathUtils.clamp(euler.x - initialSelectModeEuler.x, -maxRotation.x, maxRotation.x);
        const deltaY = THREE.MathUtils.clamp(euler.y - initialSelectModeEuler.y, -maxRotation.y, maxRotation.y);
        euler.x = initialSelectModeEuler.x + deltaX;
        euler.y = initialSelectModeEuler.y + deltaY;
      } else {
        // Im normalen Modus: Vertikale Rotation normal begrenzen
        euler.x = Math.max(-PI_2, Math.min(PI_2, euler.x));
      }

      camera.quaternion.setFromEuler(euler);
      console.log("FPV Update: Camera rotation APPLIED. New camera quaternion:", camera.quaternion.toArray()); // NEU: Debug-Log
    }

    prevTime = time;
  };

  // NEU: Funktion, um die interne Euler-Rotation von außen zu setzen.
  const setRotationFromQuaternion = (quaternion: THREE.Quaternion) => {
    euler.setFromQuaternion(quaternion, "YXZ");
    console.log("FPV: Rotation explicitly set from quaternion.");
  };

  // NEU: Beobachte den selectMode, um die initiale Rotation zu speichern
  watch(selectMode, (isSelectMode) => {
    if (isSelectMode) {
      initialSelectModeEuler.setFromQuaternion(camera.quaternion, "YXZ");
    }
  });

  return {
    // Dummy-controls-Objekt für Kompatibilität mit dem Rest des Codes
    controls: { lock, unlock, isLocked: () => isLocked },
    velocity, // velocity exportieren, um Bewegungsstatus zu prüfen
    moveState, // moveState exportieren, um die Eingabe direkt zu prüfen
    connect,
    disconnect,
    update,
    setRotationFromQuaternion, // NEU: Funktion exportieren
  };
};