<template>
  <div v-if="isSceneActive"> <!-- NEU: Wrapper-Div hinzugefügt -->
    <!-- NEU: Hintergrundsound für die Atmosphäre -->
    <audio ref="backgroundSound" src="/sound/organic_background.flac" loop muted></audio>
    <audio ref="bubblesSound" src="/sound/bubbles_background.wav" loop muted></audio>

    <!-- NEU: Intro-Overlay für den Startbildschirm (außerhalb des Parallax-Containers) -->
    <div ref="introOverlay" class="intro-overlay">
      <h1 ref="introText" class="intro-text">This is your liver.</h1>
    </div>

    <div class="parallax-container" :style="containerStyle">
    <!-- NEU: SVG-Filter für den turbulenten Hintergrundeffekt -->
    <svg style="display: none">
      <defs>
        <filter id="turbulence-filter" x="-20%" y="-20%" width="140%" height="140%">
          <!-- Erzeugt ein animiertes Rauschen für den Verschiebungseffekt -->
          <feTurbulence ref="turbulence" type="fractalNoise" baseFrequency="0.01 0.02" numOctaves="1" result="turbulence" />
          <!-- Verschiebt die Pixel des Bildes basierend auf dem Rauschen -->
          <feDisplacementMap in="SourceGraphic" in2="turbulence" scale="30" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>

    <!-- NEU: Vordere rotierende Lichtstrahlen -->
    <div class="light-rays-foreground" :style="foregroundRaysStyle"></div>

    <!-- Hintergrundbild (ganz hinten) -->
    <img
      src="/parallax/Innenraum.png"
      class="parallax-layer background-image"
      alt="Hintergrund"
      :style="{ transform: getLayerStyle(0.1).transform + ' scale(1.5)' }"
    />

    <!-- Partikel im Hintergrund -->
    <div
      v-for="(particle, index) in backgroundParticles"
      :key="index"
      class="parallax-layer particle"
      :style="{
        ...getLayerStyle(particle.depth),
        top: `${particle.y}%`,
        left: `${particle.x}%`,
        width: `${particle.size}px`,
        height: `${particle.size}px`,
        backgroundColor: particle.color,
        filter: `blur(${particle.blur}px)`,
      }"
    ></div>

    <!-- NEU: Hintere rotierende Lichtstrahlen -->
    <div
      class="light-rays-background"
      :style="backgroundRaysStyle"
    >
    </div>

    <!-- NEU: Staubpartikel -->
    <div
      v-for="(particle, index) in dustParticles"
      :key="'dust-' + index"
      class="parallax-layer particle"
      :style="{
        ...getLayerStyle(particle.depth),
        top: `${particle.y}%`,
        left: `${particle.x}%`,
        width: `${particle.size}px`,
        height: `${particle.size}px`,
        backgroundColor: particle.color,
        zIndex: 12, /* NEU: Über alles legen */
      }"
    ></div>

    <!-- NEU: Gesunde Leber (wird überblendet) -->
    <img
      src="/parallax/Leber_Healthy3.png"
      class="parallax-layer foreground"
      :style="getForegroundStyle(1)"
      alt="Gesunde Leber"
    />

    <!-- Vordergrundbild (im Fokus) -->
    <img ref="unhealthyLiver"
      src="/parallax/Leber3.png"
      class="parallax-layer foreground unhealthy-liver"
      :style="getForegroundStyle(1)"
      alt="Kranke Leber"
    />

    <!-- NEU: Text-Ebene mit GSAP-Animation -->
    <div class="parallax-layer text-container">
      <p ref="textElement" class="text-content">
        <!-- Der Text wird hier durch GSAP eingefügt -->
      </p>
    </div>

    <!-- NEU: Hintergrund für den Text und Blur-Vignette -->
    <div ref="textBackdrop" class="text-backdrop"></div>
    <div ref="textBlurVignette" class="text-blur-vignette"></div>

    <!-- Partikel im Vordergrund -->
    <div
      v-for="(particle, index) in foregroundParticles"
      :key="'fg-' + index"
      class="parallax-layer particle"
      :style="{
        ...getLayerStyle(particle.depth),
        top: `${particle.y}%`,
        left: `${particle.x}%`,
        width: `${particle.size}px`,
        height: `${particle.size}px`,
        backgroundColor: particle.color,
        filter: `blur(${particle.blur}px)`,
        zIndex: 2,
      }"
    />

    <!-- Vignetten-Overlays -->
    <div class="bottom-gradient"></div>
    <div class="blur-vignette"></div>
    <div class="vignette"></div>
    </div>

    <!-- NEU: "Next"-Button -->
    <button v-if="showNextButton" @click="handleNextClick" class="next-button">
      Next
    </button>

    <!-- NEU: Fade-Out-Overlay -->
    <div ref="fadeOutOverlay" class="fade-out-overlay"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from "vue";
import gsap from "gsap";

const emit = defineEmits(['scene-finished']);

interface Particle {
  initialX: number;
  initialY: number;
  x: number;
  y: number;
  depth: number;
  size: number;
  color: string;
  blur: number;
  amplitude: number;
  speed: number;
  offsetX: number;
  offsetY: number;
}

// NEU: Array für die Textteile
const textParts = ref([
  "25% of all adults suffer from non-alcoholic fatty liver disease.",
  "At 45g per day, the risk of developing fatty liver disease increases by approximately 25%.",
  "Fatty liver disease can lead to inflammation, liver fibrosis, cirrhosis, or even liver cancer.<br>It also increases the risk of cardiovascular disease<br>and can shorten life expectancy in the long term."
]);

const textElement = ref<HTMLElement | null>(null);
const turbulence = ref<SVGElement | null>(null); // NEU: Referenz für das Turbulenz-Element
const introOverlay = ref<HTMLElement | null>(null); // NEU: Referenz für das Intro-Overlay
const introText = ref<HTMLElement | null>(null); // NEU: Referenz für den Intro-Text
const textBackdrop = ref<HTMLElement | null>(null); // NEU: Referenz für den Texthintergrund
const backgroundSound = ref<HTMLAudioElement | null>(null); // Referenz für den organischen Sound
const bubblesSound = ref<HTMLAudioElement | null>(null); // NEU: Referenz für den Bubbles-Sound
const unhealthyLiver = ref<HTMLImageElement | null>(null); // NEU: Referenz für die kranke Leber
const textBlurVignette = ref<HTMLElement | null>(null); // NEU: Referenz für die Text-Vignette
let currentTextIndex = 0;
const showNextButton = ref(false); // NEU: Steuert die Sichtbarkeit des "Next"-Buttons
const fadeOutOverlay = ref<HTMLElement | null>(null); // NEU: Referenz für das Fade-Out-Overlay
const isSceneActive = ref(true); // NEU: Steuert die Sichtbarkeit der gesamten Szene

const mouse = ref({ x: 0, y: 0 });
const targetMouse = ref({ x: 0, y: 0 }); // Zielposition der Maus

// KORREKTUR: Robusterer Mechanismus, der auf die erste Benutzerinteraktion wartet.
const startSoundOnFirstInteraction = () => {
  let soundStarted = false;
  if (backgroundSound.value && backgroundSound.value.paused) {
    backgroundSound.value.muted = false;
    backgroundSound.value.play().catch((error: any) => {
      console.warn("Organischer Sound konnte auch nach Interaktion nicht gestartet werden:", error);
    });
    soundStarted = true;
  }
  // NEU: Versuche, den zweiten Sound zu starten
  if (bubblesSound.value && bubblesSound.value.paused) {
    bubblesSound.value.muted = false;
    bubblesSound.value.play().catch((error: any) => {
      console.warn("Bubbles-Sound konnte auch nach Interaktion nicht gestartet werden:", error);
    });
    soundStarted = true;
  }

  if (soundStarted) {
    // Listener entfernen, nachdem der Sound erfolgreich (oder erfolglos) gestartet wurde,
    // um ihn nicht bei jeder weiteren Interaktion erneut auszuführen.
    window.removeEventListener('click', startSoundOnFirstInteraction);
    window.removeEventListener('keydown', startSoundOnFirstInteraction);
  }
};

const backgroundParticles = ref<Particle[]>([]);
const dustParticles = ref<Particle[]>([]); // NEU: Array für Staubpartikel
const foregroundParticles = ref<Particle[]>([]);
const totalParticleCount = 70;
const dustParticleCount = 200; // NEU: Anzahl der Staubpartikel
const foregroundParticleCount = 5;
const mouseSmoothness = 0.1; // Je kleiner, desto sanfter (0.1 = 10% pro Frame)
let animationFrameId: number;
const perspective = ref(100000); // KORREKTUR: Startwert für den Zoom erhöht (noch weiter weg)
let animationStartTime: number | null = 0; // KORREKTUR: Startzeit initialisieren
const zoomDuration = 4000; // 4 Sekunden Zoom-Animation
let liverAnimationStarted = false; // NEU: Verhindert, dass die Leber-Animation mehrmals startet
const lightRayRotation = ref(0); // NEU: Für die Rotation der Lichtstrahlen
let runMainAnimation = false; // NEU: Steuert, ob die Hauptanimation (Zoom etc.) läuft

const foregroundRaysStyle = computed(() => ({
  transform: `scale(1.2) rotate(${lightRayRotation.value}deg)`,
}));

// NEU: Dynamischer Stil für das Hintergrundbild
const backgroundRaysStyle = computed(() => ({
  transform: `${getLayerStyle(0.4).transform} scale(1.2) rotate(${lightRayRotation.value * 0.8}deg)`,
}));

const containerStyle = computed(() => ({
  // Animiert die Perspektive für einen echten Zoom-Effekt
  perspective: `${perspective.value}px`,
}));

const getRandomDarkRed = (): string => {
  // Sehr dunkle, entsättigte Rottöne
  const red = Math.floor(Math.random() * 40 + 20); // 20-60
  const green = Math.floor(Math.random() * 10); // 0-10 für leichte Entsättigung
  const blue = Math.floor(Math.random() * 10); // 0-10 für leichte Entsättigung
  return `rgb(${red}, ${green}, ${blue})`;
};

// NEU: Funktion für fast schwarze Partikel
const getRandomAlmostBlack = (): string => {
  // KORREKTUR: Erzeugt jetzt ein sehr dunkles Rot anstelle von Grau
  const red = Math.floor(Math.random() * 50 + 100); // R-Wert im Bereich 100-150 (heller)
  const green = Math.floor(Math.random() * 20);     // G-Wert im Bereich 0-20
  const blue = Math.floor(Math.random() * 20);      // B-Wert im Bereich 0-20
  return `rgb(${red}, ${green}, ${blue})`;
};

const getEdgePositions = (): { x: number; y: number } => {
  let x: number;
  let y: number;
  const edgeMargin = 0.3; // Puffer auf 30% erhöht, damit Partikel weiter außerhalb erscheinen

  // Zufällig entscheiden: oben/unten oder links/rechts
  const position = Math.random();

  if (position < 0.5) {
    // Oberer oder unterer Bereich (horizontal durchgehend)
    x = Math.random() * 100;
    if (Math.random() < 0.5) {
      // Oben (teilweise außerhalb)
      y = (Math.random() - 1) * edgeMargin * 100; // -15% bis 0%
    } else {
      // Unten (teilweise außerhalb)
      y = 100 + Math.random() * edgeMargin * 100; // 100% bis 115%
    }
  } else {
    // Linker oder rechter Rand (mit kleinerem vertikalem Range)
    y = Math.random() * 100;
    if (Math.random() < 0.5) {
      // Links (teilweise außerhalb)
      x = (Math.random() - 1) * edgeMargin * 100; // -15% bis 0%
    } else {
      // Rechts (teilweise außerhalb)
      x = 100 + Math.random() * edgeMargin * 100; // 100% bis 115%
    }
  }

  return { x, y };
};

const generateParticles = () => {
  const newBgParticles: Particle[] = [];
  const newFgParticles: Particle[] = [];
  const newDustParticles: Particle[] = []; // NEU
  const backgroundParticleCount = totalParticleCount - foregroundParticleCount;

  for (let i = 0; i < backgroundParticleCount; i++) {
    const depth = Math.random() * 0.9 + 0.1;
    const size = Math.pow(depth, 4) * 80 + 5;
    const blur = Math.pow(depth, 3) * 8; // Blur-Effekt für den Hintergrund weiter reduziert
    const initialX = Math.random() * 100;
    const initialY = Math.random() * 100;

    newBgParticles.push({
      initialX,
      initialY,
      x: initialX,
      y: initialY,
      depth,
      size,
      color: getRandomDarkRed(),
      blur,
      amplitude: Math.random() * 1.5 + 0.5, // Amplitude für den Hintergrund reduziert (0.5-2%)
      speed: Math.random() * 0.3 + 0.1, // Geschwindigkeit verdoppelt
      offsetX: Math.random() * 100,
      offsetY: Math.random() * 100,
    });
  }

  for (let i = 0; i < foregroundParticleCount; i++) {
    const depth = Math.random() * 0.4 + 1.0;
    const size = Math.pow(depth, 4) * 80 + 5;
    const blur = Math.pow(depth, 3) * 12; // Blur-Effekt leicht reduziert
    const positions = getEdgePositions();
    const initialX = positions.x;
    const initialY = positions.y;

    newFgParticles.push({
      initialX,
      initialY,
      x: initialX,
      y: initialY,
      depth,
      size,
      color: getRandomDarkRed(),
      blur,
      amplitude: Math.random() * 5 + 4, // Amplitude für den Vordergrund erhöht (4-9%)
      speed: Math.random() * 1.2 + 1.0, // Geschwindigkeit verdoppelt
      offsetX: Math.random() * 100,
      offsetY: Math.random() * 100,
    });
  }

  // NEU: Staubpartikel generieren
  for (let i = 0; i < dustParticleCount; i++) {
    const depth = Math.random() * 1.5 + 0.1; // Schwirren im gesamten Bereich
    const initialX = Math.random() * 100;
    const initialY = Math.random() * 100;

    newDustParticles.push({
      initialX,
      initialY,
      x: initialX,
      y: initialY,
      depth,
      size: Math.random() * 1.5 + 0.5, // Sehr klein: 0.5px bis 2px
      color: getRandomAlmostBlack(), // Fast schwarz
      blur: 0, // Kein Blur
      amplitude: Math.random() * 3 + 1, // Stärkere, schnellere Bewegung
      speed: Math.random() * 0.8 + 0.4, // Schnellere Geschwindigkeit
      offsetX: Math.random() * 100,
      offsetY: Math.random() * 100,
    });
  }

  backgroundParticles.value = newBgParticles;
  foregroundParticles.value = newFgParticles;
  dustParticles.value = newDustParticles; // NEU
};

const handleMouseMove = (event: MouseEvent) => {
  // Zielposition setzen (nicht direkt die mouse-Position)
  targetMouse.value = {
    x: event.clientX / window.innerWidth - 0.5,
    y: event.clientY / window.innerHeight - 0.5,
  };
};

const getLayerStyle = (depth: number) => {
  const moveX = -mouse.value.x * 100 * depth;
  const moveY = -mouse.value.y * 100 * depth;

  // KORREKTUR: Die Z-Position der Partikel wurde angepasst, um das "Verschwinden" beim Zoomen zu verhindern.
  // Die Partikel werden nun in einem Bereich verteilt, der auch bei starkem Zoom sichtbar bleibt.
  const translateZ = (depth - 1) * 400;

  return {
    transform: `translate3d(${moveX}px, ${moveY}px, ${translateZ}px)`,
  };
};

const getForegroundStyle = (depth: number) => {
  const moveX = -mouse.value.x * 100 * depth;
  const moveY = -mouse.value.y * 100 * depth;
  // 3D-Neigung basierend auf der Mausposition berechnen
  const rotateY = mouse.value.x * 20; // Stärke der Neigung nach links/rechts
  const rotateX = -mouse.value.y * 20; // Stärke der Neigung nach oben/unten

  return {
    // Die rotate-Transformationen wieder hinzufügen
    transform: `translateX(-50%) translateY(-50%) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translate3d(${moveX}px, ${moveY}px, 350px)`, // KORREKTUR: Leber deutlich weiter zurückgesetzt für eine kleinere Endgröße
  };
};

// Animations-Loop mit sanfter Interpolation und Performance-Optimierung
const animateParticles = () => {
  const loop = (time: number) => {
    if (animationStartTime === null) {
      animationStartTime = time;
    }

    // KORREKTUR: Die Maus-Interpolation wird erst gestartet, nachdem die Zoom-Animation abgeschlossen ist,
    // um jegliches Flackern durch frühe Mausbewegungen zu verhindern.
    const elapsedTime = time - (animationStartTime || 0);
    const isZoomFinished = runMainAnimation && elapsedTime >= zoomDuration;

    if (isZoomFinished) {
        mouse.value.x += (targetMouse.value.x - mouse.value.x) * mouseSmoothness;
        mouse.value.y += (targetMouse.value.y - mouse.value.y) * mouseSmoothness;
    }
    // Lichtstrahlen drehen sich jetzt immer, aber die Maus beeinflusst sie erst später.
    const rotationSpeed = 0.02; // Grundgeschwindigkeit der Drehung leicht erhöht
    lightRayRotation.value += rotationSpeed + mouse.value.x * 0.1; // Maus beeinflusst die Drehung

    // KORREKTUR: Hauptanimation (Zoom, Leber, etc.) startet erst, wenn das Intro ausfadet
    if (runMainAnimation) {
      // --- Kamera-Animation: Zoom und Handkamera-Effekt (korrigiert) ---
      const elapsedTime = time - animationStartTime;
      if (elapsedTime < zoomDuration) {
        // 1. Zoom-In Animation am Anfang
        const progress = elapsedTime / zoomDuration;
        const easedProgress = 1 - Math.pow(1 - progress, 4); // KORREKTUR: Stärkeres Ease-Out (Quart)
        // Animiert die Perspektive von 5000px (fern) auf 1200px (nah), was einen Zoom-In-Effekt erzeugt
        perspective.value = 20000 - 18800 * easedProgress; // KORREKTUR: Start-Perspektive noch weiter erhöht
      } else {
        // 2. Handkamera-Effekt nach dem Zoom (angewendet auf die Maus)
        perspective.value = 1200; // Endwert der Perspektive beibehalten
        const shakeIntensity = 0.005;
        const noiseX = (Math.sin(time * 0.00025) + Math.cos(time * 0.00038)) * shakeIntensity;
        const noiseY = (Math.cos(time * 0.0003) + Math.sin(time * 0.00042)) * shakeIntensity;

        mouse.value.x += noiseX;
        mouse.value.y += noiseY;
      }
    }

    // NEU: Turbulenz-Effekt über JavaScript animieren
    const freqX = 0.000001 + Math.sin(time * 0.0001) * 0.00005; // Nochmals deutlich breitere Wellen
    const freqY = 0.025 + Math.cos(time * 0.0002) * 0.01;   // Höhe und Bewegung der Wellen
    turbulence.value?.setAttribute('baseFrequency', `${freqX} ${freqY}`);

    // Schnellerer Zeitfaktor
    const t = time * 0.0005; // Etwas schneller als vorher

    // Update Background Particles - OHNE neue Array-Zuweisung
    const bgParticles = backgroundParticles.value;
    for (let i = 0; i < bgParticles.length; i++) {
        const p = bgParticles[i];
        let newX = p.initialX + Math.sin(t * p.speed + p.offsetX) * p.amplitude;
        let newY = p.initialY + Math.cos(t * p.speed + p.offsetY) * p.amplitude;

        /* --- START: Maus-Verdrängung für Hintergrund-Partikel (kann bei Bedarf entfernt werden) --- */
        const repulsionRadius = 40; // Vergrößerter Radius für eine breitere Interaktion
        const maxRepulsionStrength = 2; // Geringere Stärke als im Vordergrund

        const mouseX = (mouse.value.x + 0.5) * 100;
        const mouseY = (mouse.value.y + 0.5) * 100;

        const dx = newX - mouseX;
        const dy = newY - mouseY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < repulsionRadius) {
            const force = (1 - distance / repulsionRadius) * maxRepulsionStrength * p.depth; // Kraft skaliert mit Tiefe
            const angle = Math.atan2(dy, dx); // Winkel von der Maus zum Partikel
            // Die Grundposition des Partikels dauerhaft verschieben
            p.initialX += Math.cos(angle) * force * 0.1; // 0.1 als Dämpfungsfaktor
            p.initialY += Math.sin(angle) * force * 0.1;
        }

        p.x = newX;
        p.y = newY;

        // NEU: Partikel-Recycling für Standardpartikel
        const buffer = 20; // Puffer auf 20% erhöht
        if (p.x < -buffer) {
            p.initialX += 100 + buffer * 2; p.x += 100 + buffer * 2; // KORREKTUR: Position sofort aktualisieren
        } else if (p.x > 100 + buffer) {
            p.initialX -= 100 + buffer * 2; p.x -= 100 + buffer * 2; // KORREKTUR: Position sofort aktualisieren
        }
        if (p.y < -buffer) {
            p.initialY += 100 + buffer * 2; p.y += 100 + buffer * 2; // KORREKTUR: Position sofort aktualisieren
        } else if (p.y > 100 + buffer) {
            p.initialY -= 100 + buffer * 2; p.y -= 100 + buffer * 2; // KORREKTUR: Position sofort aktualisieren
        }
    }

    // Update Foreground Particles - OHNE neue Array-Zuweisung
    const fgParticles = foregroundParticles.value;
    for (let i = 0; i < fgParticles.length; i++) {
        const p = fgParticles[i];

        // 1. Grundbewegung (Wobble)
        let newX = p.initialX + Math.sin(t * p.speed + p.offsetX) * p.amplitude;
        let newY = p.initialY + Math.cos(t * p.speed + p.offsetY) * p.amplitude;

        // 2. Maus-Verdrängung
        const repulsionRadius = 50; // Deutlich vergrößerter Radius
        const maxRepulsionStrength = 10; // Maximale Verdrängung in Prozent

        const mouseX = (mouse.value.x + 0.5) * 100;
        const mouseY = (mouse.value.y + 0.5) * 100;

        const dx = newX - mouseX;
        const dy = newY - mouseY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < repulsionRadius) {
            const force = (1 - distance / repulsionRadius) * maxRepulsionStrength;
            const angle = Math.atan2(dy, dx); // Winkel von der Maus zum Partikel
            // KORREKTUR: Die Grundposition sanft verschieben, um eine weichere Reaktion zu erzielen.
            p.initialX += Math.cos(angle) * force * 0.05; // Dämpfungsfaktor reduziert
            p.initialY += Math.sin(angle) * force * 0.05; // Dämpfungsfaktor reduziert
        }
        p.x = p.initialX + Math.sin(t * p.speed + p.offsetX) * p.amplitude;
        p.y = p.initialY + Math.cos(t * p.speed + p.offsetY) * p.amplitude;

        // KORREKTUR: Partikel-Recycling für Vordergrundpartikel, um sie an einer neuen Position außerhalb des Bildschirms neu zu starten.
        const buffer = 50; // Puffer von 20 auf 50 erhöht, damit Partikel später despawnen
        if (p.x < -buffer || p.x > 100 + buffer || p.y < -buffer || p.y > 100 + buffer) {
            const newPositions = getEdgePositions();
            p.initialX = newPositions.x;
            p.initialY = newPositions.y;
            p.x = newPositions.x;
            p.y = newPositions.y;
        }
    }

    // NEU: Update Dust Particles
    const dParticles = dustParticles.value;
    for (let i = 0; i < dParticles.length; i++) {
      const p = dParticles[i];
      p.x = p.initialX + Math.sin(t * p.speed + p.offsetX) * p.amplitude;
      p.y = p.initialY + Math.cos(t * p.speed + p.offsetY) * p.amplitude;

      const repulsionRadius = 40;
      const maxRepulsionStrength = 4;

      const mouseX = (mouse.value.x + 0.5) * 100;
      const mouseY = (mouse.value.y + 0.5) * 100;

      const dx = p.x - mouseX;
      const dy = p.y - mouseY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < repulsionRadius) {
        const force = (1 - distance / repulsionRadius) * maxRepulsionStrength;
        const angle = Math.atan2(dy, dx);
        p.initialX += Math.cos(angle) * force * 0.1;
        p.initialY += Math.sin(angle) * force * 0.1;
      }

      // NEU: Partikel-Recycling, wenn sie den Bildschirm verlassen
      const buffer = 15; // Puffer auf 15% erhöht
      if (p.x < -buffer || p.x > 100 + buffer || p.y < -buffer || p.y > 100 + buffer) {
        // Anstatt sie auf der gegenüberliegenden Seite zu platzieren,
        // an einer zufälligen neuen Position starten lassen.
        const newX = Math.random() * 100;
        const newY = Math.random() * 100;
        p.initialX = newX; p.x = newX; // KORREKTUR: Position sofort aktualisieren
        p.initialY = newY; p.y = newY; // KORREKTUR: Position sofort aktualisieren
      }
    }

    animationFrameId = requestAnimationFrame(loop);
  };
  animationFrameId = requestAnimationFrame(loop);
};

// NEU: GSAP-Animation für den Text
const animateText = () => {
  if (!textElement.value || !textBackdrop.value || !textBlurVignette.value) return;

  // KORREKTUR: Prüfen, ob alle Texte angezeigt wurden
  if (currentTextIndex >= textParts.value.length) {
    // Alle Texte wurden gezeigt, jetzt alles ausblenden
    gsap.to([textBackdrop.value, textBlurVignette.value], {
      opacity: 0,
      duration: 1.5,
      ease: "power2.out",
      onComplete: () => {
        // Nach 1 Sekunde den "Next"-Button einblenden
        gsap.delayedCall(0.5, () => {
          showNextButton.value = true;
        });
      }
    });
    return; // Animation beenden
  }

  const el = textElement.value;
  el.innerHTML = textParts.value[currentTextIndex];
  
  const tl = gsap.timeline({
    onComplete: () => {
      // Zum nächsten Textteil wechseln und die Animation wiederholen
      currentTextIndex++; // KORREKTUR: Index einfach erhöhen statt zu loopen
      // Kurze Pause vor dem Start der nächsten Animation
      gsap.delayedCall(0.2, animateText);
    },
  });

  // KORREKTUR: Hintergrund und Vignette nur beim ersten Text einblenden
  if (currentTextIndex === 0) {
  }

  tl.fromTo(
    el,
    {
      y: "100%", // Startet unterhalb des sichtbaren Bereichs
      scale: 2.5,
      opacity: 0,
      filter: "blur(12px)",
    },
    {
      y: "0%",
      scale: 1,
      opacity: 1,
      filter: "blur(0px)",
      duration: 1.5, // Dauer des Hereinfliegens
      ease: "power3.out",
    }
  )
  // Text für 4 Sekunden sichtbar lassen
  .to(el, { opacity: 1, duration: 4 })
  // Text ausblenden
  .to(el, { opacity: 0, filter: "blur(8px)", y: "-20%", duration: 1, ease: "power2.in" });
};

// NEU: GSAP-Animation für das Intro
const runIntroAnimation = () => {
  if (!introOverlay.value || !introText.value) return;

  const tl = gsap.timeline({
    onComplete: () => {
      // Nach Abschluss des Intros die Hauptanimationen starten
      animateText(); // Nur noch die Text-Animation starten, der Rest startet früher
    },
  });

  // 1. Text fliegt ein
  tl.fromTo(introText.value, 
    { // from
      y: "100%",
      scale: 2.5,
      opacity: 0,
      filter: "blur(12px)",
    },
    { // to
      y: "0%",
      scale: 1,
      opacity: 1,
      filter: "blur(0px)", // KORREKTUR: Text wird am Ende scharf
      duration: 1.5, // Schnelleres Einfliegen
      ease: "power3.out"
  })
  // 2. Text bleibt für 2 Sekunden sichtbar
  .to(introText.value, {
    duration: 0.5,
  })
  // 3. Text und Overlay faden gleichzeitig aus
  .to([introText.value, introOverlay.value], {
    opacity: 0,
    duration: 1.0, // Schnelleres Ausblenden
    ease: "power2.in",
    onStart: () => { // KORREKTUR: Beide onStart-Callbacks zusammengefügt
      gsap.to([textBackdrop.value, textBlurVignette.value], {
        opacity: 1,
        duration: 1.5, // Etwas langsamer als das Intro-Fade, für einen weichen Übergang
        ease: "power2.inOut",
      });
      runMainAnimation = true;
      animationStartTime = performance.now();
      if (unhealthyLiver.value) {
        unhealthyLiver.value.classList.add('is-visible');
      }
    },
    onComplete: () => {
      // Overlay aus dem DOM entfernen oder verstecken, um Interaktionen zu ermöglichen
      if (introOverlay.value) introOverlay.value.style.display = "none";
    }
  });
};

onMounted(() => {
  // KORREKTUR: Partikel generieren und bewegen, aber die Hauptanimation (Zoom etc.) noch nicht starten.
  generateParticles();
  animateParticles();
  // KORREKTUR: Maus-Listener auf das window-Objekt legen, damit er immer aktiv ist.
  window.addEventListener('mousemove', handleMouseMove);

  // KORREKTUR: Versuche, den Sound sofort abzuspielen (wird wahrscheinlich blockiert).
  if (backgroundSound.value) {
    backgroundSound.value.volume = 0.25; // Leise Lautstärke für Atmosphäre
    backgroundSound.value.play().catch((error: any) => {
      console.warn("Organischer Hintergrundsound konnte nicht automatisch gestartet werden:", error);
      // Wenn Autoplay fehlschlägt, fügen wir die Listener hinzu, um auf die erste echte Interaktion zu warten.
      window.addEventListener('click', startSoundOnFirstInteraction);
      window.addEventListener('keydown', startSoundOnFirstInteraction);
    });
  }
  // NEU: Zweiten Sound ebenfalls versuchen zu starten
  if (bubblesSound.value) {
    bubblesSound.value.volume = 0.6; // Etwas andere Lautstärke zur Abmischung
    bubblesSound.value.play().catch((error: any) => {
      console.warn("Bubbles-Hintergrundsound konnte nicht automatisch gestartet werden:", error);
      // Die Listener werden bereits vom ersten Sound hinzugefügt, falls dieser fehlschlägt.
      // Das ist ausreichend, da der Handler dann beide Sounds startet.
    });
  }

  // Starte die Intro-Sequenz
  runIntroAnimation();
});

// NEU: Funktion für den Klick auf den "Next"-Button
const handleNextClick = () => {
  if (!fadeOutOverlay.value) return;

  // Blende den Button aus und fade den Bildschirm zu schwarz
  showNextButton.value = false;
  gsap.to(fadeOutOverlay.value, {
    opacity: 1,
    duration: 2, // Dauer des Ausblendens
    ease: "power2.inOut",
    onComplete: () => {
      isSceneActive.value = false; // Schaltet die gesamte Komponente aus
      emit('scene-finished'); // Informiert die Elternkomponente
    }
  });
};

onBeforeUnmount(() => {
  cancelAnimationFrame(animationFrameId);
  window.removeEventListener('mousemove', handleMouseMove); // Listener wieder entfernen
  // KORREKTUR: Sicherstellen, dass auch die Sound-Listener entfernt werden.
  window.removeEventListener('click', startSoundOnFirstInteraction);
  window.removeEventListener('keydown', startSoundOnFirstInteraction);
});
</script>

<style scoped>
.parallax-container {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: #000;
  transform-style: preserve-3d;
}

.parallax-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transition: transform 0.1s linear;
}

.parallax-layer img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.foreground {
  width: 48%;
  height: auto;
  top: 50%;
  left: 50%; /* Die Positionierung wird jetzt über transform gesteuert */
  z-index: 1;
  filter: drop-shadow(0px 15px 35px rgba(0, 0, 0, 0.6));
}

.background-image {
  /* Stellt sicher, dass das Bild auch bei starkem Zoom nicht unscharf wird */
  image-rendering: -webkit-optimize-contrast;
  image-rendering: crisp-edges;
  /* NEU: Wendet den SVG-Filter für den turbulenten Effekt an */
  filter: url(#turbulence-filter) blur(5px);
}

.text-container {
  display: flex;
  justify-content: center;
  align-items: center; /* KORREKTUR: Vertikal zentrieren */
  /* padding-bottom entfernt */
  pointer-events: none;
  z-index: 11; /* Vor die Vignetten legen */
}

.text-content {
  color: rgba(255, 255, 255, 0.8);
  font-size: 1.5rem; /* Schriftgröße erhöht */
  text-align: center;
  text-shadow: 0 0 15px rgba(0, 0, 0, 0.7);
}

/* NEU: Stile für das Intro-Overlay */
.intro-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: #0a0000; /* KORREKTUR: Noch dunkler */
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 100; /* Ganz oben */
  opacity: 1; /* Startet sichtbar */
}

.intro-text {
  color: rgba(255, 220, 220, 0.8);
  font-size: 4rem;
  font-weight: bold;
  text-shadow: 0 0 20px rgba(255, 100, 100, 0.3);
  opacity: 0; /* Startet unsichtbar für die GSAP-Animation */
}

.vignette {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(ellipse at center, rgba(0,0,0,0) 50%, rgba(0,0,0,0.9) 100%);
  pointer-events: none;
  z-index: 10;
}

.bottom-gradient {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 50%;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.5), transparent);
  pointer-events: none;
  z-index: 10;
}

.blur-vignette {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  backdrop-filter: blur(4px);
  mask-image: radial-gradient(ellipse at center, transparent 40%, black 70%);
  pointer-events: none;
  z-index: 9;
}

/* NEU: Stile für den Texthintergrund und die Vignette */
.text-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5); /* Halbtransparenter schwarzer Hintergrund */
  z-index: 10; /* Unter dem Text, über der Szene */
  opacity: 0; /* Startet unsichtbar */
  pointer-events: none;
}

.text-blur-vignette {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  backdrop-filter: blur(8px); /* Stärkerer Blur-Effekt */
  mask-image: radial-gradient(ellipse at center, transparent 30%, black 60%);
  z-index: 9; /* Unter dem schwarzen Hintergrund */
  opacity: 0; /* Startet unsichtbar */
  pointer-events: none;
}

/* --- NEU: Stile für den "Next"-Button und das Fade-Out --- */
.next-button {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  padding: 0.75rem 1.5rem;
  background-color: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  z-index: 101; /* Über dem Intro-Overlay, falls es noch da ist */
  opacity: 0; /* Startet unsichtbar */
  animation: fadeInButton 1s ease forwards;
  transition: background-color 0.3s, color 0.3s;
}

.next-button:hover {
  background-color: rgba(255, 255, 255, 0.2);
  color: white;
}

@keyframes fadeInButton {
  to {
    opacity: 1;
  }
}


.particle {
  border-radius: 50%;
}

/* --- NEU: Leber-Überblendung --- */
.unhealthy-liver {
  opacity: 0; /* Standardmäßig unsichtbar */
}
@keyframes fadeInLiver {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
.unhealthy-liver.is-visible {
  animation: fadeInLiver 15s ease-in-out forwards;
}
/* --- Rotierende Lichtstrahlen --- */
@keyframes rotate {
  to {
    transform: rotate(1turn);
  }
}

/* Vordere Lichtstrahlen */
.light-rays-foreground {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  mix-blend-mode: multiply; /* NEU: Mischmodus für besseren Lichteffekt */
  z-index: 2; /* Vor der Leber (z-index: 1) */

  /* Rötliche Farben für die Szene */
  --a: rgba(255, 200, 200, 0.03);
  --b: rgba(255, 190, 190, 0.09);
  --c: rgba(255, 200, 200, 0.06);
  --d: rgba(255, 190, 190, 0.07);
}

.light-rays-foreground:before,
.light-rays-foreground:after {
  content: "";
  position: absolute;
  top: -20%;
  left: 50%;
  margin: -100vmax;
  width: 200vmax;
  height: 200vmax;
  opacity: 0.4; /* Intensität reduziert */
}

.light-rays-foreground:before {
  background: conic-gradient(
    var(--a), var(--b), var(--c), var(--d), var(--a), var(--d), var(--a),
    var(--d), var(--b), var(--c), var(--d), var(--a), var(--b) 
  );
}

.light-rays-foreground:after {
  background: conic-gradient(
    var(--c), transparent, var(--c), var(--a), transparent, var(--b),
    var(--c), transparent, var(--c), var(--a) 
  );
}

/* Hintere Lichtstrahlen */
.light-rays-background {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  mix-blend-mode: multiply; /* NEU: Mischmodus für besseren Lichteffekt */
  z-index: 0; /* Hinter der Leber (z-index: 1) */

  /* Leicht andere Rottöne */
  --a-bg: rgba(255, 180, 180, 0.04);
  --b-bg: rgba(255, 170, 170, 0.12);
  --c-bg: rgba(255, 180, 180, 0.07);
  --d-bg: rgba(255, 170, 170, 0.1);
}

.light-rays-background:before,
.light-rays-background:after {
  content: "";
  position: absolute;
  top: -30%; /* Etwas anderer Ursprung für Parallax-Effekt */
  left: 50%;
  margin: -100vmax;
  width: 200vmax;
  height: 200vmax;
  opacity: 0.5; /* Intensität reduziert */
}

.light-rays-background:before {
  background: conic-gradient(
    var(--a-bg), var(--b-bg), var(--c-bg), var(--d-bg), var(--a-bg)
  ); 
}

.light-rays-background:after {
  background: conic-gradient(transparent, var(--b-bg), transparent, var(--c-bg));
}

.fade-out-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: #000;
  opacity: 0;
  pointer-events: none; /* Erlaubt Klicks "durch" das Overlay, solange es unsichtbar ist */
  z-index: 200; /* Ganz oben */
}
</style>