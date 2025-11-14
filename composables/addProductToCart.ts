import CANNON from "cannon";
import * as THREE from "three";
import { COLLISION_GROUPS, productMaterial, _shoppingCartBody, scene, physicObjects, world, sugarCounter, productsInCart, drinksCount, noodelsCheck, sauceCheck, snacksCheck, drinksCheck, taskDone, type ProductData, bodiesToRemove, cartControls, productSelection } from "./useThree"; // NEU: _shoppingCartBody und weitere importieren
import { gsap } from "gsap";

// KORREKTUR: Erweitere den Body-Typ, um die threemesh-Eigenschaft zu erlauben.
interface ShoppingCartBody extends CANNON.Body {
  threemesh: THREE.Object3D;
}

export const useAddProductToCart = (
  addedProduct: THREE.Object3D,
  originalObject: THREE.Object3D
) => {
  // NEU: Pausiere die Wagenverfolgung, sobald das Produkt hinzugefügt wird.
  cartControls.pause();

  const newProduct = originalObject.userData as ProductData;
  // Schritt 1: Logik zum Hinzufügen zum Warenkorb (Zucker zählen, etc.)
  sugarCounter.value += newProduct.sugarAmount;
  productsInCart.push(newProduct);

  // Schritt 2: Das Originalobjekt aus dem Regal endgültig aus der Szene löschen.
  // Dies ist der einzige Ort, an dem das Original gelöscht wird.
  deleteObjekt(originalObject);

  // Schritt 3: Das angezeigte Produkt (bisher nur visuell) in ein physisches Objekt umwandeln,
  // damit es in den Einkaufswagen fallen kann.
  const scaleAmount = 0.6; // Skalierungsfaktor wie in productSelection.ts
  let s = originalObject.scale.x; // Skalierung vom Original übernehmen
  let boxShape;
  addedProduct.scale.set(scaleAmount * s, scaleAmount * s, scaleAmount * s);
  let dimensions;

  if (addedProduct instanceof THREE.Mesh) {
    (addedProduct as THREE.Mesh).geometry.computeBoundingBox();
    dimensions = (addedProduct as THREE.Mesh).geometry.boundingBox!.getSize(new THREE.Vector3());
    boxShape = new CANNON.Box(
      new CANNON.Vec3(
        (dimensions.x * scaleAmount * s) / 2,
        (dimensions.y * scaleAmount * s) / 2,
        (dimensions.z * scaleAmount * s) / 2
      )
    );
  } else {
    const boundingBox = new THREE.Box3().setFromObject(originalObject);
    dimensions = new THREE.Vector3();
    boundingBox.getSize(dimensions);
    boxShape = new CANNON.Box(
      new CANNON.Vec3(
        (dimensions.x * scaleAmount) / 2,
        (dimensions.y * scaleAmount) / 2,
        (dimensions.z * scaleAmount) / 2
      )
    );
  }

  // KORREKTUR: Passe die Schlaf-Parameter an, damit die Produkte im Wagen nicht so leicht "einschlafen"
  // und dadurch bei der Bewegung des Wagens zurückbleiben.
  const boxBody = new CANNON.Body({
    mass: 1,
    linearDamping: 0.3,
    angularDamping: 0.3,
    material: productMaterial,
    sleepSpeedLimit: 0.01, // KORREKTUR: Sehr niedriger Schwellenwert, damit das Objekt nicht vorzeitig einschläft.
    sleepTimeLimit: 0.1, // KORREKTUR: Wacht schneller wieder auf, falls es doch einschläft.
    allowSleep: false, // NEU: Verhindert, dass das Produkt einschläft, bevor es den Boden des Korbes erreicht.
  });
  boxBody.addShape(boxShape);
  // Das Produkt soll mit dem Wagen, dem Boden und anderen Produkten kollidieren.
  boxBody.collisionFilterGroup = COLLISION_GROUPS.PRODUCT; // Es gehört zur Gruppe PRODUKT
  // Es soll kollidieren mit dem EINKAUFSWAGEN, dem BODEN und anderen PRODUKTEN
  boxBody.collisionFilterMask = COLLISION_GROUPS.SHOPPING_CART | COLLISION_GROUPS.GROUND | COLLISION_GROUPS.PRODUCT;

  // Positioniere das Objekt über dem Einkaufswagen, damit es hineinfallen kann.
  boxBody.position.copy(addedProduct.position as unknown as CANNON.Vec3);

  // --- NEUE LOGIK: Produkt beim ersten Kontakt an den Wagen "kleben" ---
  const onCollide = (event: any) => {
    // Prüfen, ob die Kollision mit dem Einkaufswagen stattgefunden hat.
    const isCartCollision = event.body === _shoppingCartBody;
    if (!isCartCollision || !_shoppingCartBody) return;
    
    // KORREKTUR: Prüfe, ob die Kollision mit der BODEN-Shape (identifiziert durch ID=99) stattgefunden hat.
    // Wir prüfen beide Kontakt-Shapes (`si` und `sj`), da die Reihenfolge nicht garantiert ist.
    let hitShape;
    if (event.contact.bi.id === _shoppingCartBody.id) { // Prüfe, ob Körper 1 der Einkaufswagen ist
      hitShape = event.contact.si; // Dann ist Shape 1 die getroffene Shape des Wagens
    } else if (event.contact.bj.id === _shoppingCartBody.id) { // Prüfe, ob Körper 2 der Einkaufswagen ist
      hitShape = event.contact.sj; // Dann ist Shape 2 die getroffene Shape des Wagens
    }

    // NEU: Gib eine Debug-Meldung aus, wenn eine Kollision mit dem Einkaufswagen stattfindet.
    if (hitShape) {
      console.log(`Produkt kollidiert mit Einkaufswagen-Shape. ID der getroffenen Shape: ${hitShape.id}`);
    }

    // Prüfe, ob die getroffene Shape diejenige mit der ID 99 ist.
    if (hitShape && hitShape.id === 99) {

      // 1. Physik für dieses Produkt sicher zur Entfernung vormerken, anstatt sie sofort zu löschen.
      bodiesToRemove.add(boxBody);
      physicObjects.delete(addedProduct);

      // 2. Die Welt-Transformation des Einkaufswagens abrufen.
      const cartWorldMatrix = (_shoppingCartBody as ShoppingCartBody).threemesh.matrixWorld;

      // 3. Die inverse Matrix des Wagens erstellen, um Welt- in lokale Koordinaten umzurechnen.
      const inverseCartMatrix = new THREE.Matrix4().copy(cartWorldMatrix).invert();

      // 4. Das Produkt aus der Szene entfernen und zur Einkaufswagen-Gruppe hinzufügen.
      scene.remove(addedProduct);
      (_shoppingCartBody as ShoppingCartBody).threemesh.add(addedProduct);

      // 5. Die Position des Produkts von Welt- zu lokalen Koordinaten umrechnen und anwenden.
      addedProduct.applyMatrix4(inverseCartMatrix);

      // NEUE LÖSUNG: Visuelle Korrektur mit einer kurzen Animation.
      // Animiere das Produkt sanft auf den Boden des Korbes (lokale Y-Position),
      // um das visuelle "Schweben" zu korrigieren, das durch die Physik-Engine entsteht.
      gsap.to(addedProduct.position, {
        // FINALE KORREKTUR:
        // Wir nehmen den physikalischen Offset des Korbbodens (0.4) und skalieren ihn mit der inversen Skalierung des Einkaufswagen-Modells (1 / 0.01 = 100).
        // Das ergibt die korrekte lokale Y-Position des Korbbodens im visuellen Modell.
        // Darauf addieren wir die halbe Höhe des Produkts, damit es darauf aufsetzt.
        y: (0.4 * 100) + (dimensions.y * addedProduct.scale.y) / 2,
        duration: 0.1, 
        ease: "power2.out",
      });


      // NEU: Erlaube dem Produkt wieder zu "schlafen", um Performance zu sparen,
      // nachdem es sicher im Korb gelandet ist.
      boxBody.allowSleep = true;

      // 6. Den Event-Listener entfernen, da er nur einmal benötigt wird.
      boxBody.removeEventListener("collide", onCollide);

      // 7. NEU: Aktiviere die Wagenverfolgung wieder.
      cartControls.resume();
    }
  };

  boxBody.addEventListener("collide", onCollide);
  world.addBody(boxBody);
  physicObjects.set(addedProduct, boxBody);
  // KORREKTUR: Füge das physische Produkt direkt zur Szene hinzu, nicht zur Einkaufswagen-Gruppe.
  // Dadurch werden seine Weltkoordinaten korrekt von der Physik-Engine gesteuert.
  scene.add(addedProduct);

  // Aufgabe erfüllt

  // KORREKTUR: Verarbeite nur das neu hinzugefügte Produkt, anstatt die ganze Liste neu zu durchlaufen.
  if (newProduct.category === "drinks") {
    drinksCount.value++;
  }
  if (newProduct.category === "noodles") {
    noodelsCheck.value = true;
  }
  if (newProduct.category === "sauces") {
    sauceCheck.value = true;
  }
  if (newProduct.category === "fertig") {
    sauceCheck.value = true;
    noodelsCheck.value = true;
  }
  if (newProduct.category === "snacks") {
    snacksCheck.value = true;
  }
  
  if (drinksCount.value >= 3) {
    drinksCheck.value = true;
  }

  if (
    noodelsCheck.value &&
    sauceCheck.value &&
    drinksCheck.value &&
    snacksCheck.value
  ) {
    taskDone.value = true;
  }

  return ref();
};
