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

  const dot = document.createElement("div");
  dot.style.position = "absolute";
  dot.style.left = `${1 - mouthCenter.x * 100}%`;
  dot.style.top = `${mouthCenter.y * 100}%`;
  dot.style.width = "10px";
  dot.style.height = "10px";
  dot.style.background = "red";
  dot.style.borderRadius = "50%";
  dot.style.pointerEvents = "none";
  faceDisplay.value.appendChild(dot);
  gsap.to(faceDisplay.value, {
    scale: i,
    x: dx * i,
    y: dy * i,
    duration: t,
    ease: "power2.inOut",
    onComplete: () => {
      variablesStore.updateShowInnerBody(true);
    },
  });

  webcamScene.value?.zoomIn(i, t, mouthCenter);
}

onMounted(() => {
  //loadMediaPipeScripts();
});

defineExpose({
  startZoom,
  animateTeeth,
  // Optional: Sie könnten auch 'message' exposen, wenn Sie es lesen wollen
  // message
});
</script>
