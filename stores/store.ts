import { defineStore } from "pinia";
import { ref } from "vue";

export const useSliderStore = defineStore("slider", () => {
  // 1. Der Zustand (State)
  const sliderValue = ref(29);

  // 2. Die Aktion/Mutation (Action)
  function updateSliderValue(newValue) {
    sliderValue.value = Number(newValue); // Sicherstellen, dass es eine Zahl ist
  }

  // Was die Store-Instanz nach außen gibt
  return { sliderValue, updateSliderValue };
});

export const useVariablesStore = defineStore("variables", () => {
  // 1. Der Zustand (State)
  const playerInMotion = ref(true);
  const showReceiptDone = ref(false);
  const cursorFree = ref(false);
  const mouthOpen = ref(false);
  const cashoutStart = ref(false);
  const cashoutFinished = ref(false);

  // 2. Die Aktion/Mutation (Action)
  function updatePlayerMotion(newValue: boolean) {
    playerInMotion.value = newValue; // Sicherstellen, dass es eine Zahl ist
  }

  function updateMouthOpen(newValue: boolean) {
    mouthOpen.value = newValue; // Sicherstellen, dass es eine Zahl ist
  }

  function updateCashoutStart(newValue: boolean) {
    cashoutStart.value = newValue; // Sicherstellen, dass es eine Zahl ist
  }

  function updateCashoutFinished(newValue: boolean) {
    cashoutFinished.value = newValue; // Sicherstellen, dass es eine Zahl ist
  }

  function updateShowReceiptDone(newValue: boolean) {
    showReceiptDone.value = newValue; // Sicherstellen, dass es eine Zahl ist
    if (newValue) {
      cursorFree.value = true;
    }
  }

  // Was die Store-Instanz nach außen gibt
  return {
    cursorFree,
    playerInMotion,
    updatePlayerMotion,
    showReceiptDone,
    updateMouthOpen,
    mouthOpen,
    updateShowReceiptDone,
    cashoutStart,
    updateCashoutStart,
    cashoutFinished,
    updateCashoutFinished,
  };
});
