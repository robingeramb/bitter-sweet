<template>
  <div>
    <!-- Fullscreen Start Screen -->
    <div
      v-if="!gameOver && !clockStart"
      class="flex background flex-col items-center justify-center h-screen bg-neutral-950 text-white"
    >
      <div v-if="!started" class="flex flex-col items-center">
        <div class="text-center flex items-center flex-col mb-16">
          <div class="relative">
            <img
              class="w-[40rem] translate-x-3"
              src="/images/Logo.png"
              alt=""
            />

            <!---<h1
              class="absolute top-2 right-2 blur-sm whitespace-nowrap text-8xl hdl mb-16 text-black opacity-20"
            >
              Bitter-Sweet
            </h1>--->
          </div>

          <p
            class="bg-black bg-opacity-50 backdrop-blur-sm border-opacity-70 shadow-xl border-white border-[1px] p-10 rounded-2xl mb-8 text-white"
          >
            Your parents are coming to visit tonight. <br />You want to cook a
            good pasta meal for 3 people and still need drinks and snacks.<br />
            You're running late and only have 5 minutes to do the shopping.
          </p>
          <h1 class="text-4xl font-bold">{{ formattedTime }}</h1>
        </div>

        <Button @click="startGame" class="" :text="'Start'" />
      </div>

      <div
        v-if="!clockStart && started"
        class="flex w-full h-full absolute top-0 justify-center backdrop-blur-sm left-0 bg-black bg-opacity-70 flex-col gap-8 items-center"
      >
        <div
          class="bg-orange-300 bg-opacity-100 h-4 backdrop-blur-sm w-80 relative rounded-full overflow-hidden"
        >
          <div
            :style="{ width: (loadedItems / 130) * 100 + '%' }"
            class="h-full bg-orange-500"
          ></div>
        </div>
        <p>{{ loadingMessage }}</p>
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
      v-if="started && !gameOver && !endScreen && clockStart"
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
        <div class="handwritten text-sm text-black">Noodles</div>
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
  </div>
</template>

<script setup>
import { ref } from "vue";
const emit = defineEmits(["startSetup"]);
const time = ref(300); // 5 minutes in seconds
const started = ref(false);
const testMode = true;

const gameOver = ref(false);
let interval = null;

const startGame = () => {
  emit("startSetup");
  started.value = true;
};

watch(
  () => loadingProgress.value,
  (newValue) => {
    if (
      (newValue >= 100 &&
        started.value &&
        loadedItems.value > 128 &&
        clockStart.value == false) ||
      (newValue >= 100 &&
        started.value &&
        testMode == true &&
        clockStart.value == false)
    ) {
      setTimeout(() => {
        startCountdown();
      }, 200);
      // Funktion aufrufen
    }
  }
);

const startCountdown = () => {
  clockStart.value = true;
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
</style>
