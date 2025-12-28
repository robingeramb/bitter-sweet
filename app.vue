<template>
  <div>
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
      :sugarValue="shoppingCartStore.getSugarScore()"
      v-if="faceDisplayRef && variablesStore.cashoutFinished"
      :releaseWarning="true"
      :mouthOpen="variablesStore.mouthOpen"
      @sequenceCompleted="handleSequenceComplete"
      @animateTeeth="animateTeeth"
      @animateTeethBack="animateTeethBack"
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

    <div
      class="w-full opacity-0 h-full bg-black pointer-events-none fixed left-0 top-0"
      ref="blend"
    ></div>

    <Countdown
      v-if="!endScreen && !variablesStore.cashoutStart"
      ref="countdown"
      :key="boxKey"
      class="z-20"
      @startSetup="startSetup"
    />

    <Box
      v-if="!endScreen"
      :key="boxKey"
      ref="threeJS"
      class="-z-10"
      :mousePos="mousePosition"
      :scrollVal="scrollValue"
      :faceDisplay="faceDisplayRef"
    />

    <Story
      v-if="variablesStore.showInnerBody"
      :sugarAmount="shoppingCartStore.getSugarScore() / 3"
      @retry="fullRetry"
    />
  </div>
</template>

<script setup lang="ts">
import { useVariablesStore, useShoppingCartStore } from "~/stores/store";
import { resetDisplayController } from "~/composables/displayController";
import gsap from "gsap";
const variablesStore = useVariablesStore();
const shoppingCartStore = useShoppingCartStore();

const fullRetry = () => {
  // 1. Die globale Store-Logik ausführen
  // Falls du den ARController wie im vorigen Schritt hast, hier mitgeben
  console.log("retry");
  resetDisplayController();
  // 2. Die Box-Komponente hart neu laden
  reloadBox();
  removeListeners();
  // 3. Optional: Weitere UI-Resets
  if (countdown.value) {
    //countdown.value.restart();
  }

  gsap.to(blend.value, {
    opacity: 0,
    delay: 0,
    duration: 0,
  });

  // Reset der CSS-Animationen/Gsap-Tweens
  gsap.set(".wrapper", { rotateY: 0 });
  gsap.set(faceDisplayRef.value, { opacity: 0 });
  window.addEventListener("mousemove", updateMousePosition);
  window.addEventListener("keydown", handleKeyDown);
};

const boxKey = ref(0);

// Funktion zum Neuladen
function reloadBox() {
  boxKey.value++; // Erhöhen des Keys erzwingt kompletten Neu-Render
}

const countdown = ref();
const blend = ref<HTMLElement | null>(null); // Initialize blend reference

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
  startZoom(32, 2);
};

function startZoom(i: number, t: number) {
  if (consequencesFace.value) {
    consequencesFace.value.startZoom(i, t);
  }
  gsap.to(blend.value, {
    opacity: 1,
    delay: t / 4,
    duration: (t / 4) * 3,
    ease: "power2.inOut",
  });
}

function animateTeeth() {
  console.log("Teeth animation triggered. app.vue");
  if (consequencesFace.value) {
    consequencesFace.value.animateTeeth();
  }
}

function animateTeethBack() {
  if (consequencesFace.value && variablesStore.isSecondPlaythrough) {
    consequencesFace.value.animateTeethBack();
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
