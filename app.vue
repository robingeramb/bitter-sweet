<template>
  <CashRegisterOverlay
    v-if="
      faceDisplayRef &&
      variablesStore.showReceiptDone &&
      !variablesStore.cashoutFinished
    "
    :faceDisplayRef="faceDisplayRef"
    @fadeRequested="fadeInFace"
  />

  <SugarConsequences
    :sugarValue="90"
    v-if="faceDisplayRef && variablesStore.cashoutFinished"
    :releaseWarning="true"
    :mouthOpen="variablesStore.mouthOpen"
    @sequence-completed="handleSequenceComplete"
  />
  <!---->
  <div class="szene" v-if="!endScreen">
    <div class="wrapper">
      <div class="faceConsequences pointer-events-none" ref="faceDisplayRef">
        <ConsequencesFace ref="consequencesFace" />
      </div>
    </div>
  </div>
  <!--<EndScreen v-if="endScreen" @restartFunction="setRestartFunction" />-->

  <Countdown
    v-if="!endScreen"
    ref="countdown"
    class="z-20"
    @startSetup="startSetup"
  />

  <Box
    v-if="!endScreen"
    ref="threeJS"
    class="-z-10"
    :mousePos="mousePosition"
    :scrollVal="scrollValue"
    :faceDisplay="faceDisplayRef"
  />
</template>

<script setup lang="ts">
import { useVariablesStore } from "~/stores/store";
import gsap from "gsap";
const variablesStore = useVariablesStore();

const countdown = ref();

const faceDisplayRef = ref<HTMLElement | null>(null);
const consequencesFace = ref<HTMLElement | null>(null);
// Typisierung der Ref für den FaceDisplay-Komponenten-Instance

function setRestartFunction() {
  countdown.value.restart();
}

const mousePosition = ref({ x: 0, y: 0 });
const threeJS = ref(null);
const updateMousePosition = (event: MouseEvent) => {
  mousePosition.value.x = event.clientX;
  mousePosition.value.y = event.clientY;
};

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === "Escape") {
    if (threeJS.value) {
      threeJS.value.leaveSelectMode();
    }
    selectedProductToShelf();
  }
};

function fadeInFace() {
  gsap.to(".wrapper", {
    rotateY: 180, // rotiert das Video um den Ursprung
    duration: 1.8,
    ease: "power2.inOut",
  });
  setTimeout(() => {
    gsap.to(faceDisplayRef.value, {
      opacity: 1, // rotiert das Video um den Ursprung
      duration: 0,
      ease: "power2.inOut",
    });
  }, 900);
}

function removeListeners() {
  window.removeEventListener("mousemove", updateMousePosition);
  window.removeEventListener("keydown", handleKeyDown);
}

function startSetup() {
  if (threeJS.value) {
    threeJS.value.setupScene();
  }
}

const handleSequenceComplete = () => {
  startZoom(3, 2);
};

function startZoom(i: number, t: number) {
  if (consequencesFace.value) {
    consequencesFace.value.startZoom(i, t);
  }
}

watch(() => endScreen.value, removeListeners);

onMounted(() => {
  window.addEventListener("mousemove", updateMousePosition);
  window.addEventListener("keydown", handleKeyDown);
});

onBeforeUnmount(() => {
  removeListeners();
});
</script>
<style>
* {
  padding: 0px;
  margin: 0px;
  font-family: "Poppins", serif;
}

body {
  width: 100vw;

  overflow: hidden;
}

.szene {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: scale(-1, 1);
  transform-style: preserve-3d;
  perspective: 1200px;
}

.wrapper {
  transform-style: preserve-3d;
}

.faceConsequences {
  transform: translateY(-50%) translateX(-50%) translateZ(800px) scale(1.8); /* Abstand vom Mittelpunkt */
  position: absolute;
  opacity: 0;
  top: 0;
  left: 0;
}
</style>
