export const shelves = [];
import {
  BoxGeometry,
  MeshStandardMaterial,
  RepeatWrapping,
  TextureLoader,
} from "three";

import { useProductsStore } from "~/stores/products";

export async function createShelves(
  pos: object,
  floorLength: number,
  shelfWidth: number,
  shelfLength: number,
  dist: number,
  shelfHeight: number
) {
  // shelf
  const myStore = useProductsStore();
  const shelfMaterial = createTexture(
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
      shelfHeight,
      shelfWidth,
      shelfLength,
      shelfMaterial,
      myStore.testShelves[index]
    );
    // Position des Regals berechnen
    shelf.position.x = currPos; // Regale entlang der X-Achse platzieren
    shelf.position.y = shelfHeight / 2 + 0.05; // Regale leicht über dem Boden positionieren
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
  }
}
