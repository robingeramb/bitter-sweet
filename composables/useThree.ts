import * as THREE from "three";
import { markRaw, ref } from "vue";
import CANNON from "cannon";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutlinePass } from "three/examples/jsm/postprocessing/OutlinePass.js";

// --- 2. Cannon.js Setup ---
// KORREKTUR: Die Welt muss *sofort* bei der Erstellung korrekt konfiguriert werden,
// bevor irgendwelche Körper hinzugefügt werden.
export const world = new CANNON.World();
world.gravity.set(0, -9.82, 0); // Schwerkraft
world.allowSleep = true; // Lässt inaktive Körper "einschlafen" zur Leistungsoptimierung

// KORREKTUR: Broadphase-Algorithmus direkt nach der Erstellung setzen.
// SAPBroadphase ist robuster für Szenen mit vielen statischen Objekten.
world.broadphase = new CANNON.SAPBroadphase(world);

// KORREKTUR: GSSolver für stabilere Kontakte (weniger Ruckeln) verwenden und Iterationen erhöhen.
world.solver = new CANNON.GSSolver();
world.solver.iterations = 50; // KORREKTUR: Deutlich erhöht für stabile Kontakte mit komplexen Objekten.
// NEU: Materialien zentral definieren und exportieren
export const playerMaterial = new CANNON.Material("player");
export const shelfMaterial = new CANNON.Material("shelf");
export const productMaterial = new CANNON.Material("product"); // NEU
export const shoppingCartMaterial = new CANNON.Material("shoppingCart"); // NEU
export const groundMaterial = new CANNON.Material("ground"); // NEU

// NEU: Kontaktverhalten zwischen Spieler und Regal definieren
const playerShelfContactMaterial = new CANNON.ContactMaterial(
  playerMaterial,
  shelfMaterial,
  {
    friction: 0.0, // KORREKTUR: Reibung auf 0 setzen, um sanftes Gleiten an Wänden zu ermöglichen.
    restitution: 0.0, // Kein Abprallen
    contactEquationStiffness: 1e7, // Steifigkeit reduziert, um Ruckeln zu minimieren
    contactEquationRelaxation: 4, // Relaxation erhöht für "weichere" Kollisionen
  }
);
world.addContactMaterial(playerShelfContactMaterial);

// KORREKTUR: Kontaktverhalten zwischen Spieler und Boden definieren, um Ruckeln zu verhindern.
const playerGroundContactMaterial = new CANNON.ContactMaterial(
  playerMaterial,
  groundMaterial,
  {
    friction: 0, // KORREKTUR: Moderate Reibung, um "Kleben" zu vermeiden.
    restitution: 0.0, // Kein Abprallen.
    contactEquationStiffness: 1e8, // Hohe Steifigkeit, um "Einsinken" zu verhindern.
    contactEquationRelaxation: 10, // KORREKTUR: Erhöht die "Weichheit" der Kollision, was das Rutschen weiter reduziert.
  }
);
world.addContactMaterial(playerGroundContactMaterial);

// NEU: Kontaktverhalten zwischen Spieler und Einkaufswagen definieren
const playerCartContactMaterial = new CANNON.ContactMaterial(
  playerMaterial,
  shoppingCartMaterial,
  {
    friction: 0.1, // Sehr geringe Reibung, damit sie nicht aneinander "kleben"
    restitution: 0.1, // Kaum Abprall
  }
);
world.addContactMaterial(playerCartContactMaterial);

// NEU: Kontaktverhalten zwischen Regal/Boden/Wagen und sich selbst definieren
// Dies ist entscheidend, damit der Einkaufswagen stabil auf dem Boden steht
// und Produkte im Korb nicht durch den Boden fallen.
const shelfShelfContactMaterial = new CANNON.ContactMaterial(
  shelfMaterial,
  shelfMaterial,
  {
    friction: 0.5, // Etwas Reibung
    restitution: 0.0, // Kein Abprallen
    contactEquationStiffness: 1e8, // Sehr steif, um Penetration zu verhindern
    contactEquationRelaxation: 1, // Wenig Relaxation für harte Kollisionen
  }
);
world.addContactMaterial(shelfShelfContactMaterial);

// NEU: Kontaktverhalten zwischen Produkt und Einkaufswagen definieren
const productShoppingCartContactMaterial = new CANNON.ContactMaterial(
  productMaterial,
  shoppingCartMaterial,
  {
    friction: 0.8, // Hohe Reibung, damit Produkte im Wagen bleiben
    restitution: 0.1, // Leichter Abprall
    contactEquationStiffness: 1e8, // Sehr steif für stabile Kontakte
    contactEquationRelaxation: 3, // Etwas Relaxation
  }
);
world.addContactMaterial(productShoppingCartContactMaterial);

// NEU: Kontaktverhalten zwischen Produkt und Boden/Regal definieren
const productGroundContactMaterial = new CANNON.ContactMaterial(
  productMaterial,
  groundMaterial,
  {
    friction: 0.9, // Sehr hohe Reibung, damit Produkte nicht wegrutschen
    restitution: 0.1, // Kaum Abprall
    contactEquationStiffness: 1e8,
    contactEquationRelaxation: 3,
  }
);
world.addContactMaterial(productGroundContactMaterial);

// NEU: Kontaktverhalten zwischen Einkaufswagen und Boden definieren.
// Dies ist entscheidend, damit der Wagen stabil auf dem Boden steht.
const shoppingCartGroundContactMaterial = new CANNON.ContactMaterial(
  shoppingCartMaterial,
  groundMaterial,
  {
    friction: 0.3, // Etwas Reibung, um Rutschen zu verhindern.
    restitution: 0.0, // KORREKTUR: Keine Abprall-Elastizität, um Hüpfen zu verhindern.
    contactEquationStiffness: 1e7, // KORREKTUR: Steifigkeit wieder leicht erhöht für einen festen Kontakt.
    contactEquationRelaxation: 8, // KORREKTUR: Relaxation stark erhöht, um der Physik-Engine mehr Spielraum zur sanften Lösung von Kollisionen zu geben.
  }
);
world.addContactMaterial(shoppingCartGroundContactMaterial);

// NEU: Kontaktverhalten zwischen Einkaufswagen und Spieler definieren
const shoppingCartPlayerContactMaterial = new CANNON.ContactMaterial(
  shoppingCartMaterial,
  playerMaterial,
  {
    friction: 0.1, // Geringe Reibung, damit sie nicht aneinander "kleben"
    restitution: 0.1, // Kaum Abprall
    contactEquationStiffness: 1e7,
    contactEquationRelaxation: 4,
  }
);
world.addContactMaterial(shoppingCartPlayerContactMaterial);

// NEU: Eine zentrale Map für alle Debug-Meshes
export const debugMeshes = new Map<CANNON.Body, THREE.Object3D>();

// NEU: Kollisionsgruppen für die Physik-Engine
export const COLLISION_GROUPS = {
  PLAYER: 1 << 0,
  SHOPPING_CART: 1 << 1,
  PRODUCT: 1 << 2,
  GROUND: 1 << 3,
  SHELF: 1 << 4,
};

export { generateShoppingCartBody } from "./generateCannonWorld";
export { loadModel } from "./loadObject";
export { createTexture } from "./createTexture";
export { loadEXR } from "./loadEXR";
import { disposeObject } from "@/utils/disposeUtils";

export const scene = new THREE.Scene();
markRaw(scene); // KORREKTUR: Verhindert, dass die Szene und ihre Kinder reaktiv werden.

export const clockStart = ref(false);
export const shouldUpdatePhysics = ref(false);
export let _composer: EffectComposer;
export let _outlinePass: OutlinePass;
export const camera = new THREE.PerspectiveCamera(50, 200 / 200, 0.001, 30);
markRaw(camera); // KORREKTUR: Verhindert, dass Vue die Kamera reaktiv macht und den Proxy-Fehler auslöst.
export const productSelection = new THREE.Group();
markRaw(productSelection); // KORREKTUR: Verhindert, dass die Gruppe reaktiv wird.
// KORREKTUR: Die Map selbst muss als "roh" markiert werden, um zu verhindern, dass Vue ihre Inhalte (Schlüssel/Werte) beim Iterieren in Proxies umwandelt.
// KORREKTUR: Kapseln der physicObjects-Map, um sie vollständig aus dem Reaktivitätssystem von Vue zu entfernen.
const _physicObjects = new Map<THREE.Object3D, CANNON.Body>();
export const getPhysicObjects = () => _physicObjects;
export const setPhysicObject = (mesh: THREE.Object3D, body: CANNON.Body) =>
  _physicObjects.set(mesh, body);
export const deletePhysicObject = (mesh: THREE.Object3D) =>
  _physicObjects.delete(mesh); // Diese Zeile ist korrekt und muss exportiert werden.

// KORREKTUR: Globale Referenz auf das Einkaufswagen-Mesh als nicht-reaktive Variable.
let _shoppingCart: THREE.Object3D | null = null;
export const getShoppingCart = () => _shoppingCart;
export const setShoppingCart = (cart: THREE.Object3D | null) => {
  _shoppingCart = cart;
};

// NEU: Ein Set, das die Meshes der Produkte im Einkaufswagen speichert.
export const productsInCart = new Set<THREE.Object3D>();

// KORREKTUR: Globale Liste der Produkte im Einkaufswagen als nicht-reaktives Array.
const _productsInCart: { mesh: THREE.Object3D; body: CANNON.Body }[] = [];
export const getProductsInCart = () => _productsInCart;

export const bodiesToRemove = new Set<CANNON.Body>(); // NEU: Set zum sicheren Entfernen von Körpern
export let currX = ref();
export let currY = ref();
export let savedPos = new THREE.Vector3();
export let selectMode = ref(false);
export const hoveredProduct = ref<string | undefined>();
export const hoveredMouseX = ref(0);
export const hoveredMouseY = ref(0);
// KORREKTUR: Die reaktive `ref` für `selectedProduct` wird entfernt. Dies ist die Hauptursache für den Proxy-Fehler.
// Wir verwalten den Zustand stattdessen in einer nicht-reaktiven, gekapselten Variable.
let _selectedProduct: THREE.Object3D | null = null;
export const getSelectedProduct = () => _selectedProduct;
export const setSelectedProduct = (product: THREE.Object3D | null) => {
  _selectedProduct = product;
};
export const productView = ref(false);
// KORREKTUR: Referenz auf das Originalobjekt im Regal als nicht-reaktive Variable.
let _lastClickedObject: THREE.Object3D | null = null;
export const getLastClickedObject = () => _lastClickedObject;
export const setLastClickedObject = (obj: THREE.Object3D | null) => {
  _lastClickedObject = obj;
};

export const raycaster = new THREE.Raycaster();
export const mouse = new THREE.Vector2();
export const sugarCounter = ref(0);
export const clock = new THREE.Clock();
export let addedProductsInCart = ref(0);
export let taskDone = ref(false);
export let endScreen = ref(false);

export interface ProductData {
  id: string;
  category: string;
  sugarAmount: number;
  [key: string]: any;
}
// KORREKTUR: Umbenannt, um Namenskonflikt mit der Physik-Liste zu vermeiden.
// Diese Variable speichert die Metadaten der Produkte im Warenkorb.
export let productsInCartData: ProductData[] = [];
export const loadingProgress = ref(0);
export const loadingMessage = ref();
export const loadedItems = ref(0);
export const scrollValue = ref(4);
export const sauceCheck = ref(false);
export const noodelsCheck = ref(false);
export const snacksCheck = ref(false);
export const drinksCheck = ref(false);
export let drinksCount = ref(0);
export const loadingManager = new THREE.LoadingManager(
  // Callback: Wenn alles geladen ist
  () => {
    loadingMessage.value = "Alle Ressourcen geladen";
  },
  // Callback: Während des Ladens
  (url, itemsLoaded, itemsTotal) => {
    loadingMessage.value = `Lade ${url}: ${itemsLoaded} von ${itemsTotal}`;
    loadingProgress.value = (itemsLoaded / itemsTotal) * 100;
    loadedItems.value = itemsLoaded;
  },
  // Callback: Bei Fehlern
  (url) => {
    loadingMessage.value = `Fehler beim Laden von: ${url}`;
  }
);
export const textureLoader = new THREE.TextureLoader(loadingManager);

export let _playerBody: CANNON.Body | null = null;
export let _shoppingCartBody: CANNON.Body | null = null; // NEU

// NEU: Funktionen zur Steuerung des Einkaufswagens
export const cartControls = {
  pause: () => {},
  resume: () => {},
};

export function useCartControls(pause: () => void, resume: () => void) {
  cartControls.pause = pause;
  cartControls.resume = resume;
}

export function usePlayerBody(playerBody: CANNON.Body) {
  _playerBody = playerBody;
}

export function useShoppingCartBody(shoppingCartBody: CANNON.Body) {
  _shoppingCartBody = shoppingCartBody;
}

export function useMovePlayerTo(
  position: CANNON.Vec3,
  lookAtTarget: THREE.Vector3
) {
  if (_playerBody) {
    // KORREKTUR: Die gesamte Teleport-Logik wird hier zentralisiert.

    // 1. Berechne die Verschiebung des Spielers
    const deltaPlayerPosition = new CANNON.Vec3();
    position.vsub(_playerBody.position, deltaPlayerPosition);

    // 2. Teleportiere den Spieler
    _playerBody.position.copy(position);
    // KORREKTUR: Setze die Geschwindigkeit auf Null, um ein "Wegrutschen" nach dem Teleport zu verhindern.
    _playerBody.velocity.set(0, 0, 0);
    _playerBody.angularVelocity.set(0, 0, 0);

    // KORREKTUR: Übergib die neue Kameraausrichtung an die FPV-Steuerung.
    // Dies "friert" die neue Blickrichtung ein und verhindert, dass sie überschrieben wird.
    const fpControls = (window as any).fpControls;
    // KORREKTUR: Synchronisiere die Kameraposition sofort mit der neuen Spielerposition.
    // Dies muss VOR dem lookAt erfolgen, damit lookAt von der korrekten Position aus berechnet wird.
    camera.position.x = _playerBody.position.x;
    camera.position.z = _playerBody.position.z;
    camera.position.y = _playerBody.position.y + 0.2; // Augenhöhe über dem Körpermittelpunkt

    camera.lookAt(lookAtTarget);

    if (fpControls) {
      fpControls.setRotationFromQuaternion(camera.quaternion);
    }
  }
}

export function unlockControls() {
  const fpControls = (window as any).fpControls;
  if (fpControls && fpControls.controls.isLocked()) {
    fpControls.controls.unlock();
  }
}

export function lockControls() {
  const fpControls = (window as any).fpControls;
  if (fpControls && !fpControls.controls.isLocked()) {
    fpControls.controls.lock();
  }
}

export function useThree() {
  function initThree(canvasMountId: string) {
    //spector.displayUI();
    const canvas = document.getElementById(canvasMountId)! as HTMLCanvasElement;
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);

    camera.position.set(0, 1.3, 4); // KORREKTUR: Kamera-Startposition auf Augenhöhe anpassen (Spieler-Mitte 0.75 + 0.55 Augenhöhe = 1.3)
    camera.lookAt(0, 0, 0);

    scene.background = new THREE.Color(0x000000);
    scene.add(ambientLight);
    scene.add(productSelection);

    // Add an object to illuminate

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      stencil: true,
      alpha: true,
    });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.physicallyCorrectLights = true; // Enable physical lighting
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio); // Nutzt die native Pixeldichte des Geräts
    _composer = new EffectComposer(renderer);

    // NEU: OutlinePass initialisieren
    _outlinePass = new OutlinePass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      scene,
      camera
    );
    _outlinePass.visibleEdgeColor.set("#ff0000"); // Rote Kontur
    _outlinePass.edgeStrength = 5; // Stärke der Kontur
    _composer.addPass(_outlinePass);
    return { renderer };
  }

  function cleanUpThree(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    disposeObject(scene);
    renderer.dispose();
  }

  return {
    initThree,
    cleanUpThree,
  };
}

export function unloadObjectsByDistance(maxDistance: number) {
  if (!scene || !camera) return;

  const cameraPos = camera.position;
  const toRemove: THREE.Object3D[] = [];
  camera.near = 0.1;
  camera.far = maxDistance; // kleiner Puffer
  camera.updateProjectionMatrix();

  scene.traverse((object) => {
    if (!object.isMesh) return;
    if (!object.parent) return;

    const worldPos = new THREE.Vector3();
    object.getWorldPosition(worldPos);

    const distance = cameraPos.distanceTo(worldPos);

    if (
      distance > maxDistance &&
      object.name !== "floor" &&
      object.name !== "wall"
    ) {
      toRemove.push(object);
    }
  });

  // ⬇️ erst NACH traverse entfernen
  toRemove.forEach((object) => {
    object.parent?.remove(object);

    if (object.geometry) object.geometry.dispose();

    if (object.material) {
      if (Array.isArray(object.material)) {
        object.material.forEach((m) => m.dispose());
      } else {
        object.material.dispose();
      }
    }
  });
}

// NEU: Hilfsfunktion zum Erstellen eines Debug-Meshes für einen Cannon.js Body
export function createCannonDebugger(
  scene: THREE.Scene,
  body: CANNON.Body
): THREE.Object3D {
  const debugMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000, // KORREKTUR: Farbe auf Rot ändern
    wireframe: true,
    transparent: true,
    opacity: 0.5,
    visible: true, // KORREKTUR: Standardmäßig sichtbar machen
  });

  const debugMesh = new THREE.Group();
  body.shapes.forEach((shape, index) => {
    let geometry;
    if (shape instanceof CANNON.Box) {
      geometry = new THREE.BoxGeometry(
        shape.halfExtents.x * 2,
        shape.halfExtents.y * 2,
        shape.halfExtents.z * 2
      );
    } else if (shape instanceof CANNON.Sphere) {
      geometry = new THREE.SphereGeometry(shape.radius);
    } else if (shape instanceof CANNON.Cylinder) {
      // NEU: Unterstützung für Zylinder-Formen hinzufügen
      // KORREKTUR: Die Standard-CANNON.Cylinder-Klasse speichert die Konstruktor-Argumente nicht.
      // Wir müssen die Dimensionen aus den Vertices ableiten.
      const cylinderShape = shape as CANNON.Cylinder & {
        vertices: CANNON.Vec3[];
      };
      let min_y = Infinity;
      let max_y = -Infinity;
      for (const v of cylinderShape.vertices) {
        if (v.y < min_y) min_y = v.y;
        if (v.y > max_y) max_y = v.y;
      }
      const height = max_y - min_y;
      // Finde den Radius, indem wir einen Vertex auf der Kante nehmen (z.B. der mit dem größten x-Wert)
      let radiusTop = 0;
      let radiusBottom = 0;
      for (const v of cylinderShape.vertices) {
        const r = Math.sqrt(v.x * v.x + v.z * v.z);
        if (v.y.toFixed(2) === (height / 2).toFixed(2))
          radiusTop = Math.max(radiusTop, r);
        if (v.y.toFixed(2) === (-height / 2).toFixed(2))
          radiusBottom = Math.max(radiusBottom, r);
      }
      geometry = new THREE.CylinderGeometry(
        radiusTop,
        radiusBottom,
        height,
        cylinderShape.vertices.length / 2 // Die Anzahl der Segmente ist die Hälfte der Vertices
      );
    }
    if (geometry) {
      const mesh = new THREE.Mesh(geometry, debugMaterial);
      mesh.position.copy(body.shapeOffsets[index] as unknown as THREE.Vector3);
      mesh.quaternion.copy(
        body.shapeOrientations[index] as unknown as THREE.Quaternion
      );
      debugMesh.add(mesh);
    }
  });
  scene.add(debugMesh);
  return debugMesh;
}
