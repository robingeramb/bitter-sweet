<template>
  <div class="center-container z-50 fixed pointer-events-none">
    <transition name="fade" mode="out-in">
      <div :key="currentStep" v-if="stage === 'intro'">
        <h1 v-if="currentStep === 0">{{ firstText }}</h1>
        <h1 v-else-if="currentStep === 1">Sounds alarming, right?</h1>
        <h1 v-else-if="currentStep === 2">Well, it is.</h1>
        <h1 v-else-if="currentStep === 3">
          Open your mouth to see what already happened to your body...
        </h1>
      </div>

      <h1 v-else-if="setBack" :key="'warning'">
        We are not done yet. Please keep your mouth open.
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
const STEPS_DELAY = 2000;
const REMINDER_DELAY = 3000;
const FADE_OUT_DURATION = 600;
const EMIT_DELAY = 1000; // **NEU: 1 Sekunde Verzögerung für den Emit-Aufruf**

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
const stage = ref<"intro" | "waiting" | "info" | "final" | "completed">(
  "intro"
);
const currentStep = ref(0);
const infoStep = ref(0);
const progressIndex = ref(0);
const showReminder = ref(false);
const setBack = ref(false);

let mainTimer: ReturnType<typeof setTimeout> | null = null;
let reminderTimer: ReturnType<typeof setTimeout> | null = null;

/* ---------------- COMPUTED ---------------- */
const firstText = computed(
  () =>
    `So… you are ${Math.max(
      0,
      Math.round(props.sugarValue - 25)
    )}g above the recommended daily limit.`
);

const currentDisplayText = computed(() => {
  if (stage.value === "final") return "So, let’s see what else happens.";
  const level = SUGAR_LEVELS.find((l) => props.sugarValue <= l.max);
  return level ? level.lines[infoStep.value] : "";
});

/* ---------------- HILFSFUNKTIONEN ---------------- */

function stopAllTimers() {
  if (mainTimer) clearTimeout(mainTimer);
  if (reminderTimer) clearTimeout(reminderTimer);
  mainTimer = null;
  reminderTimer = null;
}

function startReminderTimer() {
  stopReminderTimer();
  reminderTimer = setTimeout(() => {
    if (!props.mouthOpen && stage.value === "waiting") {
      showReminder.value = true;
    }
  }, REMINDER_DELAY);
}

function stopReminderTimer() {
  if (reminderTimer) clearTimeout(reminderTimer);
  reminderTimer = null;
  showReminder.value = false;
}

/* ---------------- LOGIK ---------------- */

// 1. Intro-Ablauf
function runIntro() {
  stopAllTimers();
  mainTimer = setTimeout(() => {
    if (currentStep.value < 3) {
      currentStep.value++;
      runIntro();
    } else {
      stage.value = "waiting";
      if (props.mouthOpen) {
        startInfoSequence();
      } else {
        startReminderTimer();
      }
    }
  }, STEPS_DELAY);
}

// 2. Info Sequenz - Jetzt mit Startpunkt-Logik
function startInfoSequence(startIndex: number = 0) {
  stopAllTimers();

  if (stage.value === "completed" && progressIndex.value === 3) {
    return;
  }

  if (startIndex === 2) {
    stage.value = "final";
    progressIndex.value = 2;
    infoStep.value = 0;

    mainTimer = setTimeout(() => {
      stage.value = "completed";
      progressIndex.value = 3;
      // **NEU: Event-Trigger 1 Sekunde nach Abschluss der Completed-Stage**
      setTimeout(() => {
        emit("sequenceCompleted");
      }, EMIT_DELAY);
    }, STEPS_DELAY);
    return;
  }

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
          stage.value = "completed";
          progressIndex.value = 3;
          // Setze setBack nur setzen, wenn der Mund geschlossen ist
          if (props.releaseWarning && !props.mouthOpen) {
            setBack.value = true;
          }
          // **NEU: Event-Trigger 1 Sekunde nach Abschluss der Completed-Stage**
          setTimeout(() => {
            emit("sequenceCompleted");
          }, EMIT_DELAY);
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

/* ---------------- WATCHER ---------------- */

watch(
  () => props.mouthOpen,
  (isOpen) => {
    // 1. Wenn setBack aktiv ist und Mund öffnet -> Setze fort/Lösche Warnung
    if (setBack.value && isOpen) {
      setBack.value = false; // Warnung entfernen

      // Wenn Sequenz abgeschlossen ist, nur Warnung löschen und nicht neustarten
      if (progressIndex.value < 3) {
        startInfoSequence(progressIndex.value);
      } else {
        stage.value = "completed";
      }
      return;
    }

    // 2. Wenn Info/Final/Completed läuft und Mund schließt -> Aktiviere setBack
    if (
      (stage.value === "info" ||
        stage.value === "final" ||
        stage.value === "completed") &&
      !isOpen
    ) {
      if (props.releaseWarning) {
        stopAllTimers();
        setBack.value = true;
      }
      return;
    }

    // 3. Normaler Wartestatus (nur, wenn setBack nicht aktiv ist)
    if (stage.value === "waiting" && !setBack.value) {
      if (isOpen) {
        startInfoSequence();
      } else {
        startReminderTimer();
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
        stopReminderTimer();
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
  justify-content: center;
  height: 100vh;
  width: 100vw;
  text-align: center;
}

h1 {
  font-size: 50px;
  max-width: 800px;
  color: white;
  line-height: 1.2;
}
h2 {
  font-size: 40px;
  max-width: 800px;
  color: white;
  line-height: 1.2;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.6s ease, transform 0.6s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
