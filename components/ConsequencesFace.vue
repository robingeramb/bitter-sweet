<template>
  <div class="pointer-events-none">
    <WebcamScene
      ref="webcamScene"
      class="translate-y-1/2 pointer-events-none"
    />
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

const { loadMediaPipeScripts, isMediaPipeLoaded } = useMediaPipeLoader();
const webcamScene = ref<InstanceType<
  typeof import("./WebcamScene.vue").default
> | null>(null);

const faceDisplayComponent = ref<InstanceType<
  typeof import("./FaceDisplay.vue").default
> | null>(null);

const faceDisplay = ref<HTMLElement | null>(null);

async function startZoom(i: number, t: number) {
  // 1. Zuerst das Einfrieren und die Mundposition abrufen
  const mouthCenter = await faceDisplayComponent.value?.freezeFrame();
  console.log(mouthCenter);
  if (faceDisplay.value && mouthCenter) {
    const displayElement = faceDisplay.value;
    const elementRect = displayElement.getBoundingClientRect();
    const width = elementRect.width;
    const height = elementRect.height;
    const mirroredX = 1.0 - mouthCenter.x;
    const targetX = mirroredX * width;
    const targetY = mouthCenter.y * height;

    const finalX = (width / 2 - targetX) * (i - 1);
    const finalY = (height / 2 - targetY) * (i - 1);

    // 3. Animation starten
    gsap.to(displayElement, {
      duration: t,
      scaleX: i,
      scaleY: i,
      // Verschiebung des Elements, sodass der Mund in der Mitte zentriert wird
      x: finalX,
      y: finalY,
      ease: "power2.inOut",
    });

    // Aufruf der Child-Funktion in WebcamScene
    webcamScene.value?.zoomIn(i, t, mouthCenter);
  } else {
    console.warn(
      "FaceDisplay-Element oder Mundzentrum konnte nicht gefunden werden für Zoom."
    );
  }
}

onMounted(() => {
  //loadMediaPipeScripts();
});

defineExpose({
  startZoom,
  // Optional: Sie könnten auch 'message' exposen, wenn Sie es lesen wollen
  // message
});
</script>
