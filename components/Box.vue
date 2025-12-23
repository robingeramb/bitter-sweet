<script setup lang="ts">
import {
  _shoppingCartBody,
  useThree,
  camera,
  scene,
  playerMaterial,
  debugMeshes,
  raycaster,
  mouse,
  clock,
  _composer,
  productSelection,
  productSelectionCannonBodies,
  taskDone,
  selectMode,
  hoveredProduct,
  getSelectedProduct,
  productView,
  world,
  getPhysicObjects,
  getshoppingCartObjects,
  groundMaterial, // NEU: groundMaterial importieren
  bodiesToRemove, // NEU: Importiere die Liste der zu entfernenden Körper
  shoppingCartMaterial, // NEU: shoppingCartMaterial importieren
  usePlayerBody,
  generateShoppingCartBody,
  useCartControls, // NEU: Importieren, um die Wagen-Steuerung zu registrieren
  useShoppingCartBody, // NEU: Setter-Funktion importieren
  shelfMaterial, // NEU: Material für Wände importieren
  COLLISION_GROUPS, // NEU: Kollisionsgruppen importieren
} from "@/composables/useThree"; // NEU: Zentrales Material importieren
import { shelves } from "@/composables/createShelves";
import { createCannonDebugger } from "@/composables/cannonDebugger";
import { useFirstPersonControls } from "@/composables/useFirstPersonControls";
import {
  initDisplayController,
  animateDisplay,
} from "@/composables/displayController";
import { receipt } from "@/composables/useReceipt";
import * as THREE from "three";
import CANNON from "cannon";
import type { Intersection } from "three"; // NEU: Expliziter Typ-Import
import { useVariablesStore } from "~/stores/store";
const variablesStore = useVariablesStore();

/* --- Props --- */
interface Props {
  mousePos: { x: number; y: number };
  scrollVal: number;
  faceDisplay: Ref<any> | null | undefined;
}

const props = defineProps<Props>(); // FIX: defineProps ist jetzt importiert

/* --- Reactive Variables and References --- */
let selfCashoutState = true;
let shoppingCart: THREE.Mesh | null = null;
let cashRegister: THREE.Mesh;
let _renderer: THREE.WebGLRenderer;
let isCartFollowingPlayer = ref(true); // NEU: Steuert, ob der Wagen dem Spieler folgt.
let _renderLoopId: number;
let displayMesh: THREE.Mesh | null = null;
let debugYPositions: number[] = []; // NEU: Array zum Speichern der Y-Positionen
const MAX_DEBUG_Y_POSITIONS = 60; // NEU: Anzahl der zu speichernden Werte (z.B. 1 Sekunde bei 60 FPS)
let _floor: THREE.Mesh;
let _roof: THREE.Mesh;
let clickable = ref(false);
let cartTargetPosition = new THREE.Vector3();
let smoothedCartTargetPosition = new THREE.Vector3(); // NEU: Geglättete Zielposition für den Wagen
let playerBody: CANNON.Body | null = null;
let shoppingCartBody: CANNON.Body | null = null; // NEU: Physik-Körper für den Einkaufswagen
let supermarketSound: HTMLAudioElement | null = null; // NEU: Hintergrundsound
let shoppingCartSound: HTMLAudioElement | null = null; // NEU: Einkaufswagen-Sound
let grabSound: HTMLAudioElement | null = null; // NEU: Grab-Sound
let shoppingCartDebugMesh: THREE.Object3D | null = null;

const fixedTimeStep = 1 / 60; // Fester, empfohlener Timestep für die Physik

/* --- Constants --- */
const floorLength = 20;
const shelfLength = 0.5;
const shelfHeight = 2;
const shelfWidth = 2.5;
const dist = 0.12;

/* --- Composables --- */
const { initThree, cleanUpThree } = useThree();
const canvas = computed(
  (): HTMLCanvasElement | null =>
    document.getElementById("mountId") as HTMLCanvasElement
);
let fpControls: ReturnType<typeof useFirstPersonControls> | null = null;

/* --- Watches --- */
// HINWEIS: Dieser Watch ist jetzt nur noch für Interaktionen außerhalb des FPV/Select-Modus relevant.
watch(() => [props.mousePos.x, props.mousePos.y], checkIntersects);

function checkIntersects() {
  let intersects: Intersection[] = []; // KORREKTUR: Expliziten Typ verwenden
  const selectedProduct = getSelectedProduct();
  // Diese Funktion ist jetzt nur noch für das Hovern im productView oder für zukünftige UI-Elemente zuständig.
  if (productView.value && selectedProduct.value) {
    mouse.x = (props.mousePos.x / window.innerWidth) * 2 - 1;
    mouse.y = -(props.mousePos.y / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    intersects = raycaster.intersectObjects([selectedProduct.value]);
    if (intersects.length > 0) {
      const hoveredObject = intersects[0].object;
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
}

/* --- Functions --- */
async function setupScene(): Promise<void> {
  // Die Initialisierung von Three.js und der Render-Loop erfolgen jetzt in onMounted.
  // Diese Funktion lädt nur noch die schweren 3D-Objekte.

  const lights = await createLights(floorLength, shelfWidth, shelfLength, dist);
  if (lights) {
    lights.position.y = 2.4 - 3.16;
    scene.add(lights);
  }

  const shoplight = await loadEXR("phone_shop_4k.exr");

  setupFloor();
  setupRoof();
  setupWalls();
  await setupDoor();
  await setupShoppingCart(shoplight);
  await setupCashRegister();

  await createShelves(
    // KORREKTUR: await hinzufügen, um sicherzustellen, dass die Regale fertig sind
    { x1: -1.6, x2: 1.6 },
    floorLength,
    shelfWidth,
    shelfLength,
    dist,
    shelfHeight
  );
  //createShelves(1.6, floorLength, shelfWidth, shelfLength, dist, shelfHeight);

  postProcessing(cashRegister);

  lights.children.forEach((element) => {
    (element.children[0] as THREE.Light).shadow.needsUpdate = false;
  });
}

function setupFloor(): void {
  const ceramicMaterial = createTexture(
    // @ts-ignore
    "ceramic_tiles",
    16,
    true,
    true,
    true,
    true,
    true,
    1,
    0.5,
    1,
    1
  );
  const floorGeometry = new THREE.BoxGeometry(
    floorLength + 6,
    0.1,
    floorLength + 6
  );

  _floor = new THREE.Mesh(floorGeometry, ceramicMaterial); // KORREKTUR: Visuellen Boden an physikalischen Boden anpassen
  _floor.position.set(0, -1.55, -floorLength / 2 + 4); // KORREKTUR: Position an neue, korrekte Bodenhöhe anpassen.
  _floor.receiveShadow = true;
  _floor.name = "floor";

  scene.add(_floor);
}

function setupFloorPhysics(): void {
  const floorShape = new CANNON.Box(
    new CANNON.Vec3((floorLength + 6) / 2, 0.1 / 2, (floorLength + 6) / 2)
  );
  const floorBody = new CANNON.Body({
    mass: 0, // Statisches Objekt
    shape: floorShape,
    material: groundMaterial, // KORREKTUR: Das korrekte Physik-Material für den Boden zuweisen
    // KORREKTUR: Den physikalischen Boden leicht nach unten verschieben, damit Spieler/Wagen bei Y=-0.5 stabil darauf stehen.
    position: new CANNON.Vec3(0, -1.05, -floorLength / 2 + 4), // KORREKTUR: Exakt an visuellen Boden anpassen. Oberkante ist jetzt bei Y = -1.0
    // KORREKTUR: Dem Boden eine Gruppe zuweisen und festlegen, womit er kollidiert.
    collisionFilterGroup: COLLISION_GROUPS.GROUND,
    collisionFilterMask:
      COLLISION_GROUPS.PLAYER |
      COLLISION_GROUPS.PRODUCT |
      COLLISION_GROUPS.SHOPPING_CART,
  });
  (floorBody as any).name = "Boden"; // Name für Debugging
  world.addBody(floorBody);
}

function setupRoof(): void {
  const roofMaterial = createTexture(
    "ceiling_tiles", // @ts-ignore
    3.5,
    true,
    true,
    true,
    true,
    true,
    0.1,
    0.1,
    0.1,
    0.1
  );
  const roofGeometry = new THREE.BoxGeometry(
    floorLength + 6,
    0.1,
    floorLength + 6
  );

  _roof = new THREE.Mesh(roofGeometry, roofMaterial);
  _roof.position.set(0, 2.4, -floorLength / 2 + 4);
  (_roof.material as THREE.MeshStandardMaterial).transparent = true;
  scene.add(_roof);
}

function setupWalls(): void {
  const wallMaterial = createTexture(
    "wallpaper_rough", // @ts-ignore
    36,
    true,
    true,
    true,
    true,
    false,
    0.1
  );

  const wallHeight = 10;
  const sideWallLength = 40; // Länger, um den Raum abzuschneiden
  const endWallWidth = 10; // Breit genug für die Enden

  const sideGeometry = new THREE.BoxGeometry(0.1, wallHeight, sideWallLength);
  const endGeometry = new THREE.BoxGeometry(endWallWidth, wallHeight, 0.1);

  // Linke Wand
  const wall1 = new THREE.Mesh(sideGeometry, wallMaterial);
  wall1.position.set(-1.91, wallHeight / 2 - 1.55, -6);
  wall1.receiveShadow = true;
  wall1.name = "wall";

  // Rechte Wand
  const wall2 = wall1.clone();
  wall2.position.set(1.91, wallHeight / 2 - 1.55, -6);

  // Vordere Wand (hinter der Kasse)
  const wall3 = new THREE.Mesh(endGeometry, wallMaterial);
  wall3.position.set(0, wallHeight / 2 - 1.55, -19);
  wall3.receiveShadow = true;

  // Hintere Wand (hinter dem Spielerstart)
  const wall4 = wall3.clone();
  wall4.position.set(0, wallHeight / 2 - 1.55, 6);

  scene.add(wall1, wall2, wall3, wall4);
}

function setupWallPhysics(): void {
  const wallHeight = 10;
  const sideWallLength = 40;
  const endWallWidth = 10;
  const wallThickness = 0.1;

  const sideShape = new CANNON.Box(
    new CANNON.Vec3(wallThickness / 2, wallHeight / 2, sideWallLength / 2)
  );
  const endShape = new CANNON.Box(
    new CANNON.Vec3(endWallWidth / 2, wallHeight / 2, wallThickness / 2)
  );

  const createBody = (
    shape: CANNON.Shape,
    x: number,
    z: number,
    name: string,
    y?: number
  ) => {
    const body = new CANNON.Body({
      mass: 0, // Statisch
      material: shelfMaterial, // Gleiches Material wie Regale (rutschig)
      shape: shape,
      position: new CANNON.Vec3(x, y ?? wallHeight / 2 - 1.05, z), // Physik-Position leicht höher als visuell (angepasst an Boden)
      collisionFilterGroup: COLLISION_GROUPS.SHELF, // Wir nutzen die Regal-Gruppe für statische Hindernisse
      collisionFilterMask:
        COLLISION_GROUPS.PLAYER |
        COLLISION_GROUPS.SHOPPING_CART |
        COLLISION_GROUPS.PRODUCT,
    });
    (body as any).name = name; // NEU: Name für Debugging
    world.addBody(body);
  };

  // KORREKTUR: Wände etwas weiter nach außen schieben (von 1.91 auf 2.1), um Konflikte mit den Regalen zu vermeiden.
  createBody(sideShape, -2.1, -6, "Wand Links"); // Links
  createBody(sideShape, 2.1, -6, "Wand Rechts"); // Rechts
  createBody(endShape, 0, -19, "Wand Vorne"); // Vorne
  createBody(endShape, 0, 6, "Wand Hinten"); // Hinten
}

async function setupDoor(): Promise<void> {
  const doorMesh = (await loadModel("door-opt.glb")) as THREE.Mesh;
  if (doorMesh) {
    doorMesh.position.set(0, 0.15, -18.85);
    doorMesh.scale.set(1, 1, 1);
    doorMesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    scene.add(doorMesh);

    const doorMesh2 = doorMesh.clone();
    doorMesh2.position.set(0, 0.15, 5.85);
    doorMesh2.rotation.y = Math.PI;
    scene.add(doorMesh2);
  }
}

async function setupShoppingCart(shoplight: any): Promise<void> {
  const metal = createTexture(
    // @ts-ignore
    "shoppingCart",
    1,
    true,
    false,
    true,
    false,
    true,
    1,
    0.1,
    1,
    0.1
  );
  metal.envMap = shoplight;
  metal.envMapIntensity = 0.1;

  shoppingCart = (await loadModel("shoppingcart.glb")) as THREE.Mesh;
  if (shoppingCart) {
    shoppingCart.scale.set(0.01, 0.01, 0.01);
    // Die Position wird in onMounted gesetzt, um sicherzustellen, dass sie mit den Zielpositionen übereinstimmt.
    shoppingCart.traverse((child) => {
      child.castShadow = true;
      if ("material" in child) {
        (child as THREE.Mesh).material = metal;
      }
    });
    scene.add(shoppingCart);

    // NEU: Erstelle den physikalischen Körper für den Einkaufswagen
    shoppingCartBody = generateShoppingCartBody();
    // KORREKTUR: Weise der Korb-Boden-Shape (die zweite Shape, Index 1) eine eindeutige ID zu,
    // damit wir sie bei der Kollision sicher identifizieren können.
    shoppingCartBody.shapes[1].id = 99; // Eindeutige ID für den Korb-Boden

    shoppingCartBody.position.set(0, -0.9, 3); // Setze die Startposition
    shoppingCartBody.allowSleep = false; // KORREKTUR: Verhindert, dass der Einkaufswagen einschläft und Kollisionen verpasst.
    useShoppingCartBody(shoppingCartBody); // KORREKTUR: Verwende die Setter-Funktion, um den Körper global verfügbar zu machen.
    (shoppingCartBody as any).threemesh = shoppingCart; // FIX: Verknüpfe den Physik-Körper mit dem 3D-Modell.

    // NEU: Debugger für den Einkaufswagen aktivieren
    shoppingCartDebugMesh = createCannonDebugger(scene, shoppingCartBody);
    world.addBody(shoppingCartBody);
  }
}

async function setupCashRegister(): Promise<void> {
  const metalMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xbdbdbd, // Basisfarbe
    metalness: 0.7, // vollständig metallisch
    roughness: 0.2, // sehr glänzend: kleine roughness
    envMapIntensity: 1.0, // Stärke der Environment-Reflektionen
    clearcoat: 0.25, // leichter klarlack-Effekt
    clearcoatRoughness: 0.02,
    reflectivity: 0.9,
  });

  const displayMaterial = new THREE.MeshBasicMaterial({
    map: null, // später von Controller ersetzt
  });
  cashRegister = (await loadModel("newcounterglb-opt.glb")) as THREE.Mesh;
  if (cashRegister) {
    cashRegister.scale.set(0.8, 0.8, 0.8); // KORREKTUR: Skalierung beibehalten
    cashRegister.position.set(0.8, -0.9, -16); // KORREKTUR: Kasse-Position an neuen Boden anpassen (Base bei Y=0)
    cashRegister.rotation.y = -Math.PI / 2;
    let paperPosition: THREE.Mesh | null = null;

    cashRegister.traverse((child) => {
      child.castShadow = true;
      if (child.name === "Display") {
        child.material = displayMaterial;
        displayMesh = child;
      } else if (child.name === "paperPosition") {
        paperPosition = child as THREE.Mesh;
      } else if (
        "material" in child &&
        child.name != "SelfCheckout" &&
        child.name != "CardReader" &&
        !child.name.includes("printer") &&
        child.name != "paperPosition"
      ) {
        (child as THREE.Mesh).material = metalMaterial;
      }
    });
    if (paperPosition) {
      // 1. Geometrie auswerten
      paperPosition.geometry.computeBoundingBox();
      const box = paperPosition.geometry.boundingBox;

      const width = (box.max.x - box.min.x) * paperPosition.scale.x;

      // 2. oberste Kante bestimmen
      createReceiptShaderMesh(width, paperPosition, cashRegister);

      // 3. Normalenrichtung bestimmen

      // 5. Animation
    }

    scene.add(cashRegister);
    if (displayMesh) initDisplayController(displayMesh);
  }
}

let firstFrame = true;

function renderLoop(): void {
  const deltaTime = clock.getDelta();

  if (firstFrame) {
    if (shoppingCart) {
      const forwardFirst = new THREE.Vector3(0, 0, -1).applyQuaternion(
        camera.quaternion
      );
      forwardFirst.y = 0;
      forwardFirst.normalize();
      let idealPosition2: CANNON.Vec3 = new CANNON.Vec3();
      idealPosition2 = new CANNON.Vec3(
        playerBody!.position.x,
        shoppingCartBody.position.y,
        playerBody!.position.z
      );
      idealPosition2.vadd(
        new CANNON.Vec3(forwardFirst.x, 0, forwardFirst.z).scale(0.8),
        idealPosition2
      );
      shoppingCart.position.copy(idealPosition2 as unknown as THREE.Vector3);
      firstFrame = false;
    }
  }
  // NEU: DEBUG: Y-Positionen am Anfang des Render-Loops
  if (playerBody && !variablesStore.cashoutStart) {
    debugYPositions.push(playerBody.position.y);
    if (debugYPositions.length > MAX_DEBUG_Y_POSITIONS) {
      debugYPositions.shift(); // Ältesten Wert entfernen
    }
  }

  if (!variablesStore.showReceiptDone) {
    animateDisplay();
  }

  const physicObjects = getPhysicObjects();
  const shoppingCartObjects = getshoppingCartObjects();
  // --- VORBEREITUNG FÜR PHYSIK-UPDATE ---
  // Synchronisiere alle physischen Objekte (Produkte im Korb) mit ihren visuellen Meshes
  // WICHTIG: Dies muss VOR world.step() geschehen, damit Kollisions-Events auf 'threemesh' zugreifen können.
  if (!variablesStore.cashoutStart) {
    for (const [mesh, body] of physicObjects.entries()) {
      // Verknüpfe den Physik-Körper mit seinem Mesh, damit die Kollisionslogik darauf zugreifen kann.
      (body as any).threemesh = mesh;
    }

    // --- PHYSIK-UPDATE ---
    // Die Physik-Welt wird in jedem Frame aktualisiert.

    world.step(fixedTimeStep, deltaTime, 10);
  }
  if (!variablesStore.cashoutStart) {
    for (const [mesh, body] of shoppingCartObjects.entries()) {
      // Verknüpfe den Physik-Körper mit seinem Mesh, damit die Kollisionslogik darauf zugreifen kann.
      (body as any).threemesh = mesh;
    }

    // --- PHYSIK-UPDATE ---
    // Die Physik-Welt wird in jedem Frame aktualisiert.

    world.step(fixedTimeStep, deltaTime, 10);
  }

  // --- KORREKTUR: Sicheres Entfernen von Körpern NACH dem Physik-Update ---
  // Iteriere durch die vorgemerkten Körper und entferne sie sicher aus der Welt.
  bodiesToRemove.forEach((body) => {
    world.remove(body);
  });
  bodiesToRemove.clear(); // Leere die Liste für den nächsten Frame.
  // --- SPIELER-UPDATE ---

  if (playerBody && fpControls && variablesStore.playerInMotion) {
    // Steuerung nur anwenden, wenn die Maus gesperrt ist.
    // KORREKTUR: Die Bewegungssperre für den Spieler wurde entfernt.
    if (fpControls.controls.isLocked()) {
      fpControls.update(); // Maus-Rotation anwenden

      const moveForce = 100;
      const force = new CANNON.Vec3();
      const euler = new THREE.Euler().setFromQuaternion(
        camera.quaternion,
        "YXZ"
      );

      const direction = new THREE.Vector3();
      if (fpControls.moveState.forward) direction.z = -1;
      if (fpControls.moveState.backward) direction.z = 1;
      if (fpControls.moveState.left) direction.x = -1;
      if (fpControls.moveState.right) direction.x = 1;

      if (direction.length() > 0) {
        direction.normalize();
        direction.applyEuler(euler);
        force.set(direction.x * moveForce, 0, direction.z * moveForce);
      }

      // KORREKTUR: applyForce (Weltkoordinaten) statt applyLocalForce verwenden.
      // Außerdem Rotation explizit zurücksetzen, um Verdrehen an Ecken zu verhindern.
      playerBody.applyForce(force, playerBody.position);
      playerBody.quaternion.set(0, 0, 0, 1);
      playerBody.angularVelocity.set(0, 0, 0);
    }

    // Kamera-Position mit dem Physik-Körper synchronisieren.
    camera.position.set(
      playerBody.position.x,
      playerBody.position.y + 0.2,
      playerBody.position.z
    );
  }

  let idealPosition: CANNON.Vec3 = new CANNON.Vec3();

  // --- EINKAUFSWAGEN-UPDATE ---
  if (shoppingCart && shoppingCartBody && !variablesStore.cashoutStart) {
    // --- KORREKTUR: Sanftere Verfolgung durch Feder-ähnliche Kräfte statt direkter Geschwindigkeitssteuerung ---
    const isMoving =
      fpControls?.moveState.forward ||
      fpControls?.moveState.backward ||
      fpControls?.moveState.left ||
      fpControls?.moveState.right;

    // 1. Zielposition vor dem Spieler berechnen
    if (isMoving && isCartFollowingPlayer.value) {
      // KORREKTUR: Wagen nur bewegen, wenn das Following aktiv ist.
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
        camera.quaternion
      );
      forward.y = 0;
      forward.normalize();

      // 1. Berechne die ideale Zielposition (der "Geist").
      idealPosition = new CANNON.Vec3(
        playerBody!.position.x,
        shoppingCartBody.position.y,
        playerBody!.position.z
      );
      idealPosition.vadd(
        new CANNON.Vec3(forward.x, 0, forward.z).scale(0.8),
        idealPosition
      );
      //shoppingCartBody.position.copy(idealPosition);

      // 2. Berechne die ideale Rotation und setze sie.
      shoppingCart.rotation.y = Math.atan2(forward.x, forward.z) + Math.PI;
      const targetQuaternion = new CANNON.Quaternion();
      targetQuaternion.setFromAxisAngle(
        new CANNON.Vec3(0, 1, 0),
        shoppingCart.rotation.y
      );
      //shoppingCartBody.quaternion.copy(targetQuaternion);
      //shoppingCartBody.wakeUp();

      // NEU: Sound abspielen, wenn der Wagen sich bewegt
      if (
        shoppingCartSound &&
        shoppingCartSound.paused &&
        !variablesStore.showInnerBody
      ) {
        shoppingCartSound.play().catch(() => {});
      }
      shoppingCart.position.copy(idealPosition as unknown as THREE.Vector3);
      shoppingCart.quaternion.copy(
        targetQuaternion as unknown as THREE.Quaternion
      );
    } else {
      // NEU: Sound pausieren, wenn der Wagen steht
      if (shoppingCartSound && !shoppingCartSound.paused) {
        shoppingCartSound.pause();
      }
    }

    // 6. Visuelles Modell mit Physik-Modell synchronisieren

    // NEU: Debugger-Mesh mit der Physik synchronisieren
    if (shoppingCartDebugMesh) {
      shoppingCartDebugMesh.position.copy(
        shoppingCartBody.position as unknown as THREE.Vector3
      );
      shoppingCartDebugMesh.quaternion.copy(
        shoppingCartBody.quaternion as unknown as THREE.Quaternion
      );
    }

    // Drop-Zone für Produkte mitbewegen
    productSelection.position.copy(shoppingCart.position);
    productSelection.quaternion.copy(shoppingCart.quaternion);
    productSelectionCannonBodies.position.copy(shoppingCartBody.position);
    productSelectionCannonBodies.position.y = 0.42;
    productSelection.position.y = 0;
  }

  if (taskDone.value == true) {
    _composer.render();
  } else {
    _renderer.render(scene, camera);
  }

  // --- SYNCHRONISATION NACH PHYSIK-UPDATE ---
  // Aktualisiere die visuellen Positionen der Objekte basierend auf dem Ergebnis des Physik-Updates.
  if (!variablesStore.cashoutStart) {
    for (const [mesh, body] of physicObjects.entries()) {
      mesh.position.copy(body.position as unknown as THREE.Vector3);
      mesh.quaternion.copy(body.quaternion as unknown as THREE.Quaternion);
    }
    for (const [mesh, body] of shoppingCartObjects.entries()) {
      const mergedPos = new THREE.Vector3(
        body.position.x,
        body.position.y,
        body.position.z - 3
      );

      //console.log(mergedPos);
      mesh.position.copy(mergedPos);
      mesh.quaternion.copy(body.quaternion as unknown as THREE.Quaternion);
    }
  }

  // NEU: Permanente Hover-Erkennung über das Fadenkreuz in der Bildschirmmitte
  if (!productView.value && !variablesStore.cashoutStart) {
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.intersectObjects(shelves, true); // KORREKTUR: Nur die Regale auf Kollision prüfen.
    if (intersects.length > 0 && intersects[0].distance <= 3.0) {
      const firstHit = intersects[0].object;
      if (firstHit.userData && firstHit.userData.productName) {
        hoveredProduct.value = firstHit.userData.productName;
      } else {
        hoveredProduct.value = undefined;
      }
    } else {
      hoveredProduct.value = undefined;
    }
  }
  if (!variablesStore.cashoutFinished) {
    _renderLoopId = requestAnimationFrame(renderLoop);
  }
}

function resetPositions() {
  if (playerBody && shoppingCartBody && shoppingCart) {
    // 1. Spieler zurücksetzen
    // KORREKTUR: Setze den Spieler leicht ÜBER den Boden (Y=-0.5), um eine Startkollision beim Reset zu verhindern.
    const initialPlayerPos = new CANNON.Vec3(0, -0.9, 4); // KORREKTUR: An neue Bodenhöhe anpassen (Boden bei Y=-1.0)
    playerBody.position.copy(initialPlayerPos);
    playerBody.velocity.set(0, 0, 0);
    playerBody.angularVelocity.set(0, 0, 0);

    // 2. Einkaufswagen zurücksetzen (leicht über dem Boden, vor dem Spieler)
    // KORREKTUR: Setze den Wagen auf eine Position knapp über dem Boden (Boden ist bei Y=-0.5).
    // KORREKTUR: Die Unterkante des Wagens muss auf der korrekten Bodenhöhe Y=-0.5 starten.
    // KORREKTUR: Startposition an neue Bodenhöhe anpassen, um "Hineinfallen" zu vermeiden.
    const initialCartPos = new CANNON.Vec3(0, -0.9, 3); // KORREKTUR: An neue Bodenhöhe anpassen (Boden bei Y=-1.0)
    shoppingCartBody.position.copy(initialCartPos);
    shoppingCartBody.velocity.set(0, 0, 0);
    shoppingCartBody.angularVelocity.set(0, 0, 0);
  }
}

function leaveSelectMode(): void {
  if (selectMode.value) {
    // KORREKTUR: Setze nur den Modus zurück. Die Position des Spielers bleibt, wo sie ist.
    // Die FPV-Steuerung wird durch den Klick auf das Canvas wieder aktiviert.
    selectMode.value = false;
  }
}

/* --- NEU: Funktionen zur Steuerung des Einkaufswagens --- */
function pauseCartFollowing(): void {
  isCartFollowingPlayer.value = false;
}

function resumeCartFollowing(): void {
  isCartFollowingPlayer.value = true;
}
/* --- Lifecycle Hooks --- */
onMounted(() => {
  if (canvas.value) {
    // 1. Leichte Three.js-Initialisierung (ohne Modelle) - Dies setzt die Startposition der Kamera.
    const { renderer } = initThree("mountId");
    _renderer = renderer;

    // NEU: Mache die Funktionen zur Wagen-Steuerung global verfügbar.
    useCartControls(pauseCartFollowing, resumeCartFollowing);

    // NEU: Physik für den Boden initialisieren
    setupFloorPhysics(); // FIX: canvas.value wird jetzt geprüft
    setupWallPhysics(); // NEU: Physik für die Wände initialisieren

    // 2. FPV-Steuerung sofort initialisieren und verbinden
    // KORREKTUR: Stelle sicher, dass canvas.value existiert, bevor es verwendet wird.
    if (!canvas.value) return;
    fpControls = useFirstPersonControls(camera, canvas.value);
    fpControls.connect(); // Wichtig: fpControls.update() muss jetzt manuell im renderLoop aufgerufen werden

    // NEU: Mache fpControls global verfügbar für den Klick-Handler
    (window as any).fpControls = fpControls;

    // 4. Render-Loop starten
    _renderLoopId = requestAnimationFrame(renderLoop);

    // 5. Klick-Events für Interaktionen beibehalten
    canvas.value.width = window.innerWidth;
    canvas.value.height = window.innerHeight;

    // KORREKTUR: Kamera und Renderer an die neue Fenstergröße anpassen
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    _renderer.setSize(window.innerWidth, window.innerHeight);
    _renderer.setPixelRatio(2);

    // KORREKTUR: Kamera beim Start geradeaus schauen lassen.
    // KORREKTUR: Die Kamera-Augenhöhe an die neue Spieler-Startposition anpassen.
    camera.lookAt(0, camera.position.y, camera.position.z - 1);

    // KORREKTUR: Die initiale Position des Wagens so setzen, dass sein tiefster Punkt auf dem Boden (Y=-0.5) steht.
    // KORREKTUR: Setze den Wagen leicht über den Boden, um Startkollisionen zu vermeiden.
    const initialCartPos = new THREE.Vector3(0, -0.9, camera.position.z - 1.0); // KORREKTUR: An neue Bodenhöhe anpassen.
    if (shoppingCart) shoppingCart.position.copy(initialCartPos);
    // if (shoppingCartBody)
    // shoppingCartBody.position.copy(initialCartPos as unknown as CANNON.Vec3);

    // KORREKTUR: Spieler-Kollisionskörper als Box statt Kapsel, um das "Hochrutschen" an Wänden zu verhindern.
    const playerRadius = 0.3;
    const playerHeight = 1.8;
    // Box nimmt halbe Ausmaße (HalfExtents)
    const playerShape = new CANNON.Box(
      new CANNON.Vec3(playerRadius, playerHeight / 2, playerRadius)
    );

    playerBody = new CANNON.Body({
      mass: 5, // NEU: Masse > 0 macht den Körper dynamisch
      material: playerMaterial, // NEU: Material zuweisen
      linearDamping: 0.99, // KORREKTUR: Dämpfung, um das "Rutschen auf Eis" zu verhindern, ohne die Bewegung zu blockieren.
      angularDamping: 0.9, // NEU: Dämpfung für Rotationsstabilität
      allowSleep: false,
      // Die Oberkante des Bodens ist bei Y = -0.5. Die Unterseite der Kugel soll bei Y = -0.5 starten.
      // KORREKTUR: Spieler startet stabil über dem neuen Boden (Boden bei Y=-1.0)
      position: new CANNON.Vec3(camera.position.x, -0.9, camera.position.z),
    });
    // KORREKTUR: Dem Spieler seine Kollisionsgruppe zuweisen, damit er mit dem Boden kollidiert.
    // Er soll NUR mit dem Boden/Regalen kollidieren.
    playerBody.collisionFilterGroup = COLLISION_GROUPS.PLAYER;
    // KORREKTUR: Der Spieler soll nur noch mit dem Boden und den Regalen kollidieren, nicht mehr mit dem Einkaufswagen.
    playerBody.collisionFilterMask =
      COLLISION_GROUPS.GROUND | COLLISION_GROUPS.SHELF;

    // Füge die Formen zum Körper hinzu
    playerBody.addShape(playerShape, new CANNON.Vec3(0, 0, 0)); // Box zentriert

    playerBody.fixedRotation = true; // Verhindert, dass die Kapsel umfällt.
    world.addBody(playerBody);
    // NEU: Event-Listener für Kollisionen direkt am Körper hinzufügen

    usePlayerBody(playerBody);

    // KORREKTUR: Der 'click'-Listener empfängt nur MouseEvents. Die Tasten-Logik wird in den 'keydown'-Listener verschoben.
    window.addEventListener("click", (event: MouseEvent) => {
      // KORREKTUR: Trenne die Logik für das Sperren der Steuerung von der Spiellogik.
      // Wenn die Steuerung nicht gesperrt ist (z.B. nach Verlassen des selectMode),
      // soll der Klick NUR die Steuerung sperren und keine andere Aktion auslösen.
      // NEU: Der Klick soll den Cursor nur sperren, wenn wir nicht in der Produktansicht sind.
      if (!fpControls?.controls.isLocked() && !productView.value) {
        fpControls?.controls.lock();
      } else {
        // NEU: Sound abspielen, wenn ein Produkt angeklickt wird
        if (hoveredProduct.value && grabSound && !productView.value) {
          grabSound.currentTime = 0;
          grabSound.play().catch(() => {});
        }

        // KORREKTUR: Die Bewegungssperre wurde entfernt. Klick-Events werden immer ausgeführt, wenn die Steuerung gesperrt ist.
        clickEvent(event);
        clickCheckout(event, cashRegister); // Vorerst deaktiviert, um den Fehler zu isolieren
      }
    });

    window.addEventListener("keydown", (event) => {
      if (event.code === "Space" && selectMode.value) {
        // Verhindert das Standardverhalten der Leertaste (z.B. Scrollen)
        event.preventDefault();
        selectMode.value = false;
      }
      // KORREKTUR: Die Logik für die 'P'-Taste gehört hierher.
      if (event.key === "p" || event.key === "P") {
        resetPositions();
      }
    });

    // NEU: Audio initialisieren
    supermarketSound = new Audio("/sound/supermarket.mp3");
    supermarketSound.loop = true;
    supermarketSound.volume = 0.5; // Leise Hintergrundatmosphäre

    shoppingCartSound = new Audio("/sound/shopping_cart.wav");
    shoppingCartSound.loop = true;
    shoppingCartSound.volume = 0.5;

    grabSound = new Audio("/sound/grab.mov");
    grabSound.volume = 0.5;

    // Hintergrundsound starten
    if (!variablesStore.showInnerBody) {
      supermarketSound.play().catch(() => {
        // Fallback für Autoplay-Blocker: Starten bei erster Interaktion
        const startAudio = () => {
          if (!variablesStore.showInnerBody && supermarketSound)
            supermarketSound.play();
          window.removeEventListener("click", startAudio);
          window.removeEventListener("keydown", startAudio);
        };
        window.addEventListener("click", startAudio);
        window.addEventListener("keydown", startAudio);
      });
    }
  }
});

watch(selectMode, (isSelectMode: boolean) => {
  if (isSelectMode) {
    // NEU: Wenn wir in den selectMode wechseln, positioniere den Einkaufswagen sofort neu.
    if (playerBody && shoppingCart) {
      // 1. Holen der aktuellen Kameraausrichtung (Blickrichtung des Spielers)
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
        camera.quaternion
      );
      forward.y = 0; // Bewegung nur auf der XZ-Ebene
      forward.normalize();

      // 2. Berechne die neue Zielposition für den Wagen (direkt vor dem Spieler)
      const playerPos = playerBody.position as unknown as THREE.Vector3;
      const newCartPos = new THREE.Vector3()
        .copy(playerPos)
        .add(forward.multiplyScalar(0.5)); // Sehr naher Abstand nur für den selectMode
      newCartPos.y = playerPos.y + 0.2; // Y-Position anpassen

      // 3. Setze die Position des Wagens und der "Lerp"-Ziele sofort auf die neue Position.
      shoppingCart.position.copy(newCartPos);
      cartTargetPosition.copy(newCartPos);
      smoothedCartTargetPosition.copy(newCartPos);

      // 4. (NEU) Richte den Wagen sofort korrekt aus.
      // Der Griff soll zum Spieler zeigen, also um 180 Grad zur Blickrichtung gedreht.
      shoppingCart.rotation.y = Math.atan2(forward.x, forward.z) + Math.PI;

      // 5. (NEU) Teleportiere den Physik-Körper des Wagens direkt an die neue Position,
      // um einen sauberen Start im selectMode zu gewährleisten.
      if (shoppingCartBody) {
        // Die Logik zum Bewegen des Wagens wurde nach useMovePlayerTo verschoben, aber wir setzen sie hier trotzdem, um sicherzustellen, dass der Wagen an der richtigen Stelle ist.
      }
    }
  }
});

// NEU: Watcher, um den Sound zu stoppen, wenn die Parallax-Szene (InnerBody) aktiv ist
watch(
  () => variablesStore.showInnerBody,
  (show) => {
    if (show) {
      supermarketSound?.pause();
      shoppingCartSound?.pause();
    } else {
      supermarketSound?.play().catch(() => {});
    }
  }
);

onBeforeUnmount(() => {
  cancelAnimationFrame(_renderLoopId);
  // NEU: Trenne die Event-Listener beim Verlassen der Komponente
  if (fpControls) {
    fpControls.disconnect();
  }
  cleanUpThree(scene, _renderer);
  supermarketSound?.pause();
  shoppingCartSound?.pause();
});

/* --- Exposed Functions --- */
defineExpose({
  setupScene,
  checkIntersects,
  pauseCartFollowing,
  resumeCartFollowing,
}); // FIX: defineExpose ist jetzt importiert
</script>

<template>
  <div class="cursor-none fixed top-0 left-0">
    <div ref="statsContainer" class="stats"></div>
    <canvas class="cursor-none" id="mountId" width="700" height="500" />
    <ProductSelectMenu class="cursor-none" v-if="selectMode || productView" />
    <Cursor
      :mousePos="mousePos"
      :clickable="clickable"
      v-if="variablesStore.cursorFree || productView"
      class="cursor-none pointer-events-none z-100"
    />
    <!-- NEU: Fadenkreuz für den FPV-Modus -->
    <div v-if="!productView" class="crosshair"></div>
    <!-- KORREKTUR: Tooltip immer anzeigen, wenn ein Produkt anvisiert wird (außer in der productView) -->
    <div v-if="hoveredProduct && !productView" class="product-tooltip">
      {{ hoveredProduct }}
    </div>
  </div>
</template>

<style>
.crosshair {
  position: fixed;
  top: 50%;
  left: 50%;
  width: 4px;
  height: 4px;
  background-color: white;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none; /* Stellt sicher, dass das Fadenkreuz keine Klicks abfängt */
  mix-blend-mode: difference; /* Sorgt dafür, dass das Kreuz auf hellen und dunklen Hintergründen sichtbar ist */
}

.product-tooltip {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(
    -50%,
    -150%
  ); /* Verschiebt die Box über das Fadenkreuz */
  padding: 8px 12px;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  border-radius: 6px;
  font-family: sans-serif;
  font-size: 14px;
  pointer-events: none; /* Stellt sicher, dass der Tooltip keine Klicks abfängt */
  white-space: nowrap; /* Verhindert Zeilenumbrüche */
}
</style>
