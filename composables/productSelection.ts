import * as THREE from "three";
import * as CANNON from "cannon";
import { camera, scene, useMovePlayerTo, selectMode, productView, selectedProduct, lastClickedObject, mouse, raycaster, _playerBody } from "@/composables/useThree";
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

export function clickEvent(event) {
  // KORREKTUR: Der Klick kommt jetzt immer aus der Mitte des Bildschirms,
  // sowohl im FPV- als auch im selectMode.
  mouse.x = 0;
  mouse.y = 0;
  raycaster.setFromCamera(mouse, camera);
  let intersects;
  if (productView.value && selectedProduct.value) {
    intersects = raycaster.intersectObjects([selectedProduct]);
  } else {
    intersects = raycaster.intersectObjects(shelves);
  }

  // --- KORRIGIERTE LOGIK ---
  
  // Wenn wir nichts getroffen haben, beenden wir die Funktion.
  if (intersects.length === 0) {
    return;
  }
  
  // Fall 1: Wir sind NICHT im selectMode. Der Klick soll uns zum Regal teleportieren.
  // KORREKTUR: Die Prüfung auf isLocked() wird entfernt. Ein Klick auf ein Regal soll immer den Teleport auslösen,
  // solange wir nicht bereits im selectMode sind.
  if (!selectMode.value) {
    let clickedShelf = intersects[0].object;
    
    // NEU: Console.log, um den Klick zu bestätigen.
    console.log("Regal geklickt!", clickedShelf);

    while (clickedShelf.parent && clickedShelf.parent !== scene) {
      clickedShelf = clickedShelf.parent;
    }

    // KORREKTUR: Die Positionsberechnung war falsch. Wir müssen die X-Position anpassen, nicht die Z-Position.
    const playerPosition = new CANNON.Vec3();
    const distanceFromShelf = 2.0; // Abstand zum Regal

    playerPosition.z = clickedShelf.position.z; // Die Z-Position des Spielers sollte mit der des Regals übereinstimmen.
    // KORREKTUR: Behalte die aktuelle Y-Position des Spielers bei, um Sprünge zu vermeiden.
    if (_playerBody) {
      playerPosition.y = _playerBody.position.y;
    }
    if (clickedShelf.position.x > 0) {
      // Rechtes Regal (schaut zur negativen X-Achse), also muss der Spieler eine kleinere X-Position haben.
      playerPosition.x = clickedShelf.position.x - distanceFromShelf;
    } else {
      // Linkes Regal (schaut zur positiven X-Achse), also muss der Spieler eine größere X-Position haben.
      playerPosition.x = clickedShelf.position.x + distanceFromShelf;
    }

    useMovePlayerTo(playerPosition, new THREE.Vector3(clickedShelf.position.x, 0.9, clickedShelf.position.z));
    selectMode.value = true;
  } 
  // Fall 2: Wir sind im selectMode, aber noch nicht in der Produktansicht. Der Klick wählt ein Produkt aus.
  else if (selectMode.value && !productView.value) {
    clickedObject = intersects[0].object;
    lastClickedObject.value = clickedObject; // NEU: Das Originalobjekt speichern
    while ( // @ts-ignore
      clickedObject.parent &&
      clickedObject.parent !== scene &&
      !clickedObject.userData.finalLayer
    ) {
      clickedObject = clickedObject.parent;
    }
    handleProductSelection(clickedObject);
  } 
  // Fall 3: Wir sind in der Produktansicht.
  else if (productView.value) {
    if (intersects.length > 0 && intersects[0].object === selectedProduct.value) {
      console.log("fitting");
    }
  }
}

// NEU: Funktion zur Behandlung der Produktauswahl
function handleProductSelection(clickedObject: THREE.Object3D) {
  if (clickedObject.userData.productName) {
    productView.value = true;
    // KORREKTUR: Das Originalobjekt klonen und für die Detailansicht vorbereiten. // @ts-ignore
    selectedProduct.value = clickedObject.clone();
    if (selectedProduct.value.isMesh) { // @ts-ignore
      selectedProduct.value.geometry = clickedObject.geometry.clone(); // @ts-ignore
      selectedProduct.value.geometry.center();
    }
 // @ts-ignore
    selectedProduct.value.scale.copy(clickedObject.scale);
    clickedObject.visible = false; // Originalobjekt ausblenden

    // Produkt in der Detailansicht positionieren und Rotationssteuerung aktivieren
    activateProductView(selectedProduct);
    addRotationControls();
  }
}

export function productHover() {
  //window.addEventListener("mousemove", checkOverProduct);
}

export function selectedProductToCart() {
  removeRotationControls();
  if (selectedProduct.value) {
    deleteObjekt(lastClickedObject.value); // KORREKTUR: Verwende das gespeicherte Originalobjekt
    useAddProductToCart(selectedProduct.value, scaleAmount);
    setTimeout(() => {
      productView.value = false;
    }, 200);
  }
}

export function selectedProductToShelf() {
  removeRotationControls();
  spotLight.intensity = 0;
  if (selectedProduct.value && lastClickedObject.value) { // KORREKTUR: Prüfe beide Objekte
    lastClickedObject.value.visible = true; // KORREKTUR: Mache das Originalobjekt wieder sichtbar
    deleteObjekt(selectedProduct.value);
    setTimeout(() => {
      productView.value = false;
    }, 200);
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

function onMouseDown(event: MouseEvent) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  let mouseDownObj: THREE.Mesh;
  raycaster.setFromCamera(mouse, camera);
  let intersects;
  if (productView.value) {
    if (selectedProduct.value.isMesh) { // @ts-ignore
      intersects = raycaster.intersectObjects([selectedProduct.value]);
    } else {
      intersects = raycaster.intersectObjects(selectedProduct.value.children); // @ts-ignore
    }
  } else {
    intersects = raycaster.intersectObjects(shelves);
  }
  if (intersects.length > 0 && !productView.value) {
    mouseDownObj = intersects[0].object;
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

  // Rotation um den eigenen Mittelpunkt (nur Y-Achse)
  selectedProduct.value.rotation.y += deltaX * 0.01; // @ts-ignore

  previousMousePosition = { x: event.clientX, y: event.clientY };
}
