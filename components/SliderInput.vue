<template>
  <div class="fixed top-0 left-0">
    <input
      type="range"
      min="0"
      max="200"
      :value="sliderStore.sliderValue"
      @input="sliderStore.updateSliderValue($event.target.value)"
    />
    <p>Slider-Wert: **{{ sliderStore.sliderValue }}**</p>
  </div>
</template>

<script setup>
import { useSliderStore } from "@/stores/store";

const sliderStore = useSliderStore(); // Store initialisieren
</script>

<style></style>
