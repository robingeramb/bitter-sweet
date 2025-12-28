<template>
  <div>
    <div ref="sugarSceneContainer" class="sugarScene-container"></div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref, watch } from "vue";
import * as THREE from "three";
import { World, Body, Box, Vec3, Plane } from "cannon";
import gsap from "gsap";
// Reactive property to control cube count
const sugarCubeCount = ref(40);

interface Props {
  amount: number;
}

const props = defineProps<Props>();

// References
const sugarSceneContainer = ref<HTMLElement | null>(null);

function resize(
  sugarCamera: THREE.PerspectiveCamera,
  sugarRenderer: THREE.WebGLRenderer
) {
  sugarCamera.aspect = window.innerWidth / window.innerHeight;
  sugarCamera.updateProjectionMatrix();
  sugarRenderer.setSize(window.innerWidth, window.innerHeight);
}
// Setup sugarScene, physics, and cubes
onMounted(() => {
  const sugarScene = new THREE.Scene();
  const sugarCamera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );

  const sugarRenderer = new THREE.WebGLRenderer();

  sugarRenderer.setSize(window.innerWidth, window.innerHeight);
  sugarRenderer.setPixelRatio(window.devicePixelRatio); // Nutzt die native Pixeldichte des Geräts

  sugarSceneContainer.value?.appendChild(sugarRenderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  //sugarScene.add(ambientLight);
  // Spotlight
  const sugarSpotlight = new THREE.SpotLight(
    0xffffff,
    10,
    70,
    Math.PI / 3,
    0,
    0
  );
  sugarSpotlight.position.set(10, 60, 10);
  sugarSpotlight.lookAt(0, 0, 0);
  sugarSpotlight.castShadow = true;
  sugarScene.add(sugarSpotlight);

  // Plane (ground)
  const groundGeometry = new THREE.PlaneGeometry(200, 200);
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x222222, // Schwarze Farbe
    // Maximale Metallizität für Reflektionen
    roughness: 0.1,
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  sugarScene.add(ground);

  // Camera position
  sugarCamera.position.set(0, 50, 15);
  sugarCamera.lookAt(0, 0, 0);

  // Cannon.js sugarWorld
  const sugarWorld = new World();
  sugarWorld.gravity.set(0, -9.82, 0);

  // Ground in physics
  const groundBody = new Body({
    mass: 0, // Static body
    shape: new Plane(),
    quaternion: new THREE.Quaternion().setFromAxisAngle(
      new Vec3(1, 0, 0),
      -Math.PI / 2
    ),
  });
  sugarWorld.addBody(groundBody);
  gsap.to(sugarCamera.position, {
    x: 0,
    y: 10,
    z: 15,
    duration: 7,
    onUpdate: () => {
      sugarCamera.lookAt(0, sugarCamera.position.y - 5, 0); // Fixiere den Blickpunkt
    },
  });
  // Function to add cubes
  const cubes: { mesh: THREE.Mesh; body: Body }[] = [];
  const addCube = () => {
    const size = 1;
    const cubeGeometry = new THREE.BoxGeometry(size, size, size);
    const cubeMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    cube.castShadow = true;

    // Random position
    const x = (Math.random() - 0.5) * 1;
    const y = 62 + Math.random() * 10;
    const z = (Math.random() - 0.5) * 1;

    cube.position.set(x, y, z);
    sugarScene.add(cube);

    // Physics body
    const cubeBody = new Body({
      mass: 1,
      position: new Vec3(x, y, z),
      shape: new Box(new Vec3(size / 2, size / 2, size / 2)),
    });
    sugarWorld.addBody(cubeBody);

    cubes.push({ mesh: cube, body: cubeBody });
  };

  // Watch for sugarCubeCount changes
  watch(sugarCubeCount, (newCount) => {
    const currentCubes = cubes.length;
    const diff = newCount - currentCubes;
    if (diff > 0) {
      for (let i = 0; i < diff; i++) {
        addCube();
      }
    }
  });

  // Initial cubes
  setTimeout(() => {
    for (let i = 0; i < props.amount; i++) {
      addCube();
    }
  }, 200);

  // Animation loop
  const clock = new THREE.Clock();
  const animate = () => {
    console.log("SugarCubesanimate");
    const delta = clock.getDelta();

    // Update physics
    sugarWorld.step(1 / 60, delta, 3);

    // Sync mesh positions with physics bodies
    cubes.forEach(({ mesh, body }) => {
      mesh.position.copy(body.position as unknown as THREE.Vector3);
      mesh.quaternion.copy(body.quaternion as unknown as THREE.Quaternion);
    });

    sugarRenderer.render(sugarScene, sugarCamera);
    requestAnimationFrame(animate);
  };

  animate();

  // Resize handler
  window.addEventListener("resize", resize(sugarCamera, sugarRenderer));
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", () => {
    resize;
  });
});
</script>

<style>
.sugarScene-container {
  width: 100%;
  height: 100vh;
  overflow: hidden;
}
</style>
