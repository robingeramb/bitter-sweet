<template>
  <div class="center-container z-50 fixed pointer-events-none">
    <transition name="fade" mode="out-in" appear>
      <div :key="currentStep" v-if="stage === 'intro'">
        <h1>Open your mouth and face what sugar’s done.</h1>
      </div>

      <h1 v-else-if="setBack" :key="'warning'">
        Open your mouth to see the consequences inside.
      </h1>

      <h1 v-else-if="stage === 'waiting' && showReminder" :key="'remind'">
        I know it's easier to ignore it. But that's not the way to go. Open up.
      </h1>

      <h2
        v-else-if="stage === 'info' || stage === 'final'"
        :key="stage === 'final' ? 'final' : infoStep"
      >
        {{ currentDisplayText }}
      </h2>
    </transition>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, watch, onUnmounted } from "vue";
import { ThreeJSManager } from "../composables/ThreeJSManager";
// Hinweis: threeJSManager ist hier nicht direkt involviert, aber die Imports bleiben
let threeJSManager: ThreeJSManager | null = null;

// **NEU: Definiere das Event, das an den Parent gesendet wird**
const emit = defineEmits<{
  (e: "sequenceCompleted"): void;
}>();

interface Props {
  sugarValue: number;
  mouthOpen: boolean;
  releaseWarning: boolean; // TRUE: Warnung kann erscheinen. FALSE: Warnung erscheint nie wieder.
}

const props = defineProps<Props>();

/* ---------------- KONFIGURATION ---------------- */
const STEPS_DELAY = 5000;
const INTRO_DURATION = 3000;
const WAITING_TIMEOUT = 5000;
const MOUTH_HOLD_DURATION = 1000;
const FADE_OUT_DURATION = 600;

const SUGAR_LEVELS = [
  {
    max: 25,
    lines: [
      "You’re in the safe zone. At 0–25g sugar per day your teeth can recover.",
      "Acids fade, enamel repairs itself, cavities are unlikely.",
    ],
  },
  {
    max: 50,
    lines: [
      "Still under control. At 25–50g sugar per day acid attacks occur.",
      "Your teeth can still keep up — as long as sugar isn’t constant.",
    ],
  },
  {
    max: 75,
    lines: [
      "This is the tipping point. At 50–75g sugar per day damage starts winning.",
      "Enamel breaks down faster than it recovers. You won’t feel it yet.",
    ],
  },
  {
    max: 100,
    lines: [
      "The risk is obvious now. At 75–100g sugar per day your teeth are under attack.",
      "Sensitivity and decay become normal — silence does not mean safety.",
    ],
  },
  {
    max: Infinity,
    lines: [
      "Beyond 100g sugar per day there is no reset.",
      "Acid never stops. Decay accelerates. Tooth loss becomes the trajectory.",
    ],
  },
];

/* ---------------- STATES ---------------- */
const stage = ref<
  "intro" | "waiting" | "info" | "final" | "completed" | "completed_check"
>("intro");
const currentStep = ref(3);
const infoStep = ref(0);
const progressIndex = ref(0);
const showReminder = ref(false);
const setBack = ref(false);

let mainTimer: ReturnType<typeof setTimeout> | null = null;
let reminderTimer: ReturnType<typeof setTimeout> | null = null;
let mouthHoldTimer: ReturnType<typeof setTimeout> | null = null;

/* ---------------- COMPUTED ---------------- */

const currentDisplayText = computed(() => {
  if (stage.value === "final")
    return "So, now we take a deep dive into your body to see the other consequences";
  const level = SUGAR_LEVELS.find((l) => props.sugarValue <= l.max);
  return level ? level.lines[infoStep.value] : "";
});

/* ---------------- HILFSFUNKTIONEN ---------------- */

function stopAllTimers() {
  if (mainTimer) clearTimeout(mainTimer);
  if (reminderTimer) clearTimeout(reminderTimer);
  if (mouthHoldTimer) clearTimeout(mouthHoldTimer);
  mainTimer = null;
  reminderTimer = null;
  mouthHoldTimer = null;
}

/* ---------------- LOGIK ---------------- */

// 1. Intro-Ablauf
function runIntro() {
  stopAllTimers();
  stage.value = "intro";
  mainTimer = setTimeout(() => {
    stage.value = "waiting";
    // Start 5s timer for reminder
    reminderTimer = setTimeout(() => {
      if (stage.value === "waiting") {
        showReminder.value = true;
      }
    }, WAITING_TIMEOUT);
  }, INTRO_DURATION);
}

// 2. Info Sequenz - Jetzt mit Startpunkt-Logik
function startInfoSequence(startIndex: number = 0) {
  stopAllTimers();
  showReminder.value = false;

  // Setze Stage und infoStep entsprechend dem StartIndex
  stage.value = "info";
  infoStep.value = startIndex;
  progressIndex.value = startIndex;

  // Ablauf der Schritte:
  function runStep(step: number) {
    stopAllTimers();
    if (step >= 2) {
      progressIndex.value = 2;
      infoStep.value = -1; // Leert den Text

      mainTimer = setTimeout(() => {
        stage.value = "final";

        mainTimer = setTimeout(() => {
          // Sequenz vorbei -> Check Mundstatus
          checkCompletion();
        }, STEPS_DELAY);
      }, FADE_OUT_DURATION + 50);
    } else {
      infoStep.value = step;
      progressIndex.value = step;

      mainTimer = setTimeout(() => {
        runStep(step + 1);
      }, STEPS_DELAY);
    }
  }

  // Start der Sequenz
  runStep(startIndex);
}

function checkCompletion() {
  stage.value = "completed_check";
  if (props.mouthOpen) {
    emit("sequenceCompleted");
  } else {
    setBack.value = true;
  }
}

/* ---------------- WATCHER ---------------- */

watch(
  () => props.mouthOpen,
  (isOpen) => {
    // 1. Waiting Phase: Mund muss 1 Sekunde offen bleiben
    if (stage.value === "waiting") {
      if (isOpen) {
        if (!mouthHoldTimer) {
          mouthHoldTimer = setTimeout(() => {
            startInfoSequence();
          }, MOUTH_HOLD_DURATION);
        }
      } else {
        if (mouthHoldTimer) {
          clearTimeout(mouthHoldTimer);
          mouthHoldTimer = null;
        }
      }
      return;
    }

    // 2. Completed Check Phase: Mund muss offen sein zum Beenden
    if (stage.value === "completed_check") {
      if (isOpen) {
        setBack.value = false;
        emit("sequenceCompleted");
      } else {
        setBack.value = true;
      }
    }
  }
);

// Steuert die permanente Deaktivierung der Warnfunktion
watch(
  () => props.releaseWarning,
  (newVal) => {
    if (newVal === false) {
      // Wenn der externe Schalter auf FALSE geht, wird JEDE aktive setBack Warnung entfernt
      setBack.value = false;

      // Wenn wir uns im Wartestatus befinden, stoppen wir den Reminder, da die Warnung unnötig ist
      if (stage.value === "waiting") {
        if (reminderTimer) clearTimeout(reminderTimer);
        showReminder.value = false;
      }
    }
  }
);

// Initialer Start
runIntro();

onUnmounted(() => {
  stopAllTimers();
});
</script>

<style scoped>
.center-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  padding-bottom: 10vh;
  height: 100vh;
  width: 100vw;
  text-align: center;
  background: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.9) 0%,
    rgba(0, 0, 0, 0) 50%
  );
}

h1 {
  font-size: 32px;
  max-width: 800px;
  color: white;
  line-height: 1.2;
}
h2 {
  font-size: 24px;
  max-width: 800px;
  color: white;
  line-height: 1.2;
}

.fade-enter-active {
  transition: opacity 1s ease-out, transform 1s cubic-bezier(0.19, 1, 0.22, 1),
    filter 1s ease-out;
}

.fade-leave-active {
  transition: opacity 1s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: scale(2.5);
  filter: blur(10px);
}

.fade-leave-to {
  opacity: 0;
}
</style>
