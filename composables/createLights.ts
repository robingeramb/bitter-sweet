import * as THREE from "three";
import { RectAreaLightHelper } from "three/examples/jsm/helpers/RectAreaLightHelper.js";
import { markRaw } from "vue";

export const spotLight = new THREE.SpotLight(0xffffff, 4, 1.4);

export async function createLights(
  floorLength: number,
  shelfWidth: number,
  shelfLength: number,
  dist: number
) {
  const lights = new THREE.Group();
  const lightModel = await loadModel("supermarket_lamp.glb");
  const stencilGeometry = new THREE.CylinderGeometry(0.18, 0.18, 0.1, 30);
  const stencilMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xfff000),
  });
  const stencil = new THREE.Mesh(stencilGeometry, stencilMaterial);
  stencil.material.transparent = !0;
  stencil.material.opacity = 0;
  stencil.renderOrder = -1;
  for (
    let index = 0;
    index < floorLength / ((shelfWidth + dist) * 2);
    index++
  ) {
    const light = lightModel.clone();
    const lightGroup = new THREE.Group();
    const rectAreaLight = new THREE.RectAreaLight(0xffffff, 1, 0.7, 2);
    lightGroup.position.set(0, 3, -1 * (index * ((shelfWidth + dist) * 2)));
    rectAreaLight.rotateX(-Math.PI / 2); // Ensure light points at the center

    const rectLightHelper = new RectAreaLightHelper(rectAreaLight); // Helper to visualize the light
    // NEU: Verhindern, dass Vue den Helper reaktiv macht.
    markRaw(rectLightHelper);

    rectAreaLight.add(rectLightHelper);
    const spotLight = new THREE.PointLight(0xfcfbed, 16, 20);
    spotLight.position.set(0, 0.049, 0);

    spotLight.castShadow = true;
    spotLight.shadow.mapSize.width = 2048; // Höhere Auflösung für schärfere Schatten
    spotLight.shadow.mapSize.height = 2048;

    light.position.set(0, -0.04, 0);
    light.scale.set(2, 2, 2);

    // NEU: Verhindern, dass Vue die Lichter und ihre Unterobjekte reaktiv macht.
    markRaw(lightGroup);
    markRaw(spotLight);

    lightGroup.add(spotLight);
    const stencil2 = stencil.clone();
    stencil2.position.set(0, 0.0999, 0);
    lightGroup.add(stencil2);
    lightGroup.add(light);
    //lightGroup.add(glassContainer);
    //lightGroup.add(rectAreaLight);
    lights.add(lightGroup);
  }
  // NEU: Die gesamte Gruppe als nicht-reaktiv markieren, bevor sie zurückgegeben wird.
  markRaw(lights);

  scene.add(spotLight);
  return lights;
}
