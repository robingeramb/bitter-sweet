import * as THREE from "three";
import * as CANNON from "cannon";
import { camera, scene, useMovePlayerTo, selectMode, productView, getSelectedProduct, setSelectedProduct, getLastClickedObject, setLastClickedObject, mouse, raycaster, _playerBody, _outlinePass, unlockControls, lockControls, cartControls, hoveredMouseX, hoveredMouseY, productSelection as productDropZone } from "@/composables/useThree";
import { useAddProductToCart } from "@/composables/addProductToCart"; // KORREKTUR: Import aus der korrekten Datei
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
export const isProductRotating = ref(false); // NEU: Status für die Produktrotation
export const hasProductBeenRotated = ref(false); // NEU: Merkt sich, ob der Nutzer die Rotation bereits ausgeführt hat.
export const isHoveringSelectedProduct = ref(false); // NEU: Status für das Hovern über dem ausgewählten Produkt.
let isDragging = false;
let clickedObject;
let previousMousePosition = { x: 0, y: 0 };
let initialProductScale = new THREE.Vector3(); // NEU: Variable zum Speichern der Startskalierung
let didDrag = false; // NEU: Verhindert, dass nach dem Rotieren ein Klick-Event ausgelöst wird.
let initialProductForward = new THREE.Vector3(); // NEU: Speichert die "Vorderseite" des Produkts bei der Auswahl

export function clickEvent(event: MouseEvent) {
  // KORREKTUR: Der Klick kommt jetzt immer aus der Mitte des Bildschirms,
  // sowohl im FPV- als auch im selectMode.
  mouse.x = 0;
  mouse.y = 0;
  raycaster.setFromCamera(mouse, camera);
  let intersects;
  if (productView.value && getSelectedProduct()) {
    intersects = raycaster.intersectObjects([getSelectedProduct()!]);
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
    if (intersects.length > 0 && intersects[0].object === getSelectedProduct()) {
      console.log("fitting");
    }
  }
}

// NEU: Funktion zur Behandlung der Produktauswahl
function handleProductSelection(clickedObject: THREE.Object3D) {
  if (clickedObject.userData.productName) {
    // Schritt 1: Originales Produkt-Objekt ausblenden und für später speichern.
    clickedObject.visible = false;
    setLastClickedObject(markRaw(clickedObject));

    // Schritt 2: In den Produktansichts-Modus wechseln, um die Buttons anzuzeigen.
    productView.value = true;

    // NEU: Setze den Rotationsstatus zurück, wenn ein neues Produkt ausgewählt wird.
    isProductRotating.value = false;
    hasProductBeenRotated.value = false; // NEU: Setze den Status zurück, damit der Hinweis für das neue Produkt wieder erscheint.

    // NEU: Hebe die Cursorsperre auf, damit der Benutzer das Produkt drehen kann.
    unlockControls();

    // Schritt 3: Das Objekt klonen und sichtbar machen.
    // KORREKTUR: Erstelle den Klon in einer nicht-reaktiven Variable, um sicherzustellen,
    // dass das Objekt, das der Szene hinzugefügt wird, niemals ein Proxy ist.
    const productClone = markRaw(clickedObject.clone());
    productClone.visible = true;
    initialProductScale.copy(productClone.scale); // NEU: Speichere die ursprüngliche Skalierung des Klons

    // --- KORREKTE POSITIONIERUNG ---
    // Schritt 4: Den Klon ZUERST zur Szene hinzufügen.
    // Dadurch werden seine Transformationen relativ zur Welt und nicht mehr zum Regal interpretiert. // @ts-ignore
    scene.add(productClone);

    // Schritt 5: Die Welt-Position und -Ausrichtung der Kamera abrufen.
    const cameraPosition = new THREE.Vector3();
    const cameraDirection = new THREE.Vector3();
    camera.getWorldPosition(cameraPosition);
    camera.getWorldDirection(cameraDirection);

    // Schritt 6: Die Position des Klons in Weltkoordinaten setzen.
    // Er wird 0.8 Einheiten vor der Kamera platziert.
    productClone.position.copy(cameraPosition).add(cameraDirection.multiplyScalar(0.8));
    // Das Objekt zur Kamera ausrichten.
    // KORREKTUR: Richte das Produkt so aus, dass die Seite, die im Regal nach vorne zeigte, nun zur Kamera zeigt.
    // 1. Setze die Rotation des Klons zurück.
    productClone.quaternion.identity();

    // 2. Erstelle eine Zielrotation, die zur Kamera schaut.
    const targetRotation = new THREE.Quaternion();
    const tempObject = new THREE.Object3D();
    tempObject.position.copy(productClone.position);
    tempObject.lookAt(cameraPosition);
    targetRotation.copy(tempObject.quaternion);

    // 3. Kombiniere die ursprüngliche Rotation aus dem Regal mit der Zielrotation.
    productClone.applyQuaternion(targetRotation.multiply(clickedObject.quaternion));

    // KORREKTUR: Speichere die "Vorderseite" des Produkts in seiner initialen Ausrichtung.
    // Dies dient als Referenz (dot product = -1) für die Skalierung.
    initialProductForward.set(0, 0, 1); // Lokale Z-Achse ist die "Vorderseite"
    initialProductForward.applyQuaternion(productClone.quaternion); // In Weltkoordinaten umwandeln

    // Schritt 7: JETZT, nachdem das Objekt vollständig konfiguriert und der Szene hinzugefügt wurde,
    // weisen wir es der reaktiven `ref` zu, damit die UI darauf reagieren kann.
    // KORREKTUR: Verwende den neuen, nicht-reaktiven Setter.
    setSelectedProduct(markRaw(productClone));

    // Schritt 7: JETZT, nachdem das Objekt vollständig konfiguriert und der Szene hinzugefügt wurde,
    // weisen wir es der reaktiven `ref` zu, damit die UI darauf reagieren kann.
    // KORREKTUR: Verwende den neuen, nicht-reaktiven Setter.
    setSelectedProduct(markRaw(productClone));

    // NEU: Füge das geklonte Produkt zur Outline-Pass hinzu
    _outlinePass.selectedObjects = [getSelectedProduct()!];

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
  if (getSelectedProduct() && getLastClickedObject()) {
    // Deaktiviere die Buttons, um doppelte Klicks zu verhindern.
    productView.value = false;

    // KORREKTUR: Entferne die GSAP-Animation.
    // Rufe `useAddProductToCart` sofort auf, um einen physikalischen Klon
    // direkt über dem Einkaufswagen zu erstellen.
    useAddProductToCart(getSelectedProduct()!, getLastClickedObject()!);
  }
}

export function selectedProductToShelf() {
  removeRotationControls();
  // NEU: Entferne das Produkt aus der Outline-Pass
  _outlinePass.selectedObjects = [];

  if (getLastClickedObject()) { // KORREKTUR: Prüfe nur das Originalobjekt
    getLastClickedObject()!.visible = true; // KORREKTUR: Mache das Originalobjekt wieder sichtbar
    // Da wir in `handleProductSelection` keinen Klon mehr erstellen, müssen wir auch keinen löschen.
    if (getSelectedProduct()) {
      deleteObjekt(getSelectedProduct()!);
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

// NEU: Funktion, die prüft, ob die Maus über dem ausgewählten Produkt schwebt.
function onHoverSelectedProduct(event: MouseEvent) {
  if (!productView.value || !getSelectedProduct() || isDragging) {
    isHoveringSelectedProduct.value = false;
    return;
  }

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObject(getSelectedProduct()!, true);
  isHoveringSelectedProduct.value = intersects.length > 0;
}

// Funktion zur Steuerung der Rotation hinzufügen
function addRotationControls() {
  window.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mousemove", onHoverSelectedProduct); // NEU: Hover-Erkennung hinzufügen
}

function removeRotationControls() {
  //window.removeEventListener("mousemove", checkOverProduct);
  window.removeEventListener("mousedown", onMouseDown);
  window.removeEventListener("mouseup", onMouseUp);
  window.removeEventListener("mousemove", onMouseMove);
  window.removeEventListener("mousemove", onHoverSelectedProduct); // NEU: Hover-Erkennung entfernen
}

function onMouseDown(event: MouseEvent): void {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  didDrag = false; // KORREKTUR: Drag-Status bei jedem Klick zurücksetzen.
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  let mouseDownObj: THREE.Object3D | undefined;
  raycaster.setFromCamera(mouse, camera);
  let intersects;
  if (productView.value && getSelectedProduct()) {
    if (getSelectedProduct()! instanceof THREE.Mesh) {
      intersects = raycaster.intersectObjects([getSelectedProduct()!]);
    } else {
      intersects = raycaster.intersectObjects(getSelectedProduct()!.children);
    }
  } else {
    intersects = raycaster.intersectObjects(shelves);
  }
  if (intersects.length > 0 && !productView.value) {
    mouseDownObj = intersects[0].object as THREE.Mesh;
  }
  if (
    (mouseDownObj == getSelectedProduct() || intersects.length > 0) &&
    productView.value
  ) {
    isDragging = true;
    previousMousePosition = { x: event.clientX, y: event.clientY };
  }
}

function onMouseUp(event: MouseEvent): void {
  // KORREKTUR: Wenn eine Rotation stattgefunden hat (didDrag), wird die Event-Propagation gestoppt.
  // Das verhindert, dass der 'mouseup' fälschlicherweise als 'click' auf dem Canvas interpretiert wird
  // und den Cursor-Lock wieder aktiviert.
  if (didDrag) {
    event.stopPropagation();
  }
  isDragging = false;
  isProductRotating.value = false; // NEU: Setze den Rotationsstatus zurück
}

function onMouseMove(event: MouseEvent) {
  if (!isDragging || !getSelectedProduct()) return;
  didDrag = true; // KORREKTUR: Sobald sich die Maus bewegt, markieren wir es als Drag.
  const deltaX = event.clientX - previousMousePosition.x;

  // KORREKTUR: Rotation um die LOKALE Y-Achse des Objekts.
  // `multiply` wendet die Rotation im lokalen Koordinatensystem des Objekts an.
  // Das Ergebnis ist eine intuitive Drehung um die eigene, geneigte Achse.
  const rotationAmount = deltaX * 0.01;
  isProductRotating.value = true; // NEU: Setze den Status, sobald die Rotation beginnt.
  hasProductBeenRotated.value = true; // NEU: Merke, dass die Rotation stattgefunden hat.
  const rotationQuaternion = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0), // Die lokale Y-Achse
    rotationAmount
  );

  // KORREKTUR 2: Skalierung basierend auf der Rotation anpassen.
  if (getSelectedProduct()) {
    // Vektor, der von der "Vorderseite" des Produkts weg zeigt (lokale Z-Achse).
    const productForward = new THREE.Vector3(0, 0, 1);
    productForward.applyQuaternion(getSelectedProduct()!.quaternion); // In Weltkoordinaten umwandeln.

    // KORREKTUR: Berechne den Dot-Product relativ zur initialen "Vorderseite", nicht zur Kamera.
    // Das stellt sicher, dass die Skalierung immer bei 1.0 beginnt, egal wie das Modell ausgerichtet ist.
    // -1: Aktuelle Ausrichtung entspricht der Start-Ausrichtung (Vorderseite).
    // +1: Aktuelle Ausrichtung ist um 180 Grad gedreht (Rückseite).
    const dot = productForward.dot(initialProductForward);

    // KORREKTUR: Die Skalierungslogik wird umgekehrt.
    // Jetzt wird das Produkt bei der Vorderseite (dot ≈ -1) größer und bei der Rückseite (dot ≈ 1) normal groß.
    const scale = 1.15 - 0.15 * dot; // Mappt den Bereich [-1, 1] auf [1.3, 1.0].

    // KORREKTUR: Wende die Skalierung relativ zur ursprünglichen Skalierung an.
    const finalScale = initialProductScale.clone().multiplyScalar(scale);
    getSelectedProduct()!.scale.copy(finalScale);
  }

  getSelectedProduct()!.quaternion.multiply(rotationQuaternion);

  previousMousePosition = { x: event.clientX, y: event.clientY };
}
