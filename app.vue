<template>
  <div>
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
    />
  </div>
  <!-- <Story/> -->
  <!-- <Ende/> -->
</template>

<script setup lang="ts">
const countdown = ref();
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

function removeListeners() {
  window.removeEventListener("mousemove", updateMousePosition);
  window.removeEventListener("keydown", handleKeyDown);
}

function startSetup() {
  if (threeJS.value) {
    threeJS.value.setupScene();
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
</style>
