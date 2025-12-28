<template>
  <div class="pointer-events-none">
    <WebcamScene ref="webcamScene" class="pointer-events-none" />
    <div class="pointer-events-none" v-if="!isMediaPipeLoaded">
      Lade KI-Modelle...
    </div>

    <div
      ref="faceDisplay"
      class="z-10 pointer-events-none h-[100vh] w-[100vw] -translate-y-1/2"
      v-else
    >
      <FaceDisplay ref="faceDisplayComponent" class="pointer-events-none" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted } from "vue";
import { useMediaPipeLoader } from "@/composables/useMediaPipeLoader";
import gsap from "gsap";
import { useVariablesStore } from "@/stores/store";

const variablesStore = useVariablesStore();

const { loadMediaPipeScripts, isMediaPipeLoaded } = useMediaPipeLoader();
const webcamScene = ref<InstanceType<
  typeof import("./WebcamScene.vue").default
> | null>(null);

const faceDisplayComponent = ref<InstanceType<
  typeof import("./FaceDisplay.vue").default
> | null>(null);

const faceDisplay = ref<HTMLElement | null>(null);

setTimeout(() => {
  faceDisplayComponent.value?.freezeFrame();
}, 1000);

function animateTeeth() {
  console.log("animateTeeth aufgerufen ConsequencesFace");
  webcamScene.value?.animateTeeth();
}

function animateTeethBack() {
  console.log("animateTeethBack aufgerufen ConsequencesFace");
  webcamScene.value?.animateTeethBack();
}

async function startZoom(i: number, t: number) {
  const mouthCenter = await faceDisplayComponent.value?.freezeFrame();
  if (!mouthCenter || !faceDisplay.value) return;

  console.log(mouthCenter);

  const w = window.innerWidth;
  const h = window.innerHeight;

  const canvasRect = faceDisplayComponent.value?.getCanvasRect?.();
  if (!canvasRect) return;

  const displayRect = faceDisplay.value.getBoundingClientRect();

  // 1️⃣ Mouth → Viewport (Shader ist gespiegelt!)
  const mouthViewportX = (1 - mouthCenter.x) * w;
  const mouthViewportY = mouthCenter.y * h;

  // 2️⃣ Viewport → FaceDisplay lokal
  const localX = mouthViewportX;
  const localY = mouthViewportY;

  // 3️⃣ Zoom-Kompensation
  const dx = w / 2 - localX;
  const dy = h / 2 - localY;

  gsap.set(faceDisplay.value, {
    transformOrigin: "50% 50%",
  });

  gsap.to(faceDisplay.value, {
    scale: i,
    x: dx * i,
    y: dy * i,
    duration: t,
    ease: "power2.inOut",
    onComplete: () => {
      variablesStore.updateShowInnerBody(true);
      setTimeout(() => {
        reset();
      }, 500);
    },
  });

  webcamScene.value?.zoomIn(i, t, mouthCenter);
}

async function reset() {
  // 2. GSAP Animationen am Container zurücksetzen
  if (faceDisplay.value) {
    gsap.to(faceDisplay.value, {
      scale: 1,
      x: 0,
      y: 0,
      duration: 0,
      onComplete: () => {
        // Sicherstellen, dass nach der Animation alles sauber ist
        gsap.set(faceDisplay.value, { clearProps: "all" });
      },
    });
  }

  // 3. Three.js in WebcamScene zurücksetzen
  // Hier musst du sicherstellen, dass WebcamScene.vue eine resetScene() Methode hat
  if (webcamScene.value) {
    //webcamScene.value.resetScene?.();
  }

  // 4. FaceDisplay/MediaPipe-Status zurücksetzen
  if (faceDisplayComponent.value) {
    // Falls du dort einen Freeze-Frame oder Texturen hast:
    faceDisplayComponent.value.unfreezeFrame();
  }
}

onMounted(() => {
  //loadMediaPipeScripts();
});

onBeforeUnmount(() => {
  reset();
  console.log("ConsequencesFace unmounted, reset called.");
});

defineExpose({
  startZoom,
  animateTeeth,
  animateTeethBack,
  // Optional: Sie könnten auch 'message' exposen, wenn Sie es lesen wollen
  // message
});
</script>
