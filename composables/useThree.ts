import {
  Object3D,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  Color,
  AmbientLight,
  LoadingManager,
  TextureLoader,
  Group,
  Raycaster,
  Vector2,
  Vector3,
  Clock,
  PCFSoftShadowMap,
} from "three";
import * as THREE from "three";
import CANNON from "cannon";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";

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
world.solver.iterations = 20;

// NEU: Materialien zentral definieren und exportieren
export const playerMaterial = new CANNON.Material("player");
export const shelfMaterial = new CANNON.Material("shelf");

// NEU: Kontaktverhalten zwischen Spieler und Regal definieren
const playerShelfContactMaterial = new CANNON.ContactMaterial(
  playerMaterial,
  shelfMaterial,
  {
    friction: 0.3, // Reibung leicht reduziert für besseres "Gleiten" an Wänden
    restitution: 0.0, // Kein Abprallen
    contactEquationStiffness: 1e7, // Steifigkeit reduziert, um Ruckeln zu minimieren
    contactEquationRelaxation: 4,  // Relaxation erhöht für "weichere" Kollisionen
  }
);
world.addContactMaterial(playerShelfContactMaterial);

// NEU: Eine zentrale Map für alle Debug-Meshes
export const debugMeshes = new Map<CANNON.Body, THREE.Object3D>();


import { disposeObject } from "@/utils/disposeUtils";
import { ref } from "vue";

import { Spector } from "spectorjs";

// Spector initialisieren
//const spector = new Spector();
//const spector = new Spector();
export const scene = new Scene();
export const clockStart = ref(false);
export const shouldUpdatePhysics = ref(false);
export let _composer: EffectComposer;
export const camera = new PerspectiveCamera(50, 200 / 200, 0.1, 30);
export const productSelection = new Group();
export const physicObjects = new Map();
export let currX = ref();
export let currY = ref();
export let savedPos = new Vector3();
export let selectMode = ref(false);
export const hoveredProduct = ref<string | undefined>();
export const hoveredMouseX = ref(0);
export const hoveredMouseY = ref(0);
export const selectedProduct = ref<Object3D | null>(null);
export const productView = ref(false);
export const lastClickedObject = ref<Object3D | null>(null); // NEU: Referenz auf das Originalobjekt im Regal

export const raycaster = new Raycaster();
export const mouse = new Vector2();
export const sugarCounter = ref(0);
export const clock = new Clock();
export let addedProductsInCart = ref(0);
export let taskDone = ref(false);
export let endScreen = ref(false);
export let productsInCart = [];
export const loadingProgress = ref(0);
export const loadingMessage = ref();
export const loadedItems = ref(0);
export const scrollValue = ref(4);
export const sauceCheck = ref(false);
export const noodelsCheck = ref(false);
export const snacksCheck = ref(false);
export const drinksCheck = ref(false);
export let drinksCount = ref(0);
export const loadingManager = new LoadingManager(
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
    console.error(`Fehler beim Laden von: ${url}`);
  }
);
export const textureLoader = new TextureLoader(loadingManager);

export let _playerBody: CANNON.Body | null = null;

export function usePlayerBody(playerBody) {
  _playerBody = playerBody;
}

export function useMovePlayerTo(position: CANNON.Vec3, lookAtTarget: THREE.Vector3) {
  if (_playerBody) {
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
    camera.position.y = _playerBody.position.y + 1.1; // Augenhöhe über dem Körpermittelpunkt

    console.log("useMovePlayerTo: Camera quaternion BEFORE lookAt:", camera.quaternion.toArray()); // NEU: Debug-Log
    camera.lookAt(lookAtTarget);
    console.log("useMovePlayerTo: Camera quaternion AFTER lookAt:", camera.quaternion.toArray()); // NEU: Debug-Log

    if (fpControls) {
      fpControls.setRotationFromQuaternion(camera.quaternion);
    }
  }
}
export function useThree() {
  function initThree(canvasMountId: string) {
    //spector.displayUI();
    const canvas = document.getElementById(canvasMountId)! as HTMLCanvasElement;
    const ambientLight = new AmbientLight(0xffffff, 0.2);

    camera.position.set(0, 1.3, 4); // KORREKTUR: Kamera-Startposition auf Augenhöhe anpassen (Spieler-Mitte 0.75 + 0.55 Augenhöhe = 1.3)
    camera.lookAt(0, 0, 0);

    scene.background = new Color(0x000000);
    scene.add(ambientLight);
    scene.add(productSelection);

    // Add an object to illuminate

    const renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      stencil: true,
      alpha: true,
    });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
    renderer.physicallyCorrectLights = true; // Enable physical lighting
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio); // Nutzt die native Pixeldichte des Geräts
    _composer = new EffectComposer(renderer);

    return { renderer };
  }

  function cleanUpThree(scene: Scene, renderer: WebGLRenderer) {
    disposeObject(scene);
    renderer.dispose();
  }

  return {
    initThree,
    cleanUpThree,
  };
}
