<template>
  <div>
    <!-- NEU: Video-Ladebildschirm -->
    <!-- <VideoLoader v-if="showVideoLoader" :videos="preloadedVideoUrls" @video-finished="handleVideoFinish" /> -->
    <!-- Fullscreen Start Screen -->
    <div
      v-if="!gameOver && !clockStart"
      class="flex background flex-col items-center justify-center h-screen bg-neutral-950 text-white relative"
    >
      <!-- Vignettes -->
      <div class="blur-vignette"></div>
      <div class="vignette"></div>

      <div v-if="!started" class="flex flex-col items-center z-10">
        <div class="text-center flex items-center flex-col">
          <div class="relative">
            <img
              class="w-[40rem] translate-x-3"
              src="/images/Logo_BitterSweet.png"
              alt=""
            />
          </div>
        </div>

        <Button
          @click="startGame"
          class=""
          :text="'Start'"
          :loading="isLoadingVideos"
        />
      </div>
    </div>
    <!-- Fullscreen Game Over Screen -->
    <div
      v-if="gameOver"
      class="flex background items-center justify-center h-screen bg-red-800 text-white"
    >
      <div class="text-center flex flex-col items-center">
        <div class="relative">
          <h1 class="text-8xl hdl relative z-10 mb-16 text-orange-800">
            Game Over
          </h1>
          <h1
            class="absolute top-2 right-2 blur-sm whitespace-nowrap text-8xl hdl mb-16 text-black opacity-20"
          >
            Game Over
          </h1>
        </div>
        <Button @click="restart" :text="'restart'" />
      </div>
    </div>

    <!-- Countdown Timer in the Corner -->
    <div
      v-if="started && !gameOver && !endScreen && clockStart"
      class="fixed top-5 min-w-24 right-1/2 translate-x-1/2 bg-gray-900 bg-opacity-50 text-white text-xl text-center font-medium px-4 py-2 rounded-full shadow"
    >
      {{ formattedTime }}
    </div>
    <div
      v-if="
        started &&
        !gameOver &&
        !endScreen &&
        clockStart &&
        variablesStore.playerInMotion
      "
      class="fixed flex-col flex top-5 min-w-24 right-5 background-element text-xl text-center font-medium px-4 py-4 rounded-sm"
    >
      <h3 class="handwritten text-black m-3">Shopping List</h3>
      <div class="flex gap-3 items-center">
        <div class="checkbox mb-1 ml-3">
          <div
            class="border-black flex items-center justify-center border-2 rounded-md h-5 w-5"
          >
            <svg
              v-if="noodelsCheck"
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 20 20"
            >
              <path
                fill="none"
                stroke="black"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="4"
                d="m5 12l5 5L20 7"
              />
            </svg>
          </div>
        </div>
        <div class="handwritten text-sm text-black">Pasta</div>
      </div>
      <div class="flex gap-3 items-center">
        <div class="checkbox mb-1 ml-3">
          <div
            class="border-black flex items-center justify-center border-2 rounded-md h-5 w-5"
          >
            <svg
              v-if="sauceCheck"
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 20 20"
            >
              <path
                fill="none"
                stroke="black"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="4"
                d="m5 12l5 5L20 7"
              />
            </svg>
          </div>
        </div>
        <div class="handwritten text-sm text-black">Sauce</div>
      </div>
      <div class="flex gap-3 items-center">
        <div class="checkbox mb-1 ml-3">
          <div
            class="border-black flex items-center justify-center border-2 rounded-md h-5 w-5"
          >
            <svg
              v-if="drinksCheck"
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 20 20"
            >
              <path
                fill="none"
                stroke="black"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="4"
                d="m5 12l5 5L20 7"
              />
            </svg>
          </div>
        </div>
        <div class="handwritten text-sm text-black">
          {{ drinksCount }}/3 Drinks
        </div>
      </div>
      <div class="flex gap-3 items-center">
        <div class="checkbox mb-1 ml-3">
          <div
            class="border-black flex items-center justify-center border-2 rounded-md h-5 w-5"
          >
            <svg
              v-if="snacksCheck"
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 20 20"
            >
              <path
                fill="none"
                stroke="black"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="4"
                d="m5 12l5 5L20 7"
              />
            </svg>
          </div>
        </div>
        <div class="handwritten text-sm text-black">Snacks</div>
      </div>
    </div>

    <!-- Checkout Hint -->
    <div
      v-if="
        variablesStore.shoppingDone &&
        !variablesStore.cashoutStart &&
        !gameOver &&
        !endScreen
      "
      class="fixed top-20 left-1/2 -translate-x-1/2 pointer-events-none"
    >
      <div class="bg-gray-900 bg-opacity-50 text-white px-5 py-2 rounded-full text-sm font-medium animate-subtle-bounce">
        Go to checkout and click to pay
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import Button from "./Button.vue";
import VideoLoader from "./VideoLoader.vue";
import {
  loadingProgress,
  clockStart,
  endScreen,
  noodelsCheck,
  sauceCheck,
  drinksCheck,
  snacksCheck,
  drinksCount,
} from "@/composables/useThree";
import { useVariablesStore } from "~/stores/store";

const variablesStore = useVariablesStore();

// NEU: Zustände für den Lade-Flow
const sceneLoaded = ref(false);
const videoFinishedOnce = ref(false);

// NEU: Variablen für das Video-Preloading
const isLoadingVideos = ref(false);
const videoPaths = [
  "/videos/Szene1.webm",
  "/videos/Szene2.webm",
  "/videos/Szene3.webm",
];
const preloadedVideoUrls = ref([]);

const emit = defineEmits(["startSetup"]);
const time = ref(300); // 5 minutes in seconds
const started = ref(false);

const gameOver = ref(false);
let interval = null;

const startGame = async () => {
  // 1. Lade-Status aktivieren (Button zeigt Spinner)
  isLoadingVideos.value = true;

  try {
    // 2. Alle Videos vorladen
    const promises = videoPaths.map(async (path) => {
      const response = await fetch(path);
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    });

    preloadedVideoUrls.value = await Promise.all(promises);
  } catch (error) {
    console.error("Fehler beim Laden der Videos:", error);
    // Fallback: Falls das Laden fehlschlägt, nutzen wir die normalen Pfade
    preloadedVideoUrls.value = videoPaths;
  } finally {
    isLoadingVideos.value = false;
  }

  // 3. Spiel starten (VideoLoader wird angezeigt)
  emit("startSetup");
  started.value = true;
  // The video loader will now be shown and will emit 'video-finished' when it's done.
  handleVideoFinish(); // KORREKTUR: Entfernt, damit das Video nicht sofort übersprungen wird.
};

// NEU: Logik, um den Ladebildschirm zu beenden
const showVideoLoader = computed(() => started.value && !clockStart.value);

const handleVideoFinish = () => {
  videoFinishedOnce.value = true;
  // Ruft tryFinishLoading auf, sobald die Videosequenz beendet ist.
  tryFinishLoading();
};

const tryFinishLoading = () => {
  if (sceneLoaded.value && videoFinishedOnce.value) {
    clockStart.value = true;
    startCountdown();
  }
};

watch(videoFinishedOnce, (finished) => {
  if (finished) {
    tryFinishLoading();
  }
});

// NEU: Überwache die Checkliste und aktualisiere den Store, wenn alles erledigt ist
watch(
  [noodelsCheck, sauceCheck, drinksCheck, snacksCheck],
  ([noodels, sauce, drinks, snacks]) => {
    if (noodels && sauce && drinks && snacks) {
      variablesStore.updateShoppingDone(true);
    }
  }
);

watch(
  loadingProgress,
  (progress) => {
    if (progress >= 100 && !sceneLoaded.value) {
      sceneLoaded.value = true;
      tryFinishLoading();
    }
  },
  { immediate: true }
); // KORREKTUR: immediate: true stellt sicher, dass wir den Status auch erfassen, wenn das Laden schon fertig ist.

const startCountdown = () => {
  // Verhindern, dass das Intervall mehrfach gestartet wird.
  if (interval) {
    return;
  }

  interval = setInterval(() => {
    if (time.value > 0) {
      time.value -= 1;
    } else {
      clearInterval(interval);
      gameOver.value = true;
    }
  }, 1000);
};

const restart = () => {
  time.value = 300; // Reset to 5 minutes
  //started.value = false;
  gameOver.value = false;
  clearInterval(interval);
  startCountdown();
};

const formattedTime = computed(() => {
  const minutes = Math.floor(time.value / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (time.value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
});

defineExpose({ restart });
</script>

<style scoped>
body {
  @apply bg-gray-900;
}

.hdl {
  font-family: "Gardez", "firula";
}

@font-face {
  font-family: "handwritten";
  src: url("/fonts/CoalhandLuke TRIAL.ttf") format("truetype");
  font-weight: normal;
  font-style: normal;
}

.background-element {
  background-image: url("/images/paper.png");
  background-size: cover;
}

.handwritten {
  font-family: "handwritten", sans-serif;
}

.background {
  background-image: url("/models/textures/ceramic_tiles/baseColor.webp");
  background-size: 40%;
}

.vignette {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(
    ellipse at center,
    rgba(0, 0, 0, 0) 40%,
    rgba(0, 0, 0, 0.8) 100%
  );
  pointer-events: none;
  z-index: 1;
}

.blur-vignette {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  backdrop-filter: blur(4px);
  mask-image: radial-gradient(ellipse at center, transparent 30%, black 80%);
  pointer-events: none;
  z-index: 1;
}

.animate-subtle-bounce {
  animation: subtle-bounce 1s infinite;
}

@keyframes subtle-bounce {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}
</style>
