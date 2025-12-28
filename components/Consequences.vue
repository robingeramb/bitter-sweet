<template>
  <div class="w-full flex text-center">
    <ul class="w-full z-10 absolute flex flex-col items-center rounded-md">
      <p class="text-3xl max-w-[45rem] font-light text-white mb-8">
        This happens to your body when consuming
        <span>{{ Math.round(sugarCounter / 3) }}</span
        >g (<span>{{ Math.round(sugarCounter / 3 / 3) }} Sugar cubes</span>) of
        sugar daily :
      </p>
      <ul
        ref="normalCont"
        class="text-white scrollCont px-4 text-lg maxHcalc font-medium text-left max-w-[37rem] flex felx-col consList gap-4"
      >
        <li class="flex opacity-0 gap-6 items-center" v-for="item in consList">
          <div class="w-2 h-2 contain-size flex-0 rounded-full bg-white"></div>
          <div class="flex flex-col">
            <p class="flex-1">{{ item.description }}</p>
            <p class="flex-1 text-xs font-normal">{{ item.subdescription }}</p>
          </div>
        </li>
      </ul>
    </ul>
    <ul
      class="w-full flex flex-col blur-lg absolute items-center text-black rounded-md"
    >
      <p class="text-3xl max-w-[45rem] font-light text-black mb-8">
        This happens to your body when consuming
        <span>{{ Math.round(sugarCounter / 3) }}</span
        >g (<span>{{ Math.round(sugarCounter / 3 / 3) }} Sugar cubes</span>) of
        sugar daily :
      </p>
      <ul
        ref="shadowCont"
        class="text-black scrollCont px-4 text-lg maxHcalc overflow-hidden font-medium text-left max-w-[37rem] flex felx-col consList gap-4"
      >
        <li
          class="flex bg-black opacity-0 gap-6 items-center"
          v-for="item in consList"
        >
          <div class="w-2 h-2 contain-size flex-0 rounded-full bg-white"></div>
          <div class="flex flex-col">
            <p class="flex-1">{{ item.description }}</p>
            <p class="flex-1 text-xs font-normal">{{ item.subdescription }}</p>
          </div>
        </li>
      </ul>
    </ul>
  </div>
</template>

<script lang="ts" setup>
import {
  ref,
  onMounted,
  onBeforeUnmount,
  defineProps,
  defineExpose,
} from "vue";
import gsap from "gsap";

interface Props {
  consList: Array<any>;
  sugarAmount?: number; // Hinzugefügt, falls von außen gesteuert
}

const props = defineProps<Props>();

// Refs für die DOM-Elemente
const shadowCont = ref<HTMLElement | null>(null);
const normalCont = ref<HTMLElement | null>(null);

// Falls sugarCounter von den Props kommt oder lokal ist:
const sugarCounter = ref(props.sugarAmount || 0);

/**
 * Resize Logik
 */
function resize() {
  if (normalCont.value) {
    if (normalCont.value.scrollHeight >= window.innerHeight - 400) {
      normalCont.value.classList.add("overflow-y-scroll");
    } else {
      normalCont.value.classList.remove("overflow-y-scroll");
    }
  }
}

/**
 * Lifecycle Management (Event Listener Korrektur)
 */
onMounted(() => {
  // Initialer Check
  resize();
  // Listener registrieren
  window.addEventListener("resize", resize);
});

onBeforeUnmount(() => {
  // Listener sauber entfernen
  window.removeEventListener("resize", resize);
});

/**
 * Animationen
 */
function startFadeIn() {
  const elements = normalCont.value?.querySelectorAll("li");
  const elementsS = shadowCont.value?.querySelectorAll("li");

  if (elements) {
    gsap.to([elements, elementsS], {
      opacity: 1,
      stagger: 0.15,
      duration: 0.75,
      ease: "power2.out",
    });
  }
}

function fadeBack(totalTime: number) {
  const elements = normalCont.value?.querySelectorAll("li");
  const elementsS = shadowCont.value?.querySelectorAll("li");

  if (elements) {
    gsap.to([elements, elementsS], {
      opacity: 0,
      stagger: 0.1,
      duration: 0.5,
      ease: "power2.in",
    });
  }
}

defineExpose({ startFadeIn, fadeBack });
</script>

<style>
.maxHcalc {
  max-height: calc(100vh - 400px);
}
.consList {
  flex-direction: column;
}

.scrollCont::-webkit-scrollbar {
  width: 8px; /* Breite der Scrollbar */
}

.scrollCont::-webkit-scrollbar-track {
  background: transparent; /* Transparenter Hintergrund */
}

.scrollCont::-webkit-scrollbar-thumb {
  background-color: rgba(
    255,
    255,
    255,
    0.5
  ); /* Farbe des Scrollbalkens mit Transparenz */
  border-radius: 4px; /* Abgerundete Ecken */
}

.scrollCont::-webkit-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 1); /* Farbe beim Hover */
}
</style>
