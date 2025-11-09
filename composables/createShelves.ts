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
  for (let index = 0; index < myStore.testShelves.length; index++) {
    if (currPos == pos.x2) {
      currPos = pos.x1;
    } else {
      currPos = pos.x2;
      posCounter++;
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
    shelf.position.y = shelfHeight / 2; // KORREKTUR: Regale auf dem Boden (y=0) positionieren (Mitte bei 1, Unterkante bei 0)
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

    // KORREKTUR: Füge eine Kollisionsbox für das Regal hinzu
    // Da das visuelle Regal um 90 Grad gedreht wird, tauschen wir Breite und Länge für die Physik-Box.
    const shelfShape = new CANNON.Box(
      new CANNON.Vec3(shelfLength / 2, shelfHeight / 2, shelfWidth / 2)
    );

    const shelfBody = new CANNON.Body({
      mass: 0, // mass: 0 macht das Objekt statisch und unbeweglich
      shape: shelfShape,
      material: shelfPhysicMaterial, // KORREKTUR: Das korrekte Physik-Material zuweisen
    });

    world.addBody(shelfBody);
    console.log(`DEBUG: Regal-Körper ${index} erstellt.`, {
      id: shelfBody.id,
      material: shelfBody.material,
      group: shelfBody.collisionFilterGroup,
      mask: shelfBody.collisionFilterMask,
    });

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
      halfExtents.x * 2,
      halfExtents.y * 2,
      halfExtents.z * 2
    );
    const debugMesh = new THREE.Mesh(debugGeometry, debugMaterial);

    scene.add(debugMesh);
    debugMeshes.set(shelfBody, debugMesh); // KORREKTUR: Zur zentralen Map hinzufügen

    // KORREKTUR: Position und Rotation des Physik-Körpers erst NACH der
    // Positionierung des visuellen Meshes kopieren.
    shelfBody.position.copy(shelf.position as unknown as CANNON.Vec3);
    // Da die Box-Dimensionen bereits an die Welt-Ausrichtung angepasst sind, braucht der Körper keine Rotation.
    shelfBody.quaternion.set(0, 0, 0, 1);
  }
}
