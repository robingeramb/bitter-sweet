import CANNON from "cannon";
import * as THREE from "three";
import {
  COLLISION_GROUPS,
  productMaterial,
  _shoppingCartBody,
  scene,
  setPhysicObject,
  world,
  sugarCounter,
  productsInCartData,
  drinksCount,
  noodelsCheck,
  sauceCheck,
  snacksCheck,
  drinksCheck,
  taskDone,
  type ProductData,
  bodiesToRemove,
  cartControls,
  productSelection,
  setLastClickedObject,
  setSelectedProduct,
} from "./useThree"; // NEU: _shoppingCartBody und weitere importieren
import { useShoppingCartStore } from "@/stores/store";

// KORREKTUR: Erweitere den Body-Typ, um die threemesh-Eigenschaft zu erlauben.
interface ShoppingCartBody extends CANNON.Body {
  threemesh: THREE.Object3D;
}

export const useAddProductToCart = (
  addedProduct: THREE.Object3D,
  originalObject: THREE.Object3D
) => {
  const shoppingCartStore = useShoppingCartStore();
  // NEU: Pausiere die Wagenverfolgung, sobald das Produkt hinzugefügt wird.
  cartControls.pause();

  const newProduct = originalObject.userData as ProductData;
  // Schritt 1: Logik zum Hinzufügen zum Warenkorb (Zucker zählen, etc.)
  sugarCounter.value += newProduct.sugarAmount;
  productsInCartData.push(newProduct);

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
    dimensions = (addedProduct as THREE.Mesh).geometry.boundingBox!.getSize(
      new THREE.Vector3()
    );
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
  boxBody.collisionFilterMask =
    COLLISION_GROUPS.SHOPPING_CART |
    COLLISION_GROUPS.GROUND |
    COLLISION_GROUPS.PRODUCT;

  // KORREKTUR: Positioniere das Objekt direkt über dem Einkaufswagen, damit es hineinfallen kann.
  const spawnPosition = productSelection.position
    .clone()
    .add(new THREE.Vector3(0, 0.8, 0));
  boxBody.position.copy(spawnPosition as unknown as CANNON.Vec3);
  addedProduct.position.copy(spawnPosition); // Synchronisiere auch die visuelle Position

  // --- NEUE LOGIK: Produkt beim ersten Kontakt an den Wagen "kleben" ---
  // KORREKTUR: Die onCollide-Logik wird entfernt. Das Produkt bleibt ein dynamisches
  // physikalisches Objekt, auch nachdem es im Korb gelandet ist. Dadurch kann es
  // mit anderen Produkten kollidieren.
  const onCollide = (event: any) => {
    // Die Wagenverfolgung wird nach einer kurzen Verzögerung wieder aufgenommen.
    setTimeout(() => cartControls.resume(), 500);
    boxBody.removeEventListener("collide", onCollide);
  };

  boxBody.addEventListener("collide", onCollide);
  world.addBody(boxBody);
  setPhysicObject(addedProduct, boxBody);
  // KORREKTUR: Füge das physische Produkt direkt zur Szene hinzu, nicht zur Einkaufswagen-Gruppe.
  // Dadurch werden seine Weltkoordinaten korrekt von der Physik-Engine gesteuert.
  scene.add(addedProduct);

  // Aufgabe erfüllt

  // KORREKTUR: Verarbeite nur das neu hinzugefügte Produkt, anstatt die ganze Liste neu zu durchlaufen.
  // KORREKTUR: Setze die globalen Zustände zurück, nachdem das Produkt hinzugefügt wurde.
  setSelectedProduct(null);
  setLastClickedObject(null);

  shoppingCartStore.addItemToCart(newProduct);

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
