<template>
  <div>
    <Button
      class="absolute z-50 left-1/2 -translate-x-1/2 bottom-6"
      :text="'Continue'"
      @click="cameraTurn"
    />
  </div>
</template>

<script lang="ts" setup>
import { camera, taskDone, endScreen } from "@/composables/useThree";
import gsap from "gsap";
import { useVariablesStore } from "@/stores/store";

interface Props {
  faceDisplayRef: any;
}
const emit = defineEmits(["fadeRequested"]);

const props = defineProps<Props>();

function cameraTurn() {
  const targetY = 0.09776897845147936;
  let variablesStore = useVariablesStore();

  // 1. WICHTIG: Die Reihenfolge der Achsen ändern.
  // 'YXZ' sorgt dafür, dass die Y-Drehung (Links/Rechts) unabhängig von der Neigung (X) ist.
  // .reorder() rechnet die aktuellen Winkel so um, dass die Kamera nicht springt.
  camera.rotation.reorder("YXZ");

  // 2. Ziel berechnen: Aktueller Winkel minus 180 Grad (Math.PI) für Uhrzeigersinn
  const targetRotationY = camera.rotation.y + Math.PI;

  // GSAP Animation
  gsap.to(camera.rotation, {
    y: targetRotationY,
    duration: 1.8,
    ease: "power2.inOut",
    // Modifiers entfernen, damit er nicht den "kurzen" Weg (falschrum) nimmt
  });
  emit("fadeRequested");

  // Position
  gsap.to(camera.position, {
    y: targetY,
    duration: 1.8,
    ease: "power2.inOut",
    onComplete: () => {
      if (taskDone.value) endScreen.value = true;
      setTimeout(() => {
        variablesStore.updateCashoutFinished(true);
      }, 900);
    },
  });
}
</script>

<style></style>
