<template>
  <div @click="startSoundOnFirstInteraction"> <!-- NEU: Klick-Handler für den Sound-Start -->
    <!-- NEU: Persistente Audio-Elemente -->
    <audio ref="primarySound" loop muted></audio>
    <audio ref="secondarySound" loop muted></audio>
    <audio ref="ambientSound" loop muted></audio>
    <audio ref="growSound" src="/sound/grow.mp3" muted></audio>

    <Parallax
      v-if="currentScene === 'liver'"
      :intro-text-prop="computedLiverIntro"
      :main-image-healthy="'/parallax/Leber_Healthy3.png'"
      :main-image-disease="'/parallax/Leber3.png'"
      :text-parts-prop="computedLiverTexts"
      :particle-color-func="getLiverParticleColor"
      :reverse-animation="isSecondPlaythrough"
      :sugar-amount="sugarAmount"
      :grow-sound-ref="growSound"
      @scene-finished="handleSceneFinished"
    />

    <Parallax
      v-if="currentScene === 'heart'"
      :intro-text-prop="computedHeartIntro"
      :main-image-healthy="'/parallax/Herz_Healthy.png'"
      :main-image-disease="'/parallax/Herz_Disease.png'"
      :text-parts-prop="computedHeartTexts"
      :particle-color-func="getHeartParticleColor"
      :apply-heartbeat-animation="true"
      :reverse-animation="isSecondPlaythrough"
      :sugar-amount="sugarAmount"
      :grow-sound-ref="growSound"
      @scene-finished="handleSceneFinished"
    />
    <!-- Hier könnten später weitere Szenen eingefügt werden -->
    <div v-if="currentScene === 'end'">
      <Ende :sugarAmount=sugarAmount />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue';
import Parallax from './Parallax.vue';
import Ende from './Ende.vue';

// NEU: Prop, um den zweiten Durchlauf zu steuern.
const props = defineProps({
  isSecondPlaythrough: {
    type: Boolean,
    default: false,
  },
  // NEU: Prop, um den Zuckerwert vom Spiel zu erhalten.
  sugarAmount: {
    type: Number,
    default: 100, // Standardwert für einen hohen Zuckerkonsum
  }
});

// Steuert, welche Szene gerade aktiv ist. Wir starten mit der Leber.
const currentScene = ref('heart');

// NEU: Refs für die Audio-Elemente
const primarySound = ref<HTMLAudioElement | null>(null);
const secondarySound = ref<HTMLAudioElement | null>(null);
const ambientSound = ref<HTMLAudioElement | null>(null);
const growSound = ref<HTMLAudioElement | null>(null);
let hasInteracted = false;

// KORREKTUR: Typ für die Text-Objekte definieren.
interface TextPart {
  text: string;
  duration: number;
}

// KORREKTUR: Typen für die Sound-Konfiguration definieren, um Typsicherheit zu gewährleisten.
interface SoundConfig {
  src: string;
  volume: number;
}

interface SceneSoundConfig {
  primary: SoundConfig;
  secondary: SoundConfig;
  ambient?: SoundConfig; // Ambient-Sound ist optional.
}

// NEU: Sound-Konfiguration für jede Szene
const sceneSounds: { [key in 'liver' | 'heart']: SceneSoundConfig } = {
  liver: {
    primary: { src: '/sound/organic_background.flac', volume: 0.25 },
    secondary: { src: '/sound/bubbles_background.wav', volume: 0.6 }
  },
  heart: {
    primary: { src: '/sound/heartbeat_single.mp3', volume: 1.0 },
    secondary: { src: '/sound/bubbles_background.wav', volume: 0.6 },
    ambient: { src: '/sound/organic_background.flac', volume: 0.15 }
  }
};

// NEU: Funktion zum Abspielen der Sounds für die aktuelle Szene
const playSceneSounds = (sceneName: 'liver' | 'heart') => {
  if (!hasInteracted || !primarySound.value || !secondarySound.value || !ambientSound.value) return;

  const sounds = sceneSounds[sceneName];
  const origin = window.location.origin;

  // Primär-Sound (Herzschlag oder Organ-Sound)
  if (sounds.primary) {
    if (primarySound.value.src !== origin + sounds.primary.src) {
      primarySound.value.src = sounds.primary.src;
      primarySound.value.load();
    }
    primarySound.value.volume = sounds.primary.volume;
    primarySound.value.play().catch((e: any) => console.warn("Primär-Sound konnte nicht abgespielt werden:", e));
  } else {
    primarySound.value.pause();
  }

  // Sekundär-Sound (Blubbern)
  if (sounds.secondary) {
    if (secondarySound.value.src !== origin + sounds.secondary.src) {
      secondarySound.value.src = sounds.secondary.src;
      secondarySound.value.load();
    }
    secondarySound.value.volume = sounds.secondary.volume;
    secondarySound.value.play().catch((e: any) => console.warn("Sekundär-Sound konnte nicht abgespielt werden:", e));
  } else {
    secondarySound.value.pause();
  }

  // Ambient-Sound (nur für Herz-Szene)
  if (sounds.ambient) {
    if (ambientSound.value.src !== origin + sounds.ambient.src) {
      ambientSound.value.src = sounds.ambient.src;
      ambientSound.value.load();
    }
    ambientSound.value.volume = sounds.ambient.volume;
    ambientSound.value.play().catch((e: any) => console.warn("Ambient-Sound konnte nicht abgespielt werden:", e));
  } else {
    // Wenn für die Szene kein Ambient-Sound definiert ist, pausiere ihn.
    ambientSound.value.pause();
  }
};

// --- Texte für den ersten Durchlauf ---

const liverTextsHealthy: TextPart[] = [
  { text: "Your liver is in great shape.", duration: 4 },
  { text: "A low sugar intake helps it to function optimally and prevent disease.", duration: 6 },
];
const liverTextsMedium: TextPart[] = [
  { text: "Your sugar consumption is slightly elevated.", duration: 4 },
  { text: "This can lead to the storage of fat in the liver over time, increasing health risks.", duration: 6 },
];
const liverTextsUnhealthy: TextPart[] = [
  { text: "Around 25% of adults have a liver stuffed with fat—mostly thanks to sugar!", duration: 4 },
  { text: "Feed it too much sugar and it swells up, flirting with serious trouble like cirrhosis.", duration: 7 },
];

const heartTextsHealthy: TextPart[] = [
    { text: "Your heart is strong and healthy. Excellent!", duration: 4 },
    { text: "Maintaining a low-sugar diet protects your blood vessels and keeps your heart healthy.", duration: 6 },
];
const heartTextsMedium: TextPart[] = [
    { text: "Elevated sugar levels can increase risk factors for heart disease.", duration: 4 },
    { text: "This includes high blood pressure and inflammation. Consider healthier alternatives.", duration: 6 },
];
const heartTextsUnhealthy: TextPart[] = [
  { text: "But don’t worry… too much sugar will take care of that.", duration: 5 },
  { text: "Every extra spoon of sugar makes your heart work overtime,<br>thickens its walls, fattens it up, and clogs its vessels—turning it into a stiff,<br>sluggish pump that’s always behind.", duration: 7 },
];

// --- Texte für den zweiten, "umgekehrten" Durchlauf ---

const liverTextsReversed: TextPart[] = [
  { text: "Your liver has recovered. Well done!", duration: 4 },
  { text: "By reducing your sugar intake, you have successfully reversed the damage.", duration: 6 },
  { text: "A healthy liver is crucial for your overall well-being and a long life.", duration: 8 }
];

const heartTextsReversed: TextPart[] = [
  { text: "Your heart is getting stronger.", duration: 4 },
  { text: "Lower sugar intake reduces blood pressure and inflammation, protecting you from heart disease.", duration: 7 },
  { text: "You have taken a big step towards a healthier heart and a longer life.", duration: 8 }
];

// NEU: Computed Properties zur Auswahl der richtigen Texte und Titel basierend auf dem Zuckerwert.
const healthState = computed(() => {
    const dailyLimit = 25;
    if (props.sugarAmount <= dailyLimit) return 'healthy';
    const percentageOver = ((props.sugarAmount - dailyLimit) / dailyLimit);
    if (percentageOver <= 1) return 'medium'; // Bis zu 100% über dem Limit (50g gesamt)
    return 'unhealthy';
});

const computedLiverTexts = computed(() => {
    if (props.isSecondPlaythrough) return liverTextsReversed;
    if (healthState.value === 'healthy') return liverTextsHealthy;
    if (healthState.value === 'medium') return liverTextsMedium;
    return liverTextsUnhealthy;
});

const computedHeartTexts = computed(() => {
    if (props.isSecondPlaythrough) return heartTextsReversed;
    if (healthState.value === 'healthy') return heartTextsHealthy;
    if (healthState.value === 'medium') return heartTextsMedium;
    return heartTextsUnhealthy;
});

const computedLiverIntro = computed(() => {
    if (props.isSecondPlaythrough) return 'Your liver is recovering.';
    if (healthState.value === 'healthy') return 'This is your healthy liver.';
    if (healthState.value === 'medium') return 'This is your liver.';
    return 'Check out your liver:<br>lean, mean, and ready<br>to clean up your mess!';
});

const computedHeartIntro = computed(() => {
    if (props.isSecondPlaythrough) return 'Your heart is recovering.';
    if (healthState.value === 'healthy') return 'This is your healthy heart.';
    if (healthState.value === 'medium') return 'This is your heart.';
    return 'Oh look, your heart.<br>Still holding it together.';
});

// Die Funktion zur Erzeugung der Partikelfarben, spezifisch für die Leber-Szene.
const getLiverParticleColor = (): string => {
  // Erzeugt sehr dunkle, entsättigte Rottöne, genau wie im Original.
  const red = Math.floor(Math.random() * 40 + 20); // Bereich: 20-59
  const green = Math.floor(Math.random() * 10);    // Bereich: 0-9
  const blue = Math.floor(Math.random() * 10);     // Bereich: 0-9
  return `rgb(${red}, ${green}, ${blue})`;
};

// NEU: Funktion zur Erzeugung der Partikelfarben für die Herz-Szene.
const getHeartParticleColor = (): string => {
  // Erzeugt sehr dunkle, entsättigte Rottöne, genau wie im Original.
  const red = Math.floor(Math.random() * 40 + 20); // Bereich: 20-59
  const green = Math.floor(Math.random() * 10);    // Bereich: 0-9
  const blue = Math.floor(Math.random() * 10);     // Bereich: 0-9
  return `rgb(${red}, ${green}, ${blue})`;
};

// NEU: Startet die Sounds bei der ersten Benutzerinteraktion
const startSoundOnFirstInteraction = () => {
  if (hasInteracted || !primarySound.value || !secondarySound.value || !ambientSound.value || !growSound.value) return;
  hasInteracted = true;
  primarySound.value.muted = false;
  secondarySound.value.muted = false;
  ambientSound.value.muted = false;
  growSound.value.muted = false;
  playSceneSounds(currentScene.value as 'liver' | 'heart');
};

// NEU: Watcher, der die Sounds beim Szenenwechsel aktualisiert
watch(currentScene, (newScene: string) => {
  if (newScene === 'liver' || newScene === 'heart') {
    playSceneSounds(newScene as 'liver' | 'heart');
  } else if (primarySound.value && secondarySound.value && ambientSound.value) {
    primarySound.value.pause();
    secondarySound.value.pause();
    ambientSound.value.pause();
  }
});

/**
 * Diese Funktion wird aufgerufen, wenn eine Parallax-Szene ihr 'scene-finished'-Event auslöst.
 * Sie schaltet zur nächsten Szene um.
 */
const handleSceneFinished = () => {
  if (currentScene.value === 'heart') {
    // Nach der Leber-Szene kommt die Herz-Szene.
    currentScene.value = 'liver';
  } else if (currentScene.value === 'liver') {
    // Nach der Herz-Szene kommt das Ende.
    currentScene.value = 'end';
  }
};

// NEU: Beim ersten Laden der Komponente die Sounds für die Startszene vorbereiten
onMounted(() => {
  if (currentScene.value === 'liver' || currentScene.value === 'heart')
  playSceneSounds(currentScene.value as 'liver' | 'heart');
});
</script>

<style scoped>
/* Stile, die nur für die Story-Komponente gelten, falls benötigt. */
</style>