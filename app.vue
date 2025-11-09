<template>
  <ClientOnly>
    <WebcamScene />
  </ClientOnly>
  <EndScreen v-if="endScreen" @restartFunction="setRestartFunction" />
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
  />
</template>

<script setup lang="ts">
const countdown = ref();
function setRestartFunction() {
  countdown.value.restart();
}

const mousePosition = ref({ x: 0, y: 0 });
const threeJS = ref(null);
const updateMousePosition = (event) => {
  mousePosition.value.x = event.clientX;
  mousePosition.value.y = event.clientY;
};

let lastScrollTime = 0;
const scrollSpeed = 0.01;

const handleWheel = (event) => {
  const deltaY = event.deltaY;

  const currentTime = Date.now();
  const deltaTime = currentTime - lastScrollTime;

  if (deltaTime > 0) {
    scrollValue.value -= deltaY * scrollSpeed; // Scrollen nach oben
    if (scrollValue.value >= 4.5) {
      scrollValue.value = 4.5;
    }
    if (scrollValue.value <= -20) {
      scrollValue.value = -20;
    }
  }

  lastScrollTime = currentTime;
};

const handleKeyDown = (event) => {
  if (event.key === "Escape") {
    scrollValue.value = savedPos.z;
    threeJS.value.leaveSelectMode();
    selectedProductToShelf();
  }
};

function removeListeners() {
  window.removeEventListener("wheel", handleWheel);
  window.removeEventListener("mousemove", updateMousePosition);
  window.removeEventListener("keydown", handleKeyDown);
}

function startSetup() {
  threeJS.value.setupScene();
}

watch(() => endScreen.value, removeListeners);

onMounted(() => {
  window.addEventListener("wheel", handleWheel);
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
}
</style>
