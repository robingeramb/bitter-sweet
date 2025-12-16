<template>
  <div
    class="flex z-50 top-0 left-0 w-full h-full text-white fixed flex-col text-center items-center justify-center gap-12"
    :class="{ 'pointer-events-none': !productView }"
  >
    <!-- KORREKTUR: Die Vignette wird jetzt wieder mit einer Vue-Transition gesteuert, die die Deckkraft animiert. -->
    <div v-if="productView" class="blur-vignette-product"></div>
    <div
      class="absolute top-1/2 -translate-y-1/2 w-full flex justify-between items-center px-36 pointer-events-auto"
      v-if="productView"
    >
      <Button @click="selectedProductToShelf" :text="'Back to Shelf'" />
      <Button @click="selectedProductToCart" :text="'Add to Card'" />
    </div>
    <div
      v-show="hoveredProduct != undefined && productView == false"
      class="absolute bg-gray-800 px-4 py-1 rounded-full"
      :style="[
        { left: hoveredMouseX + 20 + 'px' },
        { top: hoveredMouseY - 20 + 'px' },
      ]"
    >
      <p class="select-none">{{ hoveredProduct }}</p>
    </div>
    <!-- KORREKTUR: Das Icon wird jetzt gefüllt und animiert -->
    <div
      v-if="productView && !hasProductBeenRotated && showHandAnimation"
      :style="{ animationIterationCount: iterationCount }"
      class="mouse-icon-wrapper absolute top-1/2 left-1/2 pointer-events-none"
    >
      <!-- KORREKTUR: Icon ist jetzt weiß gefüllt -->
      <Hand :size="32" stroke-width="0.5" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, watch, onMounted, nextTick } from "vue";
import { Hand, MousePointer2 } from "lucide-vue-next";
import {
  hasProductBeenRotated,
  isHoveringSelectedProduct,
} from "@/composables/productSelection";
import {
  productView,
  hoveredProduct,
  hoveredMouseX,
  hoveredMouseY,
} from "@/composables/useThree";
import {
  selectedProductToShelf,
  selectedProductToCart,
} from "@/composables/productSelection";
import Button from "./Button.vue";

const showHandAnimation = ref(true);
const iterationCount = ref(2);
const isInitialAnimationDone = ref(false);

let initialAnimationTimeout: ReturnType<typeof setTimeout> | null = null;
let canTriggerHoverAnimation = false;

watch(
  productView,
  (newVal: boolean) => {
    if (newVal && !hasProductBeenRotated.value) {
      showHandAnimation.value = true;
      iterationCount.value = 2;
      canTriggerHoverAnimation = false;

      if (initialAnimationTimeout) clearTimeout(initialAnimationTimeout);
      initialAnimationTimeout = setTimeout(() => {
        canTriggerHoverAnimation = true;
      }, 3000); // 2 * 1.5s
    } else {
      showHandAnimation.value = false;
      canTriggerHoverAnimation = false;
      if (initialAnimationTimeout) clearTimeout(initialAnimationTimeout);
    }
  },
  { immediate: true }
);

watch(isHoveringSelectedProduct, (isHovering: boolean) => {
  if (isHovering && canTriggerHoverAnimation && !hasProductBeenRotated.value) {
    // Animation für das Hovern auslösen
    iterationCount.value = 1;
    showHandAnimation.value = false;
    nextTick(() => {
      showHandAnimation.value = true;
    });
  }
});
</script>

<style>
/* NEU: Animation für das Maus-Icon */
.mouse-icon-wrapper {
  animation-name: swipe-right;
  animation-duration: 1.5s;
  animation-timing-function: linear;
  animation-fill-mode: forwards; /* Behält den Zustand des letzten Keyframes bei (opacity: 0) */
}

/* NEU: Stile für die Blur-Vignette in der Produktansicht */
.blur-vignette-product {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  /* KORREKTUR: Der Blur-Effekt ist jetzt immer aktiv, aber die Sichtbarkeit wird über die Deckkraft gesteuert. */
  backdrop-filter: blur(4px);
  /* Erstellt eine Maske, die in der Mitte transparent ist und zu den Rändern hin schwarz wird */
  mask-image: radial-gradient(ellipse at center, transparent 50%, black 80%);
  pointer-events: none; /* Stellt sicher, dass die Vignette keine Klicks abfängt */
}

@keyframes swipe-right {
  /* 0% - 60% (1.2s): Die eigentliche Bewegung und das Ausblenden */
  0% {
    /* NEU: Startet unsichtbar und ohne Größe für den "Pop-in"-Effekt */
    transform: translate(-50%, -50%) translateX(-35px) scale(0);
    opacity: 0;
  }
  /* NEU: "Aufploppen" am Anfang der Animation */
  10% {
    transform: translate(-50%, -50%) translateX(-35px) scale(1.1); /* Leichte Übertreibung */
    opacity: 1;
  }
  20% {
    /* Setzt die Skalierung auf normal, bevor die Wischbewegung beginnt */
    transform: translate(-50%, -50%) translateX(-35px) scale(1);
    opacity: 1;
  }
  /* KORREKTUR: Die Animation zum Ausblenden und Skalieren startet jetzt erst kurz vor dem Ende. */
  45% {
    /* Bis hierhin bleibt das Icon voll sichtbar und in normaler Größe */
    transform: translate(-50%, -50%) translateX(20px) scale(1);
    opacity: 1;
  }
  60% {
    /* 1.2s - Endpunkt der sichtbaren Animation */
    /* Am Endpunkt ist das Icon vollständig verschwunden */
    transform: translate(-50%, -50%) translateX(35px) scale(1);
    opacity: 0;
  }
  /* 60% - 100% (0.8s): Pause am Endpunkt, bevor die Animation von vorne beginnt */
  100% {
    transform: translate(-50%, -50%) translateX(35px) scale(1);
    opacity: 0;
  }
}
</style>
