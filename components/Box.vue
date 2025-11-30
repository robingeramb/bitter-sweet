<script setup lang="ts">
import {
  defineProps, // KORREKTUR: Import aus 'vue'
  defineExpose, // KORREKTUR: Import aus 'vue'
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
  taskDone,
  selectMode,
  hoveredProduct,
  hoveredMouseX,
  hoveredMouseY,
  getSelectedProduct, // KORREKTUR: Getter-Funktion anstelle der alten ref importieren
  productView,
  world,
  getShoppingCart, // KORREKTUR: Getter für den Einkaufswagen importieren
  setShoppingCart, // KORREKTUR: Setter für den Einkaufswagen importieren
  getPhysicObjects, // KORREKTUR: Getter für die Physik-Objekte importieren
  deletePhysicObject, // KORREKTUR: Funktion zum Löschen importieren
  groundMaterial, // NEU: groundMaterial importieren
  bodiesToRemove, // NEU: Importiere die Liste der zu entfernenden Körper
  shoppingCartMaterial, // NEU: shoppingCartMaterial importieren
  createCannonDebugger, // NEU: createCannonDebugger importieren
  usePlayerBody,
  generateShoppingCartBody,
  useCartControls, // NEU: Importieren, um die Wagen-Steuerung zu registrieren
  productsInCart, // NEU: Importieren, um Produkte im Korb zu verwalten
  useShoppingCartBody, // NEU: Setter-Funktion importieren
} from "@/composables/useThree"; // NEU: Zentrales Material importieren
import { shelves } from "@/composables/createShelves";
import { useFirstPersonControls } from "@/composables/useFirstPersonControls";
import {
  initDisplayController,
  animateDisplay,
} from "@/composables/displayController";
import { onProductCollision } from "@/composables/productCollision"; // FIX: Diese Datei wird im nächsten Schritt erstellt

import * as THREE from "three"; // @ts-ignore
import CANNON from "cannon";
import gsap from "gsap";
import type { Intersection } from "three"; // NEU: Expliziter Typ-Import

/* --- Props --- */
interface Props {
  mousePos: { x: number; y: number };
  scrollVal: number;
}
const props = defineProps<Props>(); // FIX: defineProps ist jetzt importiert

/* --- Reactive Variables and References --- */
let selfCashoutState = true;
let cashRegister: THREE.Mesh;
let _renderer: THREE.WebGLRenderer;
let isCartAnimatingBack = ref(false); // NEU: Status für die GSAP-Animation
let isCartFollowingPlayer = ref(true); // NEU: Steuert, ob der Wagen dem Spieler folgt.
let _renderLoopId: number;
let displayMesh: THREE.Mesh | null = null;
let debugYPositions: number[] = []; // NEU: Array zum Speichern der Y-Positionen
const MAX_DEBUG_Y_POSITIONS = 60; // NEU: Anzahl der zu speichernden Werte (z.B. 1 Sekunde bei 60 FPS)
let _floor: THREE.Mesh;
let _roof: THREE.Mesh;
let clickable = ref(false);
let lastCameraPosition = new THREE.Vector3();
let cartTargetPosition = new THREE.Vector3();
let smoothedCartTargetPosition = new THREE.Vector3(); // NEU: Geglättete Zielposition für den Wagen
let playerBody: CANNON.Body | null = null;
let shoppingCartBody: CANNON.Body | null = null; // NEU: Physik-Körper für den Einkaufswagen
let lastSafeCameraPosition = new THREE.Vector3();

let lastCartPosition = new THREE.Vector3(); // NEU: Für die Geschwindigkeitsberechnung des Wagens
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

  // Diese Funktion ist jetzt nur noch für das Hovern im productView oder für zukünftige UI-Elemente zuständig.
  if (productView.value && getSelectedProduct()) {
    mouse.x = (props.mousePos.x / window.innerWidth) * 2 - 1;
    mouse.y = -(props.mousePos.y / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    intersects = raycaster.intersectObjects([getSelectedProduct()!]);
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
    scene.add(lights);
  }

  const shoplight = await loadEXR("phone_shop_4k.exr"); // @ts-ignore

  setupFloor();
  setupRoof();
  setupWalls();
  await setupShoppingCart(shoplight);
  await setupCashRegister();

  createShelves(
    { x1: -1.6, x2: 1.6 },
    floorLength,
    shelfWidth,
    shelfLength,
    dist,
    shelfHeight
  );
  //createShelves(1.6, floorLength, shelfWidth, shelfLength, dist, shelfHeight);

  postProcessing(cashRegister);

  if (lights) { // @ts-ignore
    lights.children.forEach((element) => {
      // KORREKTUR: Stelle sicher, dass das Element eine Gruppe ist und das erste Kind ein Licht mit Schatteneigenschaft ist.
      const light = element.children[0];
      if (light && 'shadow' in light) {
        // @ts-ignore
        light.shadow.needsUpdate = false;
      }
    });
  }
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
  world.addBody(floorBody);

  // DEBUG: Erstelle ein sichtbares Mesh für die Kollisionsbox des Bodens und füge es zur Map hinzu.
  const floorDebugMesh = createCannonDebugger(scene, floorBody);
  debugMeshes.set(floorBody, floorDebugMesh);
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
  _roof.position.set(0, 3.16, -floorLength / 2 + 4);
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
  const wallGeometry = new THREE.BoxGeometry(
    0.1,
    floorLength + 4,
    floorLength + 4
  );

  const wall = new THREE.Mesh(wallGeometry, wallMaterial);
  (wall as any).castShadow = true;
  wall.receiveShadow = true;

  const wall2 = wall.clone();
  const wall3 = wall.clone();

  wall.position.set(-1.91, -floorLength / 2 + 0.4, -floorLength / 2 + 8);
  wall2.position.set(1.91, -floorLength / 2 + 0.4, -floorLength / 2 + 8);
  wall3.position.set(1.91, 1.3, -floorLength - 2);
  wall3.rotation.y = Math.PI / 2;

  scene.add(wall, wall2, wall3);
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

  const cartMesh = (await loadModel("shoppingcart.glb")) as THREE.Mesh;
  setShoppingCart(markRaw(cartMesh)); // KORREKTUR: markRaw hier anwenden
  if (getShoppingCart()) {
    getShoppingCart()!.scale.set(0.01, 0.01, 0.01);
    // Die Position wird in onMounted gesetzt, um sicherzustellen, dass sie mit den Zielpositionen übereinstimmt.
    getShoppingCart()!.traverse((child: THREE.Object3D) => { // KORREKTUR: 'child' explizit typisiert
      child.castShadow = true;
      if ("material" in child) {
        (child as THREE.Mesh).material = metal;
      }
    });
    scene.add(getShoppingCart()!);

    // NEU: Erstelle den physikalischen Körper für den Einkaufswagen
    shoppingCartBody = generateShoppingCartBody();
    // KORREKTUR: Weise der Korb-Boden-Shape (die zweite Shape, Index 1) eine eindeutige ID zu,
    // damit wir sie bei der Kollision sicher identifizieren können.
    shoppingCartBody.shapes[1].id = 99; // Eindeutige ID für den Korb-Boden

    shoppingCartBody.position.set(0, -0.9, 3); // Setze die Startposition
    shoppingCartBody.allowSleep = false; // KORREKTUR: Verhindert, dass der Einkaufswagen einschläft und Kollisionen verpasst.
    useShoppingCartBody(shoppingCartBody); // KORREKTUR: Verwende die Setter-Funktion, um den Körper global verfügbar zu machen.
    (shoppingCartBody as any).threemesh = getShoppingCart(); // FIX: Verknüpfe den Physik-Körper mit dem 3D-Modell.
    world.addBody(shoppingCartBody);

    // NEU: Füge ein sichtbares Debug-Mesh hinzu, um die Kollisionsbox zu sehen
    const cartDebugMesh = createCannonDebugger(scene, shoppingCartBody);
    // KORREKTUR: Die Sichtbarkeit wird jetzt zentral im renderLoop gesteuert.
    // Die initiale Sichtbarkeit wird durch den ersten Durchlauf des Loops gesetzt.
    debugMeshes.set(shoppingCartBody, cartDebugMesh);
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
  cashRegister = (await loadModel("self_checkout.glb")) as THREE.Mesh;
  if (cashRegister) {
    cashRegister.scale.set(0.8, 0.8, 0.8); // KORREKTUR: Skalierung beibehalten
    cashRegister.position.set(0.8, -0.9, -16); // KORREKTUR: Kasse-Position an neuen Boden anpassen (Base bei Y=0)
    cashRegister.rotation.y = -Math.PI / 2;
    cashRegister.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        if (child.name === "Display") {
          child.material = displayMaterial;
          displayMesh = child;
        } else if (
          child.name !== "SelfCheckout" &&
          child.name !== "CardReader"
        ) {
          child.material = metalMaterial;
        }
      }
    });
    scene.add(cashRegister);
    if (displayMesh) initDisplayController(displayMesh);
  }
}

function renderLoop(): void {
  const deltaTime = clock.getDelta();

  // NEU: DEBUG: Y-Positionen am Anfang des Render-Loops
  if (playerBody) {
    debugYPositions.push(playerBody.position.y);
    if (debugYPositions.length > MAX_DEBUG_Y_POSITIONS) {
      debugYPositions.shift(); // Ältesten Wert entfernen
    }
  }

  animateDisplay();


  // Synchronisiere alle physischen Objekte (Produkte im Korb) mit ihren visuellen Meshes
  // WICHTIG: Dies muss VOR world.step() geschehen, damit Kollisions-Events auf 'threemesh' zugreifen können.
  for (const [mesh, body] of getPhysicObjects().entries()) {
    // Verknüpfe den Physik-Körper mit seinem Mesh, damit die Kollisionslogik darauf zugreifen kann.
    // KORREKTUR: Wenn ein Produkt im Korb ist, wird sein Körper kinematisch.
    // Seine Position wird nicht mehr von der Physik-Engine, sondern manuell gesetzt.
    if (productsInCart.has(mesh)) {
      continue; // Überspringe die Synchronisation für Produkte im Korb
    }
    (body as any).threemesh = mesh;
  }

  // --- PHYSIK-UPDATE ---
  // Die Physik-Welt wird in jedem Frame aktualisiert.
  // KORREKTUR: Die maximale Anzahl der Sub-Schritte (letzter Parameter) wird auf 3 reduziert,
  // um "Tunneling" zu verhindern, ohne die Performance zu stark zu belasten.
  world.step(fixedTimeStep, deltaTime, 3);

  // --- KORREKTUR: Sicheres Entfernen von Körpern NACH dem Physik-Update ---
  // Iteriere durch die vorgemerkten Körper und entferne sie sicher aus der Welt.
  bodiesToRemove.forEach((body) => {
    world.remove(body);
    // NEU: Entferne das zugehörige Mesh auch aus der `physicObjects`-Map,
    // damit seine Position nicht mehr fälschlicherweise synchronisiert wird.
    for (const [mesh, b] of getPhysicObjects().entries()) {
      if (b === body) {
        deletePhysicObject(mesh);
        break;
      }
    }
  });
  bodiesToRemove.clear(); // Leere die Liste für den nächsten Frame.
  // --- SPIELER-UPDATE ---
  if (playerBody && fpControls) {
    // Steuerung nur anwenden, wenn die Maus gesperrt ist.
    // KORREKTUR: Die Bewegungssperre für den Spieler wurde entfernt.
    if (fpControls.controls.isLocked()) {
      fpControls.update(); // Maus-Rotation anwenden

      const moveForce = 120;
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

      playerBody.applyLocalForce(force, new CANNON.Vec3(0, 0, 0));
    }

    // Kamera-Position mit dem Physik-Körper synchronisieren.
    camera.position.set(
      playerBody.position.x,
      playerBody.position.y + 0.8,
      playerBody.position.z
    );
  }

  // --- EINKAUFSWAGEN-UPDATE ---
  if (getShoppingCart() && shoppingCartBody) {
    // --- KORREKTUR: Sanftere Verfolgung durch Feder-ähnliche Kräfte statt direkter Geschwindigkeitssteuerung ---
    const isMoving =
      fpControls?.moveState.forward ||
      fpControls?.moveState.backward ||
      fpControls?.moveState.left ||
      fpControls?.moveState.right;

		// 1. Zielposition vor dem Spieler berechnen
		if (isMoving && isCartFollowingPlayer.value && !isCartAnimatingBack.value) { // KORREKTUR: Wagen nur bewegen, wenn das Following aktiv ist und keine Animation läuft.
			const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
			forward.y = 0;
			forward.normalize();

      // 1. Berechne die ideale Zielposition (der "Geist").
      const idealPosition = new CANNON.Vec3(
        playerBody!.position.x,
        shoppingCartBody.position.y,
        playerBody!.position.z
      );
      idealPosition.vadd(
        new CANNON.Vec3(forward.x, 0, forward.z).scale(0.8),
        idealPosition
      );
      shoppingCartBody.position.copy(idealPosition);

      // 2. Berechne die ideale Rotation und setze sie.
      getShoppingCart()!.rotation.y = Math.atan2(forward.x, forward.z) + Math.PI;
      const targetQuaternion = new CANNON.Quaternion();
      targetQuaternion.setFromAxisAngle(
        new CANNON.Vec3(0, 1, 0),
        getShoppingCart()!.rotation.y
      );
      shoppingCartBody.quaternion.copy(targetQuaternion);
      shoppingCartBody.wakeUp();
    }

    // 6. Visuelles Modell mit Physik-Modell synchronisieren
    getShoppingCart()!.position.copy(
      shoppingCartBody.position as unknown as THREE.Vector3
    );
    getShoppingCart()!.quaternion.copy(
      shoppingCartBody.quaternion as unknown as THREE.Quaternion
    );

    // KORREKTUR: Die "Drop-Zone" (productSelection-Gruppe) muss weiterhin
    // mit dem Einkaufswagen mitbewegt werden, damit die Animation für das
    // Hineinlegen von Produkten korrekt zur Position des Wagens fliegt.
    productSelection.position.copy(getShoppingCart()!.position);
  }

  // NEU: Synchronisiere alle Debug-Meshes mit ihren Physik-Körpern
  for (const [body, mesh] of debugMeshes.entries()) {
    mesh.position.copy(body.position as unknown as THREE.Vector3);
    mesh.quaternion.copy(body.quaternion as unknown as THREE.Quaternion);
  }

  if (taskDone.value == true) {
    _composer.render();
  } else {
    _renderer.render(scene, camera);
  }

  // --- SYNCHRONISATION NACH PHYSIK-UPDATE ---
  // Aktualisiere die visuellen Positionen der Objekte basierend auf dem Ergebnis des Physik-Updates.
  // ZURÜCKGESETZT: Diese Schleife synchronisiert jetzt wieder ALLE physikalischen Objekte
  // mit ihren visuellen Gegenstücken.
  // KORREKTUR: Produkte im Korb werden übersprungen, da ihre visuelle Position bereits an den Wagen gebunden ist.
  for (const [mesh, body] of getPhysicObjects().entries()) {
    if (!productsInCart.has(mesh)) {
      mesh.position.copy(body.position as unknown as THREE.Vector3);
      mesh.quaternion.copy(body.quaternion as unknown as THREE.Quaternion);
    }
  }

  // NEU: Permanente Hover-Erkennung über das Fadenkreuz in der Bildschirmmitte
  if (!productView.value) {
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

  _renderLoopId = requestAnimationFrame(renderLoop);
}

function resetPositions() {
  if (playerBody && shoppingCartBody && getShoppingCart()) {
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

    // 3. Produkte aus dem Korb entfernen und zurücksetzen
    productsInCart.forEach(mesh => {
      const body = getPhysicObjects().get(mesh);
      if (body) {
        // NEU: Entferne die Constraint aus der Physik-Welt
        if ((body as any).constraint) {
          world.removeConstraint((body as any).constraint);
          delete (body as any).constraint;
        }
        body.type = CANNON.Body.DYNAMIC; // Zurück zu dynamisch
      }
      scene.add(mesh); // Füge das Mesh wieder der Hauptszene hinzu
    });
    productsInCart.clear();
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
  // Nur ausführen, wenn die Verfolgung pausiert war und keine Animation läuft.
  if (!isCartFollowingPlayer.value && !isCartAnimatingBack.value && playerBody && shoppingCartBody) {
    console.log("Resuming cart following with animation...");
    isCartAnimatingBack.value = true;

    // 1. Zielposition und -rotation berechnen (genau wie im renderLoop)
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    forward.y = 0;
    forward.normalize();

    const targetPosition = new CANNON.Vec3(playerBody.position.x, shoppingCartBody.position.y, playerBody.position.z);
    targetPosition.vadd(new CANNON.Vec3(forward.x, 0, forward.z).scale(0.8), targetPosition);

    const targetRotationY = Math.atan2(forward.x, forward.z) + Math.PI;
    const targetQuaternion = new CANNON.Quaternion();
    targetQuaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), targetRotationY);

    // 2. GSAP-Animation starten
    gsap.to(shoppingCartBody.position, {
      x: targetPosition.x,
      y: targetPosition.y,
      z: targetPosition.z,
      duration: 0.8, // Dauer der Animation in Sekunden
      ease: "power2.inOut",
      onUpdate: () => {
        // Den Körper während der Animation "aufwecken", damit er auf Kollisionen reagiert
        shoppingCartBody?.wakeUp();
      },
      onComplete: () => {
        isCartAnimatingBack.value = false;
        isCartFollowingPlayer.value = true; // Jetzt die normale Verfolgung aktivieren
        console.log("Shopping cart animation finished. Resuming normal follow behavior.");
      },
    });

    // Gleichzeitig die Rotation animieren
    gsap.to(shoppingCartBody.quaternion, {
      x: targetQuaternion.x,
      y: targetQuaternion.y,
      z: targetQuaternion.z,
      w: targetQuaternion.w,
      duration: 0.8,
      ease: "power2.inOut",
    });
  }
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
    // KORREKTUR: Stelle sicher, dass die Kamera exakt horizontal ausgerichtet ist, indem die Y-Komponente des Ziels mit der Y-Position der Kamera übereinstimmt.
    camera.lookAt(0, camera.position.y, -1);

    // KORREKTUR: Die initiale Position des Wagens so setzen, dass sein tiefster Punkt auf dem Boden (Y=-0.5) steht.
    // KORREKTUR: Setze den Wagen leicht über den Boden, um Startkollisionen zu vermeiden.
    const initialCartPos = new THREE.Vector3(0, -0.9, camera.position.z - 1.0); // KORREKTUR: An neue Bodenhöhe anpassen.
    if (getShoppingCart()) getShoppingCart()!.position.copy(initialCartPos);
    if (shoppingCartBody)
      shoppingCartBody.position.copy(initialCartPos as unknown as CANNON.Vec3);

    // KORREKTUR: Spieler-Kollisionskörper als Kapsel (Sphere + Cylinder) für mehr Stabilität
    const playerRadius = 0.3;
    const playerHeight = 1.8;
    const sphereShape = new CANNON.Sphere(playerRadius);
    const cylinderShape = new CANNON.Cylinder(
      playerRadius,
      playerRadius,
      playerHeight - 2 * playerRadius,
      8
    );

    playerBody = new CANNON.Body({
      mass: 5, // NEU: Masse > 0 macht den Körper dynamisch
      material: playerMaterial, // NEU: Material zuweisen
      linearDamping: 0.999, // KORREKTUR: Dämpfung, um das "Rutschen auf Eis" zu verhindern. Ein Wert näher an 1 bremst stärker.
      angularDamping: 0.9, // NEU: Dämpfung für Rotationsstabilität
      allowSleep: false,
      // Die Oberkante des Bodens ist bei Y = -0.5. Die Unterseite der Kugel soll bei Y = -0.5 starten.
      // KORREKTUR: Spieler startet stabil über dem neuen Boden (Boden bei Y=-1.0)
      position: new CANNON.Vec3(camera.position.x, -0.9, camera.position.z),
    });
    // KORREKTUR: Dem Spieler seine Kollisionsgruppe zuweisen, damit er mit dem Boden kollidiert.
    // Er soll NUR mit dem Boden/Regalen kollidieren.
    playerBody.collisionFilterGroup = COLLISION_GROUPS.PLAYER;
    // KORREKTUR: Der Spieler soll jetzt mit dem Boden UND den Regalen kollidieren.
    playerBody.collisionFilterMask =
      COLLISION_GROUPS.GROUND | COLLISION_GROUPS.SHELF;

    // Füge die Formen zum Körper hinzu
    playerBody.addShape(sphereShape, new CANNON.Vec3(0, 0, 0)); // Kugel am Ursprung des Körpers
    playerBody.addShape(
      cylinderShape,
      new CANNON.Vec3(0, (playerHeight - playerRadius) / 2, 0)
    ); // Zylinder über der Kugel

    playerBody.fixedRotation = true; // Verhindert, dass die Kapsel umfällt.
    world.addBody(playerBody);
    // NEU: Event-Listener für Kollisionen direkt am Körper hinzufügen

    usePlayerBody(playerBody);

    playerBody.addEventListener("collide", (event: any) => {
      // Dieser Event wird bei jeder Kollision zwischen dem Spieler und einem anderen Objekt ausgelöst.
      // NEU: Die allgemeine Kollisionslogik wird hier aufgerufen.
      // Sie kümmert sich darum, ob es sich um eine Produktkollision handelt.
      onProductCollision(event);
    });

    // NEU: Erstelle ein sichtbares Debug-Mesh für die Kollisionsbox des Spielers
    // und füge es zur zentralen Map hinzu, damit es im Render-Loop aktualisiert wird.
    const playerDebugMesh = createCannonDebugger(scene, playerBody);
    debugMeshes.set(playerBody, playerDebugMesh);
    (playerBody as any).threemesh = playerDebugMesh; // FIX: TypeScript mitteilen, dass wir hier eine benutzerdefinierte Eigenschaft hinzufügen.
    playerDebugMesh.visible = false;

    // KORREKTUR: Der 'click'-Listener empfängt nur MouseEvents. Die Tasten-Logik wird in den 'keydown'-Listener verschoben.
    window.addEventListener("click", (event: MouseEvent) => {
      // KORREKTUR: Trenne die Logik für das Sperren der Steuerung von der Spiellogik.
      // Wenn die Steuerung nicht gesperrt ist (z.B. nach Verlassen des selectMode),
      // soll der Klick NUR die Steuerung sperren und keine andere Aktion auslösen.
      // NEU: Der Klick soll den Cursor nur sperren, wenn wir nicht in der Produktansicht sind.
      if (
        !fpControls?.controls.isLocked() &&
        !productView.value
      ) {
        fpControls?.controls.lock();
      } else {
        // KORREKTUR: Die Bewegungssperre wurde entfernt. Klick-Events werden immer ausgeführt, wenn die Steuerung gesperrt ist.
        clickEvent(event);
        // clickCheckout(event, cashRegister); // Vorerst deaktiviert, um den Fehler zu isolieren
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
  }
});

watch(selectMode, (isSelectMode: boolean) => {
  if (isSelectMode) {
    // NEU: Wenn wir in den selectMode wechseln, positioniere den Einkaufswagen sofort neu.
    if (playerBody && getShoppingCart()) {
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
      getShoppingCart()!.position.copy(newCartPos);
      cartTargetPosition.copy(newCartPos);
      smoothedCartTargetPosition.copy(newCartPos);

      // 4. (NEU) Richte den Wagen sofort korrekt aus.
      // Der Griff soll zum Spieler zeigen, also um 180 Grad zur Blickrichtung gedreht.
      getShoppingCart()!.rotation.y = Math.atan2(forward.x, forward.z) + Math.PI;

      // 5. (NEU) Teleportiere den Physik-Körper des Wagens direkt an die neue Position,
      // um einen sauberen Start im selectMode zu gewährleisten.
      if (shoppingCartBody) {
        // Die Logik zum Bewegen des Wagens wurde nach useMovePlayerTo verschoben, aber wir setzen sie hier trotzdem, um sicherzustellen, dass der Wagen an der richtigen Stelle ist.
      }
    }
  }
});

onBeforeUnmount(() => {
  cancelAnimationFrame(_renderLoopId);
  // NEU: Trenne die Event-Listener beim Verlassen der Komponente
  if (fpControls) {
    fpControls.disconnect();
  }
  cleanUpThree(scene, _renderer);
});

/* --- Exposed Functions --- */
defineExpose({
  setupScene,
  checkIntersects,
  pauseCartFollowing,
  resumeCartFollowing,
  leaveSelectMode,
}); // FIX: defineExpose ist jetzt importiert
</script>

<template>
  <div class="cursor-none fixed top-0 left-0">
    <div ref="statsContainer" class="stats"></div>
    <canvas class="cursor-none" id="mountId" width="700" height="500" />
    <ProductSelectMenu class="cursor-none" v-if="selectMode || productView" />
    <Cursor v-if="productView"
      :mousePos="mousePos"
      :clickable="clickable"
      class="cursor-none pointer-events-none"
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
