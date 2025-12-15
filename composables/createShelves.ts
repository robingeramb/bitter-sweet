import * as THREE from "three";

import {
  shelfMaterial as shelfPhysicMaterial,
  debugMeshes,
} from "@/composables/useThree"; // KORREKTUR: Import umbenennen und zentrale debugMeshes importieren
import { useProductsStore } from "~/stores/products";
import * as CANNON from "cannon";

export const shelves: THREE.Group[] = [];

export async function createShelves(
  pos: { x1: number; x2: number },
  floorLength: number,
  shelfWidth: number,
  shelfLength: number,
  dist: number,
  shelfHeight: number
) {
  // shelf
  const myStore = useProductsStore();
  // KORREKTUR: Variable umbenennen, um Shadowing zu vermeiden. Dies ist das visuelle Material.
  const shelfThreeMaterial = createTexture(
    "shelf_metal",
    4,
    true,
    true,
    true,
    true,
    false,
    1
  );
  let currPos = 0;
  let posCounter = -2;
  // KORREKTUR: Die Schleifenlogik wurde vereinfacht, um die Positionierung der Regale klarer
  // und weniger fehleranfällig zu machen. Jedes Paar von Regalen (links und rechts)
  // wird nun explizit basierend auf dem Schleifenindex platziert.
  for (let index = 0; index < myStore.shelves.length; index++) {
    if (index % 2 === 0) { // Gerade Indizes (0, 2, ...) platzieren ein Regal auf der rechten Seite.
      currPos = pos.x2;
      posCounter++;
    } else { // Ungerade Indizes (1, 3, ...) platzieren ein Regal auf der linken Seite.
      currPos = pos.x1;
    }
    const shelf = await createShelve(
      // KORREKTUR: shelf muss hier deklariert werden
      shelfHeight,
      shelfWidth,
      shelfLength,
      shelfThreeMaterial, // KORREKTUR: Das korrekte visuelle Material übergeben
      myStore.shelves[index]
    );
    // Position des Regals berechnen
    shelf.position.x = currPos;
    // KORREKTUR: Die Unterkante des Regals soll auf dem Boden (Y=-0.5) stehen. Der Mittelpunkt ist dann bei -0.5 + halbe Höhe.
    shelf.position.y = -1.0 + (shelfHeight / 2);
    shelf.position.z = -shelfWidth / 2 - posCounter * (shelfWidth + dist); // Z-Achse bleibt konstant (eine Linie)
    if (currPos < 0) {
      shelf.rotation.y = Math.PI / 2;
    } else {
      shelf.rotation.y = -Math.PI / 2;
    }

    shelf.castShadow = true;
    // Regal der Szene hinzufügen
    shelves.push(shelf);
    scene.add(shelf);

    // KORREKTUR: Wir erstellen die Physik-Box direkt in der Welt-Ausrichtung (gedreht).
    // Da alle Regale um 90 Grad gedreht sind, tauschen wir Breite und Länge.
    // X-Achse: Tiefe des Regals (shelfLength) | Z-Achse: Breite des Regals (shelfWidth)
    const shelfShape = new CANNON.Box(
      new CANNON.Vec3(shelfLength / 2, shelfHeight / 2, shelfWidth / 2)
    );

    // KORREKTUR: Wir berechnen die Z-Position explizit.
    let zPos = -shelfWidth / 2 - posCounter * (shelfWidth + dist);

    // KORREKTUR: Füge einen winzigen Offset für die linken Regale hinzu.
    // Dies verhindert, dass die AABBs der linken und rechten Regale auf der Z-Achse exakt gleich sind,
    // was in der SAPBroadphase zu Problemen führen kann.
    if (index % 2 !== 0) {
      zPos += 0.0001;
    }

    const shelfBody = new CANNON.Body({
      mass: 0, // mass: 0 macht das Objekt statisch und unbeweglich
      shape: shelfShape,
      material: shelfPhysicMaterial, // KORREKTUR: Das korrekte Physik-Material zuweisen
      // KORREKTUR: Weise dem Regal seine korrekte Kollisionsgruppe zu.
      collisionFilterGroup: COLLISION_GROUPS.SHELF,
      // KORREKTUR: Lege fest, womit das Regal kollidieren soll (Spieler, Einkaufswagen, Produkte).
      collisionFilterMask: COLLISION_GROUPS.PLAYER | COLLISION_GROUPS.SHOPPING_CART | COLLISION_GROUPS.PRODUCT,
      // KORREKTUR: Setze die Position direkt im Konstruktor, um Initialisierungsprobleme zu vermeiden.
      position: new CANNON.Vec3(currPos, -1.0 + (shelfHeight / 2), zPos)
    });

    // NEU: Name für Debugging hinzufügen
    (shelfBody as any).name = `Regal ${index} (${index % 2 === 0 ? 'Rechts' : 'Links'})`;


    // DEBUG: Erstelle ein sichtbares Mesh für die Kollisionsbox des Regals
    const debugMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      wireframe: true,
      transparent: true,
      opacity: 0.5,
      visible: false,
    });
    const cannonShape = shelfBody.shapes[0] as CANNON.Box;
    const halfExtents = cannonShape.halfExtents; // halfExtents sind bereits korrekt für die Box-Geometrie
    const debugGeometry = new THREE.BoxGeometry(
      shelfLength, // X (Tiefe)
      shelfHeight,
      shelfWidth   // Z (Breite)
    );
    const debugMesh = new THREE.Mesh(debugGeometry, debugMaterial);

    scene.add(debugMesh);
    debugMeshes.set(shelfBody, debugMesh); // KORREKTUR: Zur zentralen Map hinzufügen

    // KORREKTUR: Explizit keine Rotation setzen (Identitäts-Quaternion).
    shelfBody.quaternion.set(0, 0, 0, 1); // Identitäts-Quaternion (keine Rotation)

    // KORREKTUR: Den Körper erst zur Welt hinzufügen, NACHDEM Position und Rotation gesetzt wurden!
    // Statische Körper (mass: 0) werden von der Physik-Engine oft nicht mehr aktualisiert, wenn sie nachträglich bewegt werden.
    world.addBody(shelfBody);
    console.log(`DEBUG: Regal-Körper ${index} erstellt.`, {
      id: shelfBody.id,
      material: shelfBody.material,
      group: shelfBody.collisionFilterGroup,
      mask: shelfBody.collisionFilterMask,
    });
  }
}
