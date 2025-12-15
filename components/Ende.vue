<template>
  <div v-if="isVisible" class="end-screen-container">
    <!-- NEU: Hintergrund-Container mit Bild und Effekten -->
    <div class="background-container">
      <img src="/parallax/Innenraum.png" class="background-image" alt="Hintergrund"/>
      <div class="blur-vignette"></div>
      <div class="vignette"></div>
    </div>

    <audio ref="whooshSound" src="/sound/whoosh.mp3"></audio>
    <!-- Der animierte Text -->
    <!-- KORREKTUR: Nur noch eine Textebene -->
    <p ref="endText" class="end-text" v-html="displayText"></p>
    <!-- KORREKTUR: Buttons sind jetzt getrennt für eine präzisere Positionierung -->
    <!-- "Retry shopping" Button -->
    <button v-if="showButtons" class="retry-button" :style="{ '--contour-color-rgb': contourColorRGB }">
      Retry shopping
    </button>

    <!-- Button zum Öffnen des Pop-ups -->
    <button v-if="showButtons" @click="openTipsPopup" class="tips-button">
      Tips for healthier shopping
      <!-- NEU: Animierter Pfeil -->
      <svg :class="{ 'rotate-arrow': showTipsPopup }" class="arrow-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
      </svg>
    </button>

    <!-- Pop-up für die Tipps -->
    <!-- KORREKTUR: v-show statt v-if für die Animation und ref für das Overlay -->
    <div v-show="showTipsPopup" ref="popupOverlay" class="popup-overlay" @click="closeTipsPopup">
      <!-- KORREKTUR: ref für den Inhalt und @click.stop -->
      <div ref="popupContent" class="popup-content" @click.stop>
        <!-- KORREKTUR: Ruft jetzt closeTipsPopup auf -->
        <button @click="closeTipsPopup" class="close-popup-button">&times;</button>
        <h2>Tips for Less Sugar</h2>
        <ul ref="tipList"> <!-- NEU: Ref für die Liste der Tipps -->
          <li>
            <strong>Read the labels:</strong> Check the "sugars" line in the nutritional information per 100g. Less than 5g is great, over 22.5g is high.
          </li>
          <li>
            <strong>Avoid processed foods:</strong> They often contain hidden sugars with names like glucose, fructose, sucrose, or maltodextrin.
          </li>
          <li>
            <strong>Choose whole foods:</strong> Fruits, vegetables, and whole grains are your best friends.
          </li>
          <li>
            <strong>Drink water:</strong> Avoid sugary drinks like sodas, energy drinks, and even many fruit juices.
          </li>
          <li>
            <strong>Cook at home:</strong> This gives you full control over the ingredients and the amount of sugar.
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, computed } from 'vue';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';

// NEU: Props definieren, um den Zuckerwert von außen zu erhalten
const props = defineProps({
  sugarAmount: {
    type: Number,
    required: true,
    default: 50 // Ein Standardwert für den Fall, dass nichts übergeben wird
  }
});

// NEU: Computed Property, die den Text basierend auf dem Zuckerwert auswählt
const displayText = computed(() => {
  const dailyLimit = 25;
  const percentageOver = Math.round(((props.sugarAmount - dailyLimit) / dailyLimit) * 100);
  
  if (percentageOver <= 0) {
    // Grün: Im Limit oder darunter
    const percentageText = `<span class="percentage-green">${Math.abs(percentageOver)}%</span>`;
    return `You are ${percentageText} under the daily limit of 25g sugar. A perfect score! Well done.`;
  } else {
    if (percentageOver <= 100) { 
      // Gelb: Bis zu 100% über dem Limit
      const percentageText = `<span class="percentage-yellow">${percentageOver}%</span>`;
      return `You have exceeded your daily sugar limit by ${percentageText} with your purchase. This has consequences in the long run. Please try again.`;
    } else { // "high" ist alles darüber
      // Rot: Mehr als 100% über dem Limit
      const percentageText = `<span class="percentage-red">${percentageOver}%</span>`;
      return `You have exceeded your daily sugar limit by ${percentageText} with your purchase. This has serious consequences for your health. Please try again.`;
    }
  }
});

// NEU: Computed Property, die die RGB-Werte für die Konturfarbe liefert
const contourColorRGB = computed(() => {
  const dailyLimit = 25;
  const percentageOver = Math.round(((props.sugarAmount - dailyLimit) / dailyLimit) * 100);

  if (percentageOver <= 0) {
    return '74, 222, 128'; // Grün (rgb für #4ade80)
  } else if (percentageOver <= 100) {
    return '250, 204, 21'; // Gelb (rgb für #facc15)
  } else {
    return '248, 113, 113'; // Rot (rgb für #f87171)
  }
});


const isVisible = ref(true); // Steuert die Sichtbarkeit der gesamten Komponente
const endText = ref<HTMLElement | null>(null); // KORREKTUR: Nur noch ein Text-Ref
const showButtons = ref(false); // KORREKTUR: Steuert beide Buttons
const showTipsPopup = ref(false);
const popupOverlay = ref<HTMLElement | null>(null); // NEU: Ref für das Overlay
const popupContent = ref<HTMLElement | null>(null); // NEU: Ref für den Inhalt
const tipList = ref<HTMLElement | null>(null); // NEU: Ref für die Tipp-Liste
const whooshSound = ref<HTMLAudioElement | null>(null);

onMounted(() => {
  if (!endText.value) return;

  const targetText = endText.value; // KORREKTUR: Das DOM-Element in einer Variable speichern, BEVOR es manipuliert wird.

  // GSAP-Timeline für die Animation
  const tl = gsap.timeline();

  // Den Text-Container sichtbar machen, aber die Wörter darin verstecken
  gsap.set(targetText, { opacity: 1 });
  const split = new SplitText(targetText, { type: 'words' }); // KORREKTUR: Hier die Variable verwenden
  gsap.set(split.words, { opacity: 0, y: 30 });

  // 1. Wörter fliegen nacheinander ein
  tl.to(split.words, {
    opacity: 1,
    y: 0,
    duration: 0.6,
    ease: 'power3.out',
    stagger: 0.1, // Verzögerung zwischen den Wörtern
    onStart: () => {
      // NEU: Sound abspielen, wenn die Animation startet
      if (whooshSound.value) {
        whooshSound.value.currentTime = 0; // Sound zurückspulen
        whooshSound.value.play().catch(e => console.error("Sound konnte nicht abgespielt werden:", e));
      }
    }
  })
  // 3. Text bleibt für 3 Sekunden sichtbar
  .to({}, { // Leeres Ziel, nur um Zeit zu gewinnen
    duration: 3
  })
  // 3. Text wird kleiner und bewegt sich nach oben
  .to(targetText, { // KORREKTUR: Die gespeicherte Variable verwenden, um Typ-Konflikte zu vermeiden.
    y: '-28vh', // KORREKTUR: Endposition ist jetzt etwas tiefer
    scale: 0.8, // Wird kleiner
    duration: 1.5,
    ease: 'power2.inOut',
    onComplete: () => {
      // 4. Buttons einblenden, nachdem der Text oben ist
      // Die Wörter wieder zusammenfügen, um die Button-Positionierung nicht zu stören
      split.revert();
      showButtons.value = true;
    },
  });
});

// KORREKTUR: Funktion zum Öffnen des Pop-ups mit Animation
const openTipsPopup = () => {
  showTipsPopup.value = true;
  if (!popupOverlay.value || !popupContent.value || !tipList.value) return;
  
  // NEU: Initial die Listenelemente verstecken
  gsap.set(tipList.value?.children, { opacity: 0, y: 10 });

  // KORREKTUR: Eine Timeline verwenden, um die Animationen nahtlos zu verketten
  const tl = gsap.timeline();

  tl.to(popupOverlay.value, { opacity: 1, duration: 0.3 })
    // KORREKTUR: .from() zu .fromTo() geändert, um das Wiederöffnen zu ermöglichen.
    .fromTo(popupContent.value, 
      { y: 50, scale: 0.95, opacity: 0 }, // from-Werte
      { y: 0, scale: 1, opacity: 1, duration: 0.4, ease: 'power3.out' }, // to-Werte
      "-=0.2")
    .to(tipList.value.children, { 
      opacity: 1, y: 0, stagger: 0.15, duration: 0.4, ease: 'power2.out' 
    }, "-=0.2"); // Startet die Listen-Animation, während das Modal noch einfliegt

};

// NEU: Funktion zum Schließen des Pop-ups mit Animation
const closeTipsPopup = () => {
  if (!popupOverlay.value || !popupContent.value) return;

  gsap.to(popupContent.value, {
    y: 50,
    scale: 0.95,
    opacity: 0,
    duration: 0.3,
    ease: 'power2.in',
  });

  gsap.to(popupOverlay.value, {
    opacity: 0,
    duration: 0.4,
    delay: 0.1,
    onComplete: () => {
      showTipsPopup.value = false;
    }
  });
};

</script>

<style scoped>
.end-screen-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  /* Die Hintergrundfarbe wird durch das Bild ersetzt */
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 999;
  color: rgba(255, 255, 255, 0.9);
  font-family: sans-serif;
}

/* --- NEU: Stile für den Hintergrund --- */
.background-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  z-index: -1; /* Stellt sicher, dass der Hintergrund hinter allem anderen liegt */
}

.background-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  /* KORREKTUR: Der Blur wird jetzt direkt auf das Bild angewendet und es wird stärker skaliert */
  filter: blur(8px);
  transform: scale(1.2); /* Stärker vergrößern, um die unscharfen Ränder aus dem Bild zu schieben */
}

.vignette {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(ellipse at center, rgba(0,0,0,0) 60%, rgba(0,0,0,0.8) 100%);
  pointer-events: none;
}

.blur-vignette {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  /* Dieser Filter wird nicht mehr benötigt, da der ganze Hintergrund geblurt ist.
     Ich lasse ihn als leeres Overlay, falls du ihn später wieder aktivieren willst. */
  /* backdrop-filter: blur(4px); */
  /* mask-image: radial-gradient(ellipse at center, transparent 40%, black 70%); */
  pointer-events: none;
}
/* --- Ende der Hintergrund-Stile --- */

.end-text {
  font-size: 2rem;
  font-weight: bold;
  text-align: center;
  max-width: 600px;
  text-shadow: 0 0 15px rgba(255, 150, 150, 0.3);
  opacity: 0; /* Startet unsichtbar für GSAP */

  /* KORREKTUR: Performance-Optimierung. Signalisiert dem Browser, die Animation auf der GPU zu beschleunigen. */
  will-change: transform, opacity, filter;
  transform: translateZ(0); /* Erzwingt Hardware-Beschleunigung */
}

/* --- NEU: Stile für die farbliche Hervorhebung der Prozentzahl --- */
:deep(.percentage-green) {
  color: #4ade80; /* Helles Grün */
  font-weight: bold;
  text-shadow: 0 0 8px rgba(74, 222, 128, 0.5);
}

:deep(.percentage-yellow) {
  color: #facc15; /* Helles Gelb */
  font-weight: bold;
  text-shadow: 0 0 8px rgba(250, 204, 21, 0.5);
}

:deep(.percentage-red) {
  color: #f87171; /* Helles Rot */
  font-weight: bold;
  text-shadow: 0 0 8px rgba(248, 113, 113, 0.5);
}
/* --- Ende der neuen Stile --- */

.retry-button,
.tips-button {
  padding: 0.8rem 1.8rem;
  position: absolute; /* KORREKTUR: Beide Buttons werden jetzt absolut positioniert */
  border: 1px solid #7a1426;
  /* NEU: Flexbox für Text und Pfeil */
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border-radius: 8px;
  background-color: #590f1d;
  color: rgba(255, 255, 255, 0.9);
  font-size: 1.1rem;
  cursor: pointer;
  transition: background-color 0.3s, color 0.3s;
  opacity: 0;
  animation: fadeIn 1s ease forwards;
}

.retry-button:hover,
.tips-button:hover {
  background-color: #4a0a16;
  color: white;
}

.retry-button {
  /* KORREKTUR: Exakt in der Mitte positionieren */
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  /* KORREKTUR: Beide Animationen (fadeIn und pulsate-glow) werden kombiniert */
  animation: fadeIn 1s ease forwards, pulsate-contour 2.5s ease-in-out infinite;
}

.tips-button {
  bottom: 2rem; /* KORREKTUR: Unten am Bildschirmrand */
  left: 50%;
  transform: translateX(-50%);
}

/* NEU: Stile für den Pfeil */
.arrow-icon {
  width: 1.5em;
  height: 1.5em;
  fill: currentColor;
  transition: transform 0.3s ease-in-out;
}

/* NEU: Klasse für die Rotation */
.arrow-icon.rotate-arrow {
  transform: rotate(180deg);
}


@keyframes fadeIn {
  to {
    opacity: 1;
  }
}

/* KORREKTUR: Keyframes für eine pulsierende Kontur */
@keyframes pulsate-contour {
  0% {
    box-shadow: 0 0 0 1px rgba(var(--contour-color-rgb), 0.5); /* NEU: Verwendet die CSS-Variable */
  }
  50% {
    box-shadow: 0 0 0 2px rgba(var(--contour-color-rgb), 0.8); /* NEU: Verwendet die CSS-Variable */
  }
  100% {
    box-shadow: 0 0 0 1px rgba(var(--contour-color-rgb), 0.5); /* NEU: Verwendet die CSS-Variable */
  }
}

/* Stile für das Pop-up */
.popup-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  opacity: 0; /* Startet unsichtbar für die Animation */
}

.popup-content { /* KORREKTUR: ref hinzugefügt */
  background-color: #3a0c13; /* KORREKTUR: Angepasste Farbe */
  padding: 2rem 3rem;
  border-radius: 12px;
  border: 1px solid #7a1426; /* KORREKTUR: Angepasste Farbe */
  max-width: 500px;
  width: 90%;
  position: relative;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}

.close-popup-button {
  position: absolute;
  top: 0.2rem; /* KORREKTUR: Feinjustierung für perfekten visuellen Abstand */
  right: 1rem;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  font-size: 2rem;
  cursor: pointer;
}

.popup-content h2 { /* NEU: Visuelle Hervorhebung der Überschrift */
  margin-top: 0;
  color: #ff8a8a; /* Behält die Farbe bei */
  font-size: 1.8rem; /* Größere Schrift */
  text-align: left; /* KORREKTUR: Linksbündig zum Text */
  margin-bottom: 1.5rem; /* Mehr Abstand nach unten */
  text-shadow: 0 0 10px rgba(255, 138, 138, 0.4); /* Leichter Schatten */
  letter-spacing: 0.05em; /* Etwas mehr Buchstabenabstand */
}

.popup-content strong { /* NEU: Visuelle Hervorhebung der Strong-Tags */
  color: #ffc0cb; /* Hellere, auffälligere Farbe */
  font-weight: bold;
  text-shadow: 0 0 5px rgba(255, 192, 203, 0.2);
}

.popup-content ul {
  margin-top: 1rem; /* Abstand zur Überschrift */
  list-style: none;
  padding-left: 0;
}

.popup-content li {
  margin-bottom: 1rem;
  line-height: 1.5;
}
</style>