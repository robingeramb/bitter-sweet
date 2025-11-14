import * as THREE from "three";
import * as CANNON from "cannon";
import { camera, scene, useMovePlayerTo, selectMode, productView, selectedProduct, lastClickedObject, mouse, raycaster, _playerBody, _outlinePass, unlockControls, lockControls, cartControls } from "@/composables/useThree";
import { markRaw } from "vue";
import { gsap } from "gsap";
import { shelves } from "@/composables/createShelves"; // KORREKTUR: 'shelves' aus der richtigen Datei importieren.

const productsGrid = [
  { x: -1, z: -1 },
  { x: 0, z: -1 },
  { x: 1, z: -1 },
  { x: -1, z: 0 },
  { x: 0, z: 0 },
  { x: 1, z: 0 },
  { x: -1, z: 1 },
  { x: 0, z: 1 },
  { x: 1, z: 1 },
];

const scaleAmount = 0.6;
export let hoveredProduct = ref();
let isDragging = false;
let clickedObject;
let previousMousePosition = { x: 0, y: 0 };

export function clickEvent(event: MouseEvent) {
  // KORREKTUR: Der Klick kommt jetzt immer aus der Mitte des Bildschirms,
  // sowohl im FPV- als auch im selectMode.
  mouse.x = 0;
  mouse.y = 0;
  raycaster.setFromCamera(mouse, camera);
  let intersects;
  if (productView.value && selectedProduct.value) {
    intersects = raycaster.intersectObjects([selectedProduct.value]);
  } else {
    intersects = raycaster.intersectObjects(shelves);
  }

  // --- KORRIGIERTE LOGIK ---
  
  // Wenn wir nichts getroffen haben, beenden wir die Funktion.
  // KORREKTUR: Auch die Distanz prüfen. Wenn das getroffene Objekt zu weit weg ist, ignorieren.
  if (intersects.length === 0 || intersects[0].distance > 3.0) {
    return;
  }
  
  // --- VEREINFACHTE LOGIK ---
  // Ein Klick auf ein Produkt (nicht in der Produktansicht) führt direkt zur Produktauswahl.
  // Der Teleport-Schritt wird entfernt.
  if (!productView.value) {
    clickedObject = intersects[0].object;

    // Finde die Elterngruppe des Produkts, die geklont werden soll.
    let productGroup = clickedObject;
    while (
      productGroup.parent &&
      productGroup.parent !== scene && // @ts-ignore
      !productGroup.userData.finalLayer
    ) { // @ts-ignore
      productGroup = productGroup.parent;
    }

    // KORREKTUR: Übergib die gefundene Produktgruppe.
    // lastClickedObject wird jetzt direkt in handleProductSelection gesetzt.
    handleProductSelection(productGroup);
  } 
  // Fall 2: Wir sind bereits in der Produktansicht.
  else { // productView.value ist true
    if (intersects.length > 0 && intersects[0].object === selectedProduct.value) {
      console.log("fitting");
    }
  }
}

// NEU: Funktion zur Behandlung der Produktauswahl
function handleProductSelection(clickedObject: THREE.Object3D) {
  if (clickedObject.userData.productName) {
    // Schritt 1: Originales Produkt-Objekt ausblenden und für später speichern.
    clickedObject.visible = false;
    lastClickedObject.value = clickedObject;

    // Schritt 2: In den Produktansichts-Modus wechseln, um die Buttons anzuzeigen.
    productView.value = true;

    // NEU: Hebe die Cursorsperre auf, damit der Benutzer das Produkt drehen kann.
    unlockControls();

    // Schritt 3: Das Objekt klonen und sichtbar machen.
    // KORREKTUR: Den Klon sofort als nicht-reaktiv markieren, um den Proxy-Fehler zu verhindern.
    const clone = clickedObject.clone();
    selectedProduct.value = markRaw(clone);
    selectedProduct.value.visible = true;

    // --- KORREKTE POSITIONIERUNG ---
    // Schritt 4: Den Klon ZUERST zur Szene hinzufügen.
    // Dadurch werden seine Transformationen relativ zur Welt und nicht mehr zum Regal interpretiert.
    scene.add(selectedProduct.value);

    // Schritt 5: Die Welt-Position und -Ausrichtung der Kamera abrufen.
    const cameraPosition = new THREE.Vector3();
    const cameraDirection = new THREE.Vector3();
    camera.getWorldPosition(cameraPosition);
    camera.getWorldDirection(cameraDirection);

    // Schritt 6: Die Position des Klons in Weltkoordinaten setzen.
    // Er wird 0.8 Einheiten vor der Kamera platziert.
    selectedProduct.value.position.copy(cameraPosition).add(cameraDirection.multiplyScalar(0.8));
    // Das Objekt zur Kamera ausrichten.
    selectedProduct.value.lookAt(cameraPosition);

    // NEU: Füge das geklonte Produkt zur Outline-Pass hinzu
    _outlinePass.selectedObjects = [selectedProduct.value];

    // Schritt 5 (WIEDERHERGESTELLT): Aktiviere die Maus-Rotation für das Produkt.
    addRotationControls();
  }
}

export function productHover() {
  //window.addEventListener("mousemove", checkOverProduct);
}

export function selectedProductToCart() {
  removeRotationControls();
  // NEU: Entferne das Produkt aus der Outline-Pass
  _outlinePass.selectedObjects = [];

  // KORREKTUR: Übergib das Originalobjekt und das angezeigte Produkt an die Warenkorb-Logik.
  // Das Klonen und Löschen wird dort zentral gehandhabt.
  if (selectedProduct.value && lastClickedObject.value) {
    // NEU: Animiere das Produkt zuerst über den Einkaufswagen.

    // NEU: Pausiere die Wagenverfolgung, während das Produkt in den Korb fliegt.
    cartControls.pause();
    
    // Deaktiviere die Buttons, um doppelte Klicks zu verhindern.
    productView.value = false;

    // Zielposition ist 0.8 Einheiten über der Einkaufswagen-Gruppe.
    const targetPosition = productSelection.position.clone().add(new THREE.Vector3(0, 0.8, 0));

    gsap.to(selectedProduct.value.position, {
      x: targetPosition.x,
      y: targetPosition.y,
      z: targetPosition.z,
      duration: 0.5, // Animationsdauer in Sekunden
      ease: "power2.inOut",
      onComplete: () => {
        // Wenn die Animation abgeschlossen ist, übergeben wir das Produkt an die Physik.
        useAddProductToCart(selectedProduct.value!, lastClickedObject.value!);
        // Setze die Referenzen zurück, nachdem die Aktion abgeschlossen ist.
        selectedProduct.value = null;
        lastClickedObject.value = null;
      },
    });
  }
}

export function selectedProductToShelf() {
  removeRotationControls();
  // NEU: Entferne das Produkt aus der Outline-Pass
  _outlinePass.selectedObjects = [];

  if (lastClickedObject.value) { // KORREKTUR: Prüfe nur das Originalobjekt
    lastClickedObject.value.visible = true; // KORREKTUR: Mache das Originalobjekt wieder sichtbar
    // Da wir in `handleProductSelection` keinen Klon mehr erstellen, müssen wir auch keinen löschen.
    if (selectedProduct.value) {
      deleteObjekt(selectedProduct.value);
    }
    productView.value = false;

    // NEU: Aktiviere den Cursor Lock sofort wieder, um nahtlos in den selectMode zurückzukehren.
    lockControls();
  }
}

function checkOverProduct(event: MouseEvent) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  hoveredMouseX.value = event.clientX;
  hoveredMouseY.value = event.clientY;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(shelves);
  if (intersects.length > 0) {
    let hoveredObject = intersects[0].object;
    if (
      hoveredObject.userData &&
      hoveredObject.userData.productName != undefined
    ) {
      hoveredProduct.value = hoveredObject.userData.productName;
    } else {
      hoveredProduct.value = undefined;
    }
  }
}

// Funktion zur Steuerung der Rotation hinzufügen
function addRotationControls() {
  window.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("mousemove", onMouseMove);
}

function removeRotationControls() {
  //window.removeEventListener("mousemove", checkOverProduct);
  window.removeEventListener("mousedown", onMouseDown);
  window.removeEventListener("mouseup", onMouseUp);
  window.removeEventListener("mousemove", onMouseMove);
}

function onMouseDown(event: MouseEvent): void {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  let mouseDownObj: THREE.Object3D | undefined;
  raycaster.setFromCamera(mouse, camera);
  let intersects;
  if (productView.value && selectedProduct.value) {
    if (selectedProduct.value instanceof THREE.Mesh) {
      intersects = raycaster.intersectObjects([selectedProduct.value]);
    } else {
      intersects = raycaster.intersectObjects(selectedProduct.value.children);
    }
  } else {
    intersects = raycaster.intersectObjects(shelves);
  }
  if (intersects.length > 0 && !productView.value) {
    mouseDownObj = intersects[0].object as THREE.Mesh;
  }
  if (
    (mouseDownObj == selectedProduct.value || intersects.length > 0) &&
    productView.value
  ) {
    isDragging = true;
    previousMousePosition = { x: event.clientX, y: event.clientY };
  }
}

function onMouseUp() {
  isDragging = false;
}

function onMouseMove(event: MouseEvent) {
  if (!isDragging || !selectedProduct.value) return;

  const deltaX = event.clientX - previousMousePosition.x;

  // KORREKTUR: Rotation um die LOKALE Y-Achse des Objekts.
  // `multiply` wendet die Rotation im lokalen Koordinatensystem des Objekts an.
  // Das Ergebnis ist eine intuitive Drehung um die eigene, geneigte Achse.
  const rotationAmount = deltaX * 0.01;
  const rotationQuaternion = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0), // Die lokale Y-Achse
    rotationAmount
  );
  selectedProduct.value.quaternion.multiply(rotationQuaternion);

  previousMousePosition = { x: event.clientX, y: event.clientY };
}
