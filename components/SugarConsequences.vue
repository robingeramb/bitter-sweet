<template>
  <div class="center-container z-50 fixed pointer-events-none">
    <!-- Hintergrund-Vignette separat animiert -->
    <transition name="fade" appear>
      <div v-if="showBackground" class="background-wrapper">
        <div class="blur-vignette"></div>
        <div class="vignette"></div>
      </div>
    </transition>
    <transition name="fade" mode="out-in" appear>
      <div :key="currentStep" v-if="stage === 'intro'">
        <h1>
          <span
            v-for="(word, index) in getWords('Open your mouth and face what sugar’s done.')"
            :key="index"
            class="word"
            :style="{ animationDelay: `${index * currentWordDelay}s` }"
          >{{ word }}&nbsp;</span>
        </h1>
      </div>

      <h1 v-else-if="setBack" :key="'warning'">
        <span
          v-for="(word, index) in getWords('Open your mouth to see the consequences inside.')"
          :key="index"
          class="word"
          :style="{ animationDelay: `${index * currentWordDelay}s` }"
        >{{ word }}&nbsp;</span>
      </h1>

      <h1 v-else-if="stage === 'waiting' && showReminder" :key="'remind'">
        <span
          v-for="(word, index) in getWords('I know it\'s easier to ignore it. But that\'s not the way to go. Open up.')"
          :key="index"
          class="word"
          :style="{ animationDelay: `${index * currentWordDelay}s` }"
        >{{ word }}&nbsp;</span>
      </h1>

      <h2
        v-else-if="stage === 'info' || stage === 'final'"
        :key="stage === 'final' ? 'final' : infoStep"
      >
        <span
          v-for="(word, index) in getWords(currentDisplayText)"
          :key="index"
          class="word"
          :style="{ animationDelay: `${index * currentWordDelay}s` }"
        >{{ word }}&nbsp;</span>
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
const WAITING_TIMEOUT = 5000;
const MOUTH_HOLD_DURATION = 1000;
const TRANSITION_DURATION = 500; // Entspricht der CSS-Transition-Dauer (0.5s)
const FADE_OUT_DURATION = 500; // Angepasst an CSS

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
  "intro" | "waiting" | "info" | "final" | "completed" | "completed_check" | ""
>("");
const currentStep = ref(3);
const infoStep = ref(0);
const progressIndex = ref(0);
const showReminder = ref(false);
const setBack = ref(false);
const showBackground = ref(true); // Steuert die Sichtbarkeit des Hintergrunds
const isFinishing = ref(false); // Verhindert mehrfaches Auslösen des Endes
const currentAudio = ref<HTMLAudioElement | null>(null);
const currentWordDelay = ref(0.05);

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

function getWords(text: string) {
  return text ? text.split(" ") : [];
}

function stopAudio() {
  if (currentAudio.value) {
    currentAudio.value.pause();
    currentAudio.value.currentTime = 0;
    currentAudio.value = null;
  }
}

function playAudio(source: string | HTMLAudioElement): Promise<void> {
  stopAudio();
  return new Promise((resolve) => {
    let audio: HTMLAudioElement;
    if (typeof source === 'string') {
      audio = new Audio(`/voices/${source}.mp3`);
      // Fallback delay if not prepared
      currentWordDelay.value = 0.05;
    } else {
      audio = source;
    }
    currentAudio.value = audio;
    audio.onended = () => {
      currentAudio.value = null;
      resolve();
    };
    audio.onerror = () => {
      console.warn(`Audio ${typeof source === 'string' ? source : audio.src} not found or error.`);
      currentAudio.value = null;
      resolve(); // Trotzdem fortfahren, damit der Text nicht hängen bleibt
    };
    audio.play().catch(() => resolve());
  });
}

async function prepareAudio(filename: string, text: string): Promise<HTMLAudioElement> {
  const audio = new Audio(`/voices/${filename}.mp3`);
  await new Promise<void>((resolve) => {
    audio.onloadedmetadata = () => resolve();
    audio.onerror = () => resolve();
    // Fallback timeout
    setTimeout(resolve, 1000);
  });

  if (audio.duration && Number.isFinite(audio.duration)) {
    const wordCount = getWords(text).length;
    if (wordCount > 1) {
       // Text soll etwas schneller sein als Audio (z.B. 90% der Dauer)
       const calculatedDelay = (audio.duration * 0.9 - 0.5) / (wordCount - 1);
       currentWordDelay.value = Math.max(0.05, calculatedDelay);
    } else {
       currentWordDelay.value = 0.5;
    }
  } else {
    currentWordDelay.value = 0.05;
  }
  return audio;
}

function stopAllTimers() {
  if (mainTimer) clearTimeout(mainTimer);
  if (reminderTimer) clearTimeout(reminderTimer);
  if (mouthHoldTimer) clearTimeout(mouthHoldTimer);
  mainTimer = null;
  reminderTimer = null;
  mouthHoldTimer = null;
  stopAudio();
}

/* ---------------- LOGIK ---------------- */

// 1. Intro-Ablauf
async function runIntro() {
  stopAllTimers();
  
  const text = "Open your mouth and face what sugar’s done.";
  const audio = await prepareAudio("kasse_intro", text);
  
  stage.value = "intro";

  await playAudio(audio);

  // Wenn die Komponente inzwischen verlassen wurde, abbrechen
  if (stage.value !== "intro") return;

  stage.value = "waiting";
  // Wenn der Mund bereits offen ist, starten wir den Timer sofort, da der Watcher nur auf Änderungen reagiert
  if (props.mouthOpen) {
    if (!mouthHoldTimer) {
      mouthHoldTimer = setTimeout(() => {
        startInfoSequence();
      }, MOUTH_HOLD_DURATION);
    }
  }
  // Start 5s timer for reminder
  reminderTimer = setTimeout(() => {
    if (stage.value === "waiting") {
      const remindText = "I know it's easier to ignore it. But that's not the way to go. Open up.";
      prepareAudio("kasse_warning", remindText).then(audio => {
        showReminder.value = true;
        playAudio(audio);
      });
    }
  }, WAITING_TIMEOUT);
}

// 2. Info Sequenz - Jetzt mit Startpunkt-Logik
function startInfoSequence(startIndex: number = 0) {
  stopAllTimers(); // Stoppt auch Reminder-Audio falls es läuft
  showReminder.value = false;

  // Setze Stage und infoStep entsprechend dem StartIndex
  stage.value = "info";
  infoStep.value = startIndex;
  progressIndex.value = startIndex;

  // Bestimme das Level für die Dateinamen
  const level = SUGAR_LEVELS.find((l) => props.sugarValue <= l.max);
  const maxVal = level ? (level.max === Infinity ? 'Infinity' : level.max) : '25';

  // Ablauf der Schritte:
  async function runStep(step: number) {
    // stopAllTimers() hier NICHT aufrufen, da es das Audio stoppen würde

    if (step >= 2) {
      progressIndex.value = 2;
      infoStep.value = -1; // Leert den Text

      // Kurze Pause für Fade-Out
      await new Promise(resolve => setTimeout(resolve, FADE_OUT_DURATION + 50));
      
      const finalText = "So, now we take a deep dive into your body to see the other consequences";
      const audio = await prepareAudio("kasse_final", finalText);
      
      stage.value = "final";

      await playAudio(audio);

      if (stage.value !== "final") return;

      // Sequenz vorbei -> Check Mundstatus
      checkCompletion();

    } else {
      // Audio vorbereiten
      const filename = `kasse_max${maxVal}_${step + 1}`;
      const level = SUGAR_LEVELS.find((l) => props.sugarValue <= l.max);
      const text = level ? level.lines[step] : "";
      const audio = await prepareAudio(filename, text);

      infoStep.value = step;
      progressIndex.value = step;

      // Warten: Alter Text fadet aus (0.5s)
      await new Promise((resolve) => setTimeout(resolve, TRANSITION_DURATION));

      await playAudio(audio);

      if (stage.value !== 'info') return; // Sicherheitscheck

      runStep(step + 1);
    }
  }

  // Start der Sequenz
  runStep(startIndex);
}

function checkCompletion() {
  stage.value = "completed_check";
  if (props.mouthOpen) {
    finishSequence();
  } else {
    const text = "Open your mouth to see the consequences inside.";
    prepareAudio("kasse_ende", text).then(audio => {
        setBack.value = true;
        setTimeout(() => {
          playAudio(audio);
        }, TRANSITION_DURATION);
    });
  }
}

function finishSequence() {
  if (isFinishing.value) return;
  isFinishing.value = true;
  showBackground.value = false; // Hintergrund ausblenden
  // Warten bis die Animation (1s) fertig ist, dann emitten
  setTimeout(() => {
    emit("sequenceCompleted");
  }, 500);
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
        stopAudio(); // Warnung stoppen
        finishSequence();
      } else {
        // Nur Warnung zeigen, wenn wir nicht schon beim Beenden sind
        if (!isFinishing.value) {
          setBack.value = true;
          // Optional: Audio hier nochmal abspielen? Vorerst nur beim ersten Mal in checkCompletion.
        }
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
}

h1 {
  font-size: 26px;
  max-width: 800px;
  color: white;
  line-height: 1.2;
}
h2 {
  font-size: 20px;
  max-width: 800px;
  color: white;
  line-height: 1.2;
}

.fade-enter-active {
  transition: opacity 0.5s ease-out;
}

.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from {
  opacity: 0;
}

.fade-leave-to {
  opacity: 0;
}

.word {
  display: inline-block;
  opacity: 0;
  animation: wordFadeIn 0.5s forwards;
}

@keyframes wordFadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

.background-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: -1; /* Hinter dem Text */
  pointer-events: none;
}

.vignette {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0) 40%, rgba(0, 0, 0, 0.8) 100%);
}

.blur-vignette {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  backdrop-filter: blur(4px);
  mask-image: radial-gradient(ellipse at center, transparent 30%, black 80%);
}
</style>
