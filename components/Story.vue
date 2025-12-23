<template>
  <div>
    <!-- NEU: Persistente Audio-Elemente -->
    <audio ref="primarySound" loop></audio>
    <audio ref="secondarySound" loop></audio>
    <audio ref="ambientSound" loop></audio>
    <audio ref="growSound" src="/sound/grow.mp3"></audio>

    <Parallax
      v-if="currentScene === 'liver'"
      :intro-text-prop="computedLiverIntro"
      :intro-audio-src="!variablesStore.isSecondPlaythrough ? 'organs_liver_intro' : undefined"
      :main-image-healthy="'/parallax/Leber_Healthy3.png'"
      :main-image-disease="'/parallax/Leber3.png'"
      :text-parts-prop="computedLiverTexts"
      :particle-color-func="getLiverParticleColor"
      :reverse-animation="variablesStore.isSecondPlaythrough"
      :sugar-amount="sugarAmount"
      :grow-sound-ref="growSound"
      @scene-finished="handleSceneFinished"
    />

    <Parallax
      v-if="currentScene === 'heart'"
      :intro-text-prop="computedHeartIntro"
      :intro-audio-src="!variablesStore.isSecondPlaythrough ? 'organs_heart_intro' : undefined"
      :main-image-healthy="'/parallax/Herz_Healthy.png'"
      :main-image-disease="'/parallax/Herz_Disease.png'"
      :text-parts-prop="computedHeartTexts"
      :particle-color-func="getHeartParticleColor"
      :apply-heartbeat-animation="true"
      :reverse-animation="variablesStore.isSecondPlaythrough"
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
import { useVariablesStore } from '~/stores/store';

const variablesStore = useVariablesStore();

const props = defineProps({
  // NEU: Prop, um den Zuckerwert vom Spiel zu erhalten.
  sugarAmount: {
    type: Number,
    default: 80, // Standardwert für einen hohen Zuckerkonsum
  }
});

// Steuert, welche Szene gerade aktiv ist. Wir starten mit der Leber.
const currentScene = ref('heart');

// NEU: Refs für die Audio-Elemente
const primarySound = ref<HTMLAudioElement | null>(null);
const secondarySound = ref<HTMLAudioElement | null>(null);
const ambientSound = ref<HTMLAudioElement | null>(null);
const growSound = ref<HTMLAudioElement | null>(null);

// KORREKTUR: Typ für die Text-Objekte definieren.
interface TextPart {
  text: string;
  audioSrc: string;
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
  if (!primarySound.value || !secondarySound.value || !ambientSound.value) return;

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
  { text: "Your liver is in great shape.", audioSrc: "organs_liver_healthy1" },
  { text: "A low sugar intake helps it to function optimally and prevent disease.", audioSrc: "organs_liver_healthy2" },
];
const liverTextsMedium: TextPart[] = [
  { text: "Your sugar consumption is slightly elevated.", audioSrc: "organs_liver_medium1" },
  { text: "This can lead to the storage of fat in the liver over time, increasing health risks.", audioSrc: "organs_liver_medium2" },
];
const liverTextsUnhealthy: TextPart[] = [
  { text: "Around 25% of adults have a liver stuffed with fat—mostly thanks to sugar!", audioSrc: "organs_liver_unhealthy1" },
  { text: "Feed it too much sugar and it swells up, flirting with serious trouble like cirrhosis.", audioSrc: "organs_liver_unhealthy2" },
];

const heartTextsHealthy: TextPart[] = [
    { text: "Your heart is strong and healthy. Excellent!", audioSrc: "organs_heart_healthy1" },
    { text: "Maintaining a low-sugar diet protects your blood vessels and keeps your heart healthy.", audioSrc: "organs_heart_healthy2" },
];
const heartTextsMedium: TextPart[] = [
    { text: "Elevated sugar levels can increase risk factors for heart disease.", audioSrc: "organs_heart_medium1" },
    { text: "This includes high blood pressure and inflammation. Consider healthier alternatives.", audioSrc: "organs_heart_medium2" },
];
const heartTextsUnhealthy: TextPart[] = [
  { text: "But don’t worry… too much sugar will take care of that.", audioSrc: "organs_heart_unhealthy1" },
  { text: "Every extra spoon of sugar makes your heart work overtime, thickens its walls, fattens it up, and clogs its vessels—turning it into a stiff, sluggish pump that’s always behind.", audioSrc: "organs_heart_unhealthy2" },
];

// --- Texte für den zweiten, "umgekehrten" Durchlauf ---

const liverTextsReversedGood: TextPart[] = [
  { text: "By reducing your sugar intake, you have successfully reversed the damage.", audioSrc: "organs_liver_reversed2" },
  { text: "A healthy liver is crucial for your overall well-being and a long life.", audioSrc: "organs_liver_reversed3" }
];

const heartTextsReversedGood: TextPart[] = [
  { text: "Lower sugar intake reduces blood pressure and inflammation, protecting you from heart disease.", audioSrc: "organs_heart_reversed2" },
  { text: "You have taken a big step towards a healthier heart and a longer life.", audioSrc: "organs_heart_reversed3" }
];

const liverTextsReversedMedium: TextPart[] = [
  { text: "You cut back, but your liver is still storing fat. It's not a warehouse, you know.", audioSrc: "organs_liver_reversed_medium2" },
  { text: "It's slightly better, but 'slightly' doesn't prevent disease. Try harder.", audioSrc: "organs_liver_reversed_medium3" }
];

const heartTextsReversedMedium: TextPart[] = [
  { text: "You reduced the sugar, but the pressure is still there. Your vessels aren't exactly celebrating.", audioSrc: "organs_heart_reversed_medium2" },
  { text: "Don't settle for 'okay'. 'Okay' is just a waiting room for 'bad'.", audioSrc: "organs_heart_reversed_medium3" }
];

const liverTextsReversedBad: TextPart[] = [
  { text: "Your liver is still stuffed with fat, just like before. Did you think it would magically disappear?", audioSrc: "organs_liver_reversed_bad2" },
  { text: "Keep feeding it sugar, and 'cirrhosis' will be more than just a threat. It'll be your reality.", audioSrc: "organs_liver_reversed_bad3" }
];

const heartTextsReversedBad: TextPart[] = [
  { text: "You've changed nothing. Your heart is still working overtime, getting fatter and more clogged with every spoon you didn't skip.", audioSrc: "organs_heart_reversed_bad2" },
  { text: "It's not a question of *if* it will fail, but *when*. Enjoy the sweet ride to the ER.", audioSrc: "organs_heart_reversed_bad3" }
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
    if (variablesStore.isSecondPlaythrough) {
        if (healthState.value === 'healthy') return liverTextsReversedGood;
        if (healthState.value === 'medium') return liverTextsReversedMedium;
        return liverTextsReversedBad;
    }
    if (healthState.value === 'healthy') return liverTextsHealthy;
    if (healthState.value === 'medium') return liverTextsMedium;
    return liverTextsUnhealthy;
});

const computedHeartTexts = computed(() => {
    if (variablesStore.isSecondPlaythrough) {
        if (healthState.value === 'healthy') return heartTextsReversedGood;
        if (healthState.value === 'medium') return heartTextsReversedMedium;
        return heartTextsReversedBad;
    }
    if (healthState.value === 'healthy') return heartTextsHealthy;
    if (healthState.value === 'medium') return heartTextsMedium;
    return heartTextsUnhealthy;
});

const computedLiverIntro = computed(() => {
    if (variablesStore.isSecondPlaythrough) {
        if (healthState.value === 'healthy') return 'Your liver is recovering.';
        if (healthState.value === 'medium') return 'Your liver is trying to heal.';
        return 'Your liver is still suffering. Thanks to you.';
    }
    return 'Your liver — lean, mean, ready to clean.';
});

const computedHeartIntro = computed(() => {
    if (variablesStore.isSecondPlaythrough) {
        if (healthState.value === 'healthy') return 'Your heart is recovering.';
        if (healthState.value === 'medium') return 'Your heart is getting a breather.';
        return 'Your heart is still under siege.';
    }
    return 'Now look.. your heart. Still holding it together.';
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