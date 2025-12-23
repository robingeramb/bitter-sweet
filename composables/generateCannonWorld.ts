import CANNON from "cannon";
import { shoppingCartMaterial, COLLISION_GROUPS } from "./useThree"; // KORREKTUR: Korrektes Material importieren

export const generateShoppingCartBody = (): CANNON.Body => {
  const x = 0.37;
  const y = 0.3;
  const z = 0.84;
  const h = 0.04; // Dicke der Wände/des Bodens

  const shoppingCartBody = new CANNON.Body({
    mass: 20, // Eine realistische Masse für einen Einkaufswagen
    type: CANNON.Body.KINEMATIC, // KORREKTUR: Der Wagen wird jetzt kinematisch gesteuert. Er wird nicht mehr von Kollisionen beeinflusst.
    linearDamping: 0.0, // Dämpfung ist für kinematische Körper irrelevant.
    angularDamping: 0.0, // KORREKTUR: Dämpfung reduziert, um eine sanfte Drehung zu ermöglichen.
    material: shoppingCartMaterial, // Das korrekte Material für den Einkaufswagen zuweisen
    collisionFilterGroup: COLLISION_GROUPS.SHOPPING_CART,
    collisionFilterMask:
      COLLISION_GROUPS.PRODUCT | // Soll mit Produkten kollidieren
      COLLISION_GROUPS.GROUND, // Soll mit dem Boden kollidieren
  });

  // KORREKTUR: Der Ursprung des Physik-Körpers (sein .position-Vektor) ist jetzt der unterste Punkt des Wagens.
  // Alle Shapes werden relativ zu diesem Punkt nach oben verschoben, um die Stabilität zu gewährleisten.
  const basketBottomY = 0.4; // Die Y-Position, an der der Boden des Korbes beginnt.

  // KORREKTUR: Anstelle von vier instabilen Kugeln als "Räder" wird eine einzige, stabile Box als Basis verwendet.
  // Diese große, flache Box liegt stabil auf dem Boden und verhindert das "Hüpfen" vollständig.
  // Sie ist das physikalische Äquivalent zum Fahrgestell.
  const baseHeight = 0.2;
  const baseShape = new CANNON.Box(
    new CANNON.Vec3(x / 2, baseHeight / 2, z / 2)
  );
  shoppingCartBody.addShape(baseShape, new CANNON.Vec3(0, baseHeight / 2, 0)); // Positioniert die Basis direkt am Ursprung des Körpers.

  // 1. Boden des Korbes (jetzt korrekt angehoben)
  const floorShape = new CANNON.Box(new CANNON.Vec3(x, h / 2, z));
  shoppingCartBody.addShape(floorShape, new CANNON.Vec3(0, basketBottomY, 0)); // Positioniert den Korb-Boden auf der korrekten Höhe.

  // 2. Seitenwände (links und rechts, jetzt korrekt angehoben)
  const sideWallShape = new CANNON.Box(new CANNON.Vec3(h / 2, y / 2, z / 2));
  shoppingCartBody.addShape(
    sideWallShape,
    new CANNON.Vec3(x / 2, basketBottomY + y / 2, 0) // Rechte Wand
  ); // Rechte Wand
  shoppingCartBody.addShape(
    sideWallShape,
    new CANNON.Vec3(-x / 2, basketBottomY + y / 2, 0) // Linke Wand
  ); // Linke Wand

  // 3. Rückwand (beim Griff, jetzt korrekt angehoben)
  const backWallShape = new CANNON.Box(new CANNON.Vec3(x, y, h));
  shoppingCartBody.addShape(
    backWallShape,
    new CANNON.Vec3(0, basketBottomY + y / 2, z / 2)
  ); // Rückwand

  // 4. Vorderwand (schräg, jetzt korrekt angehoben)
  const frontWallShape = new CANNON.Box(
    new CANNON.Vec3(x / 2, (y + 0.1) / 2, h / 2)
  );
  const frontWallQuaternion = new CANNON.Quaternion();
  frontWallQuaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 12);
  shoppingCartBody.addShape(
    frontWallShape,
    new CANNON.Vec3(0, basketBottomY + y / 2 - 0.05, -z / 2),
    frontWallQuaternion
  );

  shoppingCartBody.fixedRotation = true; // Verhindert, dass der Wagen umkippt

  return shoppingCartBody;
};
