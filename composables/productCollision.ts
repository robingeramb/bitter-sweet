import {
  COLLISION_GROUPS,
  getPhysicObjects,
  getShoppingCart,
  productsInCart,
  scene,
  world, // NEU: Die Physik-Welt importieren
} from "./useThree";
import * as THREE from "three";
import CANNON from "cannon";

/**
 * Diese Funktion wird bei jedem Kollisions-Event aufgerufen.
 * Sie prüft, ob ein Produkt mit dem Einkaufswagen kollidiert ist.
 */
export function onProductCollision(event: any) {
  const bodyA = event.body;
  const bodyB = event.contact.bi;

  // Finde heraus, welcher Körper das Produkt und welcher der Wagen ist
  let productBody: CANNON.Body | null = null;
  let cartBody: CANNON.Body | null = null;

  if (
    bodyA.collisionFilterGroup === COLLISION_GROUPS.PRODUCT &&
    bodyB.collisionFilterGroup === COLLISION_GROUPS.SHOPPING_CART
  ) {
    productBody = bodyA;
    cartBody = bodyB;
  } else if (
    bodyB.collisionFilterGroup === COLLISION_GROUPS.PRODUCT &&
    bodyA.collisionFilterGroup === COLLISION_GROUPS.SHOPPING_CART
  ) {
    productBody = bodyB;
    cartBody = bodyA;
  }

  // Wenn eine Produkt-Wagen-Kollision stattgefunden hat...
  if (productBody && cartBody) {
    // Prüfe, ob die Kollision mit der Korb-Shape (ID 99) stattgefunden hat
    const isCollisionWithCartBasket =
      event.contact.si === 1 || event.contact.sj === 1;

    // Hole das zugehörige Three.js Mesh des Produkts
    const productMesh = (productBody as any).threemesh;

    // Nur fortfahren, wenn das Produkt-Mesh existiert und noch nicht im Korb ist
    if (productMesh && !productsInCart.has(productMesh)) {
      console.log("Product entered the shopping cart!");

      // 1. Füge das Produkt zur Liste der Produkte im Korb hinzu
      productsInCart.add(productMesh);

      // 2. Ändere den Physik-Typ zu KINEMATIC. Der Körper wird nicht mehr von der Schwerkraft beeinflusst.
      productBody.type = CANNON.Body.KINEMATIC;

      // 3. "Hefte" das visuelle Mesh des Produkts an das Mesh des Einkaufswagens.
      const shoppingCartMesh = getShoppingCart();
      if (shoppingCartMesh) {
        shoppingCartMesh.add(productMesh);
      }

      // 4. Erstelle eine "LockConstraint", um den Physik-Körper des Produkts an den Wagen zu ketten.
      const constraint = new CANNON.LockConstraint(cartBody, productBody);
      world.addConstraint(constraint);
      // Speichere die Constraint, damit wir sie beim Reset wieder entfernen können.
      (productBody as any).constraint = constraint;
    }
  }
}