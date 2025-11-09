<script setup lang="ts">
/* --- Imports --- */
import {
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
  selectedProduct,
  productView,
  world,
  usePlayerBody,
} from "@/composables/useThree"; // NEU: Zentrales Material importieren
import { useMoveCamera } from "@/composables/moveCamera";
import { useFirstPersonControls } from "@/composables/useFirstPersonControls";
import * as THREE from "three";
import * as CANNON from "cannon";
import {
  defineProps,
  defineExpose,
  ref,
  computed,
  watch,
  onMounted,
  onBeforeUnmount,
} from "vue";

/* --- Props --- */
interface Props {
  mousePos: { x: number; y: number };
  scrollVal: number;
}
const props = defineProps<Props>();

/* --- Reactive Variables and References --- */
let shoppingCart: THREE.Mesh | null = null;
let cashRegister: THREE.Mesh;
let _renderer: THREE.WebGLRenderer;
let _renderLoopId: number;
let debugYPositions: number[] = []; // NEU: Array zum Speichern der Y-Positionen
const MAX_DEBUG_Y_POSITIONS = 60; // NEU: Anzahl der zu speichernden Werte (z.B. 1 Sekunde bei 60 FPS)
let _floor: THREE.Mesh;
let _roof: THREE.Mesh;
let clickable = ref(false);
let lastCameraPosition = new THREE.Vector3();
let cartTargetPosition = new THREE.Vector3();
let smoothedCartTargetPosition = new THREE.Vector3(); // NEU: Geglättete Zielposition für den Wagen
let playerBody: CANNON.Body | null = null;
let lastSafeCameraPosition = new THREE.Vector3();

const fixedTimeStep = 1 / 60; // Fester, empfohlener Timestep für die Physik

/* --- Constants --- */
const floorLength = 20;
const shelfLength = 0.5;
const shelfHeight = 2;
const shelfWidth = 2.5;
const dist = 0.12;

/* --- Composables --- */
const { initThree, cleanUpThree } = useThree();
const { moveCameraZ } = useMoveCamera(); // Wird für die Startposition und das Verlassen des Select-Mode benötigt
const canvas = computed(
  (): HTMLCanvasElement | null =>
    document.getElementById("mountId") as HTMLCanvasElement
);
let fpControls: ReturnType<typeof useFirstPersonControls> | null = null;

/* --- Watches --- */
// Der Watch für das Scrollen wird entfernt, die Steuerung erfolgt jetzt über FPV.
watch(() => [props.mousePos.x, props.mousePos.y], checkIntersects);

function checkIntersects() {
  mouse.x = (props.mousePos.x / window.innerWidth) * 2 - 1;
  mouse.y = -(props.mousePos.y / window.innerHeight) * 2 + 1;
  let intersects: THREE.Intersection[] = [];

  hoveredMouseX.value = props.mousePos.x;
  hoveredMouseY.value = props.mousePos.y;
  raycaster.setFromCamera(mouse, camera);
  if (productView.value) {
    if (selectedProduct.value)
      intersects = raycaster.intersectObjects([selectedProduct.value]);
    // KORREKTUR: Die Prüfung auf intersects.length muss nach der möglichen Zuweisung erfolgen.
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
  } else {
    intersects = raycaster.intersectObjects(shelves);
    if (taskDone.value) {
      let cashCounter = raycaster.intersectObjects([cashRegister]);
      if (cashCounter.length > 0) {
        intersects.push(cashCounter[0]);
      }
    }
    if (intersects.length > 0) {
      if (selectMode.value) {
        let hoveredObject = intersects[0].object;
        if (
          hoveredObject.userData &&
          hoveredObject.userData.productName != undefined
        ) {
          hoveredProduct.value = hoveredObject.userData.productName;
          clickable.value = true;
        } else {
          hoveredProduct.value = undefined;
          clickable.value = false;
        }
      } else {
        clickable.value = true;
      }
    } else {
      clickable.value = false;
    }
  }
}

/* --- Functions --- */
async function setupScene(): Promise<void> {
  // Die Initialisierung von Three.js und der Render-Loop erfolgen jetzt in onMounted.
  // Diese Funktion lädt nur noch die schweren 3D-Objekte.

  const lights = await createLights(floorLength, shelfWidth, shelfLength, dist);
  scene.add(lights);

  const shoplight = await loadEXR("phone_shop_4k.exr");

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
  _floor.position.set(0, -0.55, -floorLength / 2 + 4); // Boden-Mitte auf -0.55 setzen, damit Oberseite bei Y=-0.5 ist (ursprüngliche Höhe)
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
    material: shelfMaterial, // Wir verwenden das gleiche Material wie für die Regale
    position: new CANNON.Vec3(0, -0.55, -floorLength / 2 + 4), // KORREKTUR: Physikalischen Boden an visuelle Höhe anpassen
  });
  world.addBody(floorBody);
  console.log(
    `DEBUG: Floor Body created at Y: ${floorBody.position.y}, Half Extents Y: ${floorShape.halfExtents.y}`
  );

  // DEBUG: Erstelle ein sichtbares Mesh für die Kollisionsbox des Bodens
  const debugFloorMaterial = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    wireframe: true,
    transparent: true,
    opacity: 0.5,
    visible: false,
  });
  const floorDebugMesh = new THREE.Mesh(
    new THREE.BoxGeometry(
      floorShape.halfExtents.x * 2,
      floorShape.halfExtents.y * 2,
      floorShape.halfExtents.z * 2
    ),
    debugFloorMaterial
  );
  scene.add(floorDebugMesh);
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
  (_roof.material as THREE.Material).transparent = true;
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

    // generateShoppingCartBorderBox(); // KORREKTUR: Diese Funktion erstellt statische Kollisionskörper am Weltursprung, was die "Stolperfalle" verursacht.
  }
}

async function setupCashRegister(): Promise<void> {
  cashRegister = (await loadModel("kasse.glb")) as THREE.Mesh;
  if (cashRegister) {
    cashRegister.scale.set(0.2, 0.2, 0.2); // KORREKTUR: Skalierung beibehalten
    cashRegister.position.set(0.8, 0, -16); // KORREKTUR: Kasse-Position an neuen Boden anpassen (Base bei Y=0)
    cashRegister.rotation.y = Math.PI / 2;
    cashRegister.traverse((child) => {
      child.castShadow = true;
    });
    scene.add(cashRegister);
  }
}

function renderLoop(): void {
  const deltaTime = clock.getDelta();

  if (playerBody && fpControls) {
    world.step(fixedTimeStep, deltaTime, 10); // Fester Timestep für stabile Physik

    // NEU: DEBUG: Y-Positionen am Anfang des Render-Loops
    if (playerBody) {
      debugYPositions.push(playerBody.position.y);
      if (debugYPositions.length > MAX_DEBUG_Y_POSITIONS) {
        debugYPositions.shift(); // Ältesten Wert entfernen
      }
    }

    // KORREKTUR: Die gesamte FPV-Bewegungslogik darf nur ausgeführt werden,
    // wenn die Steuerung aktiv ist (Maus gesperrt).
    if (fpControls.controls.isLocked()) {
      if (playerBody && fpControls && _renderer) {
        // Aktualisiere die FPV-Steuerung, um die Kamerarotation und den Bewegungszustand zu erhalten.
        // Die FPV-Steuerung bewegt die Kamera nicht mehr direkt, sondern wir nutzen ihre Eingaben.
        fpControls.update();

        // Berechne die gewünschte Geschwindigkeit basierend auf den FPV-Steuerungseingaben
        const moveSpeed = 8; // Geschwindigkeit des Spielers (erhöht für schnellere Bewegung)
        const inputVelocity = new THREE.Vector3();
        const euler = new THREE.Euler().setFromQuaternion(
          camera.quaternion,
          "YXZ"
        );

        // Berechne die Bewegungsrichtung basierend auf den Tasteneingaben
        if (fpControls.moveState.forward) {
          inputVelocity.z = -1;
        }
        if (fpControls.moveState.backward) {
          inputVelocity.z = 1;
        }
        if (fpControls.moveState.left) {
          inputVelocity.x = -1;
        }
        if (fpControls.moveState.right) {
          inputVelocity.x = 1;
        }

        // KORREKTUR: Normalisiere den Eingabevektor, um konstante Geschwindigkeit in alle Richtungen zu gewährleisten
        if (inputVelocity.length() > 0) {
          inputVelocity.normalize();
        }

        // Rotiere die Bewegungsrichtung entsprechend der Kameraausrichtung und wende die Geschwindigkeit an
        inputVelocity.applyEuler(euler).multiplyScalar(moveSpeed);

        // Setze die neue Geschwindigkeit für den Physik-Körper
        playerBody.velocity.x = inputVelocity.x;
        playerBody.velocity.z = inputVelocity.z;
        // Die Y-Geschwindigkeit wird von der Physik-Engine (Schwerkraft) gesteuert

        // KORREKTUR: Sicherstellen, dass der Spieler-Körper nicht rotiert
        playerBody.angularVelocity.set(0, 0, 0);
        playerBody.quaternion.set(0, 0, 0, 1); // Setzt die Rotation auf die Identitätsquaternion (aufrecht)
      }
    }
    // Aktualisiere die Kamera-Position basierend auf der Physik-Körper-Position
    // KORREKTUR: XZ-Position vom playerBody übernehmen, Y-Position für Augenhöhe anpassen
    camera.position.x = playerBody.position.x;
    camera.position.z = playerBody.position.z;
    camera.position.y = playerBody.position.y + 1.1; // playerBody.position.y (-0.2) + 1.1 = 0.9 (Augenhöhe)
  }
  if (shoppingCart) {
    // KORREKTUR: Prüfe den direkten Tastenzustand (moveState) statt der gedämpften Geschwindigkeit (velocity).
    const isMoving =
      fpControls &&
      (fpControls.moveState.forward ||
        fpControls.moveState.backward ||
        fpControls.moveState.left ||
        fpControls.moveState.right);

    // KORREKTUR: Zielposition und Rotation nur aktualisieren, wenn der Spieler sich bewegt.
    if (isMoving) {
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
        camera.quaternion
      );
      forward.y = 0; // Bewegung nur auf der XZ-Ebene
      forward.normalize();

      // Die Zielposition ist 0.8 Einheiten vor dem Spieler
      const playerPos = playerBody.position as unknown as THREE.Vector3;
      cartTargetPosition.copy(playerPos).add(forward.multiplyScalar(1.0)); // Abstand leicht erhöht
      cartTargetPosition.y = playerPos.y + 0.2; // KORREKTUR: Y-Position weiter anheben

      // Richte den Wagen so aus, dass er in die gleiche Richtung wie die Kamera schaut (Griff zum Spieler)
      shoppingCart.rotation.y = Math.atan2(forward.x, forward.z) + Math.PI;
    }

    // Glätte die Bewegung des Wagens, indem die geglättete Position zur rohen Zielposition interpoliert wird.
    smoothedCartTargetPosition.lerp(cartTargetPosition, 0.2); // Etwas schnelleres lerp für besseres Folgeverhalten
    shoppingCart.position.copy(smoothedCartTargetPosition);

    productSelection.position.copy(shoppingCart.position);
    productSelection.position.y = 0.42;
  }

  // Iteriere durch alle Objekte und aktualisiere Position und Rotation
  for (let [threeObj, cannonObj] of physicObjects) {
    threeObj.position.copy(cannonObj.position);
    threeObj.quaternion.copy(cannonObj.quaternion);
  }

  if (taskDone.value == true) {
    _composer.render();
  } else {
    _renderer.render(scene, camera);
  }

  _renderLoopId = requestAnimationFrame(renderLoop);
}

function leaveSelectMode(): void {
  if (selectMode.value) {
    // KORREKTUR: Setze nur den Modus zurück. Die Position des Spielers bleibt, wo sie ist.
    // Die FPV-Steuerung wird durch den Klick auf das Canvas wieder aktiviert.
    selectMode.value = false;
  }
}

/* --- Lifecycle Hooks --- */
onMounted(() => {
  if (canvas.value) {
    // 1. Leichte Three.js-Initialisierung (ohne Modelle) - Dies setzt die Startposition der Kamera.
    const { renderer } = initThree("mountId");
    _renderer = renderer;

    // NEU: Physik für den Boden initialisieren
    setupFloorPhysics();

    // 2. FPV-Steuerung sofort initialisieren und verbinden
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
    _renderer.setPixelRatio(1);

    // KORREKTUR: Kamera beim Start geradeaus schauen lassen.
    camera.lookAt(0, camera.position.y, camera.position.z - 1);

    // KORREKTUR: Initiale Position für den Wagen und das Ziel setzen.
    // Die Y-Position wird relativ zur Spieler-Y-Position (-0.2) berechnet.
    // Spieler-Y (-0.2) + Offset (0.2) = 0.0
    const initialCartPos = new THREE.Vector3(0, 0.0, camera.position.z - 1.0);
    cartTargetPosition.copy(initialCartPos); // Zielposition initialisieren
    smoothedCartTargetPosition.copy(initialCartPos); // Geglättete Position initialisieren
    if (shoppingCart) shoppingCart.position.copy(initialCartPos); // Sichtbare Position des Wagens setzen

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
      linearDamping: 0.5, // Dämpfung reduziert für direktere Bewegung
      angularDamping: 0.9, // NEU: Dämpfung für Rotationsstabilität
      allowSleep: false,
      // Die Oberkante des Bodens ist bei Y = -0.5. Die Unterseite der Kugel soll bei Y = -0.5 starten.
      // Der Mittelpunkt der Kugel ist dann bei Y = -0.5 + playerRadius = -0.5 + 0.3 = -0.2.
      position: new CANNON.Vec3(camera.position.x, -0.2, camera.position.z),
    });

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
      console.log("EVENT: 'collide' ausgelöst! Kollision mit:", event.body);
    });
    console.log("DEBUG: Player Body erstellt.", {
      id: playerBody.id,
      material: playerBody.material,
      group: playerBody.collisionFilterGroup,
      mask: playerBody.collisionFilterMask,
    });

    const playerDebugMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      wireframe: true,
      transparent: true,
      opacity: 0.5,
      visible: false,
    });
    // Erstelle ein Debug-Mesh, das die Kapselform widerspiegelt
    const playerDebugMesh = new THREE.Group();
    const sphereMesh = new THREE.Mesh(
      new THREE.SphereGeometry(playerRadius, 8, 8),
      playerDebugMaterial
    );
    const cylinderMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(
        playerRadius,
        playerRadius,
        playerHeight - 2 * playerRadius,
        8
      ),
      playerDebugMaterial
    );
    cylinderMesh.position.set(0, (playerHeight - playerRadius) / 2, 0);
    playerDebugMesh.add(sphereMesh);
    playerDebugMesh.add(cylinderMesh);
    scene.add(playerDebugMesh);
    debugMeshes.set(playerBody, playerDebugMesh);

    window.addEventListener("click", (event) => {
      // KORREKTUR: Trenne die Logik für das Sperren der Steuerung von der Spiellogik.
      // Wenn die Steuerung nicht gesperrt ist (z.B. nach Verlassen des selectMode),
      // soll der Klick NUR die Steuerung sperren und keine andere Aktion auslösen.
      if (!fpControls?.controls.isLocked()) {
        fpControls?.controls.lock();
      } else {
        // Nur wenn die Steuerung bereits gesperrt ist, die normalen Klick-Events ausführen.
        clickEvent(event);
        clickCheckout(event, cashRegister);
      }
    });

    // NEU: Event-Listener für die ESC-Taste hinzufügen
    // KORREKTUR: Wir verwenden die Leertaste statt ESC, um den Pointer-Lock nicht zu unterbrechen.
    window.addEventListener("keydown", (event) => {
      if (event.code === "Space" && selectMode.value) {
        // Verhindert das Standardverhalten der Leertaste (z.B. Scrollen)
        event.preventDefault();
        console.log("SPACE pressed in selectMode. Leaving select mode.");
        selectMode.value = false;
      }
    });
  }
});

watch(selectMode, (isSelectMode: boolean) => {
  // KORREKTUR: Der Pointer-Lock wird nicht mehr aufgehoben, wenn der selectMode betreten wird.
  // Die Steuerung bleibt jetzt dauerhaft aktiv, es sei denn, der Benutzer drückt ESC.
  // Die Bewegungslogik wird stattdessen in `useFirstPersonControls` je nach Modus gesteuert.
  console.log("Box.vue Watch(selectMode): selectMode ist jetzt", isSelectMode);
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
defineExpose({ setupScene, checkIntersects }); // leaveSelectMode ist jetzt eine interne Funktion
</script>

<template>
  <div class="cursor-none fixed top-0 left-0">
    <div ref="statsContainer" class="stats"></div>
    <canvas class="cursor-none" id="mountId" width="700" height="500" />
    <ProductSelectMenu class="cursor-none" v-if="selectMode" />
    <Cursor
      :mousePos="mousePos"
      :clickable="clickable"
      v-if="clockStart"
      class="cursor-none pointer-events-none"
    />
    <!-- NEU: Fadenkreuz für den FPV-Modus -->
    <div v-if="!selectMode && !productView" class="crosshair"></div>
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
</style>
