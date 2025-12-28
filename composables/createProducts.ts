import * as THREE from "three";
import { useProductsStore } from "~/stores/products";

export async function createProducts(
  shelfWidth: number,
  shelfLength: number,
  productList: Array<{ model?: string }>
): Promise<THREE.Group> {
  const dist = 0.1;
  const products = new THREE.Group();
  const myStore = useProductsStore();
  const productOrigin = myStore.products;

  // Berechnung der verfügbaren Breite pro Produkt
  const l =
    (shelfLength - dist * (productList.length + 1)) / productList.length;

  for (let index = 0; index < productList.length; index++) {
    const productKey = productList[index];
    const element = productOrigin[productKey];

    if (!element) continue; // Falls das Produkt im Store nicht existiert

    let dimensions = new THREE.Vector3(1, 1, 1);
    let product: THREE.Object3D;

    if (element.model) {
      // 1. Modell laden
      let mdl = await loadModel(element.model);

      if (element.meshMode !== false) {
        // MESH MODE
        const mesh = mdl.isMesh
          ? (mdl as THREE.Mesh)
          : (mdl.children.find((child) => child.isMesh) as THREE.Mesh);

        if (mesh && mesh.geometry) {
          product = mesh.clone();

          // WICHTIG: BoundingBox neu berechnen
          product.geometry.computeBoundingBox();
          const box = new THREE.Box3().setFromObject(product);
          box.getSize(dimensions);

          product.castShadow = true;
          product.receiveShadow = true;

          // INFINITY CHECK: Verhindert Division durch 0
          const height = dimensions.y > 0 ? dimensions.y : 0.35;
          const scaleFactor = 0.35 / height;

          product.scale.set(scaleFactor, scaleFactor, scaleFactor);
          product.position.set(index * (l + dist) + l / 2 + dist, 0, 0.1);
          product.rotation.y = Math.PI / 2;
        } else {
          product = new THREE.Group(); // Fallback
        }
      } else {
        // GROUP / SCENE MODE
        product = mdl.clone(); // Klonen, um Original nicht zu verändern

        // Präzisere BoundingBox für Gruppen
        const boundingBox = new THREE.Box3().setFromObject(product);
        boundingBox.getSize(dimensions);

        let scale = element.scale || 0.35;

        // INFINITY CHECK
        const height = dimensions.y > 0 ? dimensions.y : scale;
        const scaleFactor = scale / height;

        product.scale.set(scaleFactor, scaleFactor, scaleFactor);

        product.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.userData.productName = element.productName;
            child.userData.selectParent = true;
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        product.position.set(index * (l + dist) + l / 2 + dist, scale / 2, 0.1);
        if (element.rotation) {
          product.rotation.y = element.rotation;
        }
      }
    } else {
      // BOX FALLBACK (Einfache Geometrie)
      const color = getRandomColor(0x000000);
      const productMaterial = new THREE.MeshStandardMaterial({ color });
      const productGeometry = new THREE.BoxGeometry(l, 0.3, 0.3);

      productGeometry.translate(l / 2 + dist, 0.15, 0);
      product = new THREE.Mesh(productGeometry, productMaterial);
      product.position.set(index * (l + dist), 0, 0);
    }

    // Metadaten setzen
    product.castShadow = true;
    product.receiveShadow = true;
    product.userData = { ...element, finalLayer: true, dimensions };

    products.add(product);
  }

  return products;
}
