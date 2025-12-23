<template>
  <div v-if="isSceneActive" class="scene-wrapper">
    <!-- NEU: Wrapper-Div hinzugefügt -->

    <!-- NEU: Intro-Overlay für den Startbildschirm (außerhalb des Parallax-Containers) -->
    <div ref="introOverlay" class="intro-overlay">
      <h1 ref="introText" class="intro-text" v-html="introTextProp"></h1>
    </div>

    <!-- NEU: Sound für Zuckerpartikel -->
    <audio ref="sugarSound" src="/sound/sand.mp3" loop></audio>

    <div class="parallax-container" :style="containerStyle">
      <!-- NEU: SVG-Filter für den turbulenten Hintergrundeffekt -->
      <svg style="display: none">
        <defs>
          <filter
            id="turbulence-filter"
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
          >
            <!-- KORREKTUR: Erzeugt deutlich sichtbare, großflächige, weiche Wellen. Die Animation der baseFrequency ist langsam und subtil. -->
            <feTurbulence
              ref="turbulence"
              type="fractalNoise"
              baseFrequency="0.002 0.003"
              numOctaves="1"
              seed="0"
              result="turbulence"
            />
            <!-- KORREKTUR: Das Rauschen wird weichgezeichnet, bevor es für die Verzerrung verwendet wird, um Kanten zu eliminieren. stdDeviation wurde erhöht. -->
            <feGaussianBlur
              in="turbulence"
              stdDeviation="5"
              result="blurredTurbulence"
            />
            <!-- KORREKTUR: Nutzt das weichgezeichnete Rauschen und hat eine erhöhte Stärke (scale), um den Effekt deutlicher zu machen. -->
            <feDisplacementMap
              in="SourceGraphic"
              in2="blurredTurbulence"
              scale="50"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      <!-- NEU: Vordere rotierende Lichtstrahlen -->
      <div class="light-rays-foreground" :style="foregroundRaysStyle"></div>

      <!-- Hintergrundbild (ganz hinten) -->
      <img
        :src="backgroundImage"
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
          transform: getParticleTransform(particle),
          width: `${particle.size}px`,
          height: `${particle.size}px`,
          backgroundColor: particle.color,
          filter: `blur(${particle.blur}px)`,
        }"
      ></div>

      <!-- NEU: Hintere rotierende Lichtstrahlen -->
      <div class="light-rays-background" :style="backgroundRaysStyle"></div>

      <!-- NEU: Staubpartikel -->
      <div
        v-for="(particle, index) in dustParticles"
        :key="'dust-' + index"
        class="parallax-layer particle"
        :style="{
          transform: getParticleTransform(particle),
          width: `${particle.size}px`,
          height: `${particle.size}px`,
          backgroundColor: particle.color,
          zIndex: 12 /* NEU: Über alles legen */,
        }"
      ></div>

      <!-- NEU: Hintergrund-Tönung für ungesunden Zustand (Verschoben für korrekte Überlagerung) -->
      <div ref="backgroundTint" class="background-tint"></div>

      <!-- NEU: Zucker-Partikel (fliegen auf das Organ zu) -->
      <div
        v-for="sp in sugarParticles"
        :key="'sugar-' + sp.id"
        class="parallax-layer particle sugar-particle"
        :style="{
          transform: `translate3d(${sp.x}vw, ${sp.y}vh, 0) rotate(${sp.rotation}deg)`,
          width: `${sp.size}px`,
          height: `${sp.size}px`,
          opacity: sp.opacity,
          zIndex: 15 /* Über dem Organ */,
        }"
      ></div>

      <!-- NEU: Zuckerzähler-Text -->
      <div ref="sugarCounter" class="sugar-counter">
        <span class="sugar-label-text">sugar per day</span>
        <span ref="sugarAmountText" class="sugar-amount-text">0g</span>
      </div>

      <!-- NEU: Gesunde Leber (wird überblendet) -->
      <img
        ref="healthyOrgan"
        :src="mainImageHealthy"
        class="parallax-layer foreground"
        :style="getForegroundStyle(1)"
        alt="Gesundes Organ"
      />

      <!-- Vordergrundbild (im Fokus) -->
      <img
        ref="unhealthyOrgan"
        :src="mainImageDisease"
        class="parallax-layer foreground"
        :style="getForegroundStyle(1)"
        alt="Krankes Organ"
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
          transform: getParticleTransform(particle),
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

      <!-- NEU: Overlay für die Unterwasser-Verzerrung -->
      <div class="underwater-distortion-overlay"></div>
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
import { ref, onMounted, onBeforeUnmount, computed, type PropType } from "vue";
import gsap from "gsap";

// KORREKTUR: Interface für die Text-Objekte, die jetzt auch eine Dauer enthalten.
interface TextPart {
  text: string;
  audioSrc: string;
}

const props = defineProps({
  introTextProp: {
    type: String,
    required: true,
  },
  // NEU: Audio für das Intro
  introAudioSrc: {
    type: String,
    default: undefined,
  },
  mainImageHealthy: {
    type: String,
    required: true,
  },
  mainImageDisease: {
    type: String,
    required: true,
  },
  backgroundImage: {
    type: String,
    default: "/parallax/Innenraum.png",
  },
  textPartsProp: {
    type: Array as PropType<TextPart[]>, // KORREKTUR: Der Typ ist jetzt ein Array von TextPart-Objekten.
    required: true,
  },
  particleColorFunc: {
    type: Function as PropType<() => string>,
    required: true,
  },
  applyHeartbeatAnimation: {
    type: Boolean,
    default: false,
  },
  // NEU: Prop, um die Animationsrichtung umzukehren (ungesund -> gesund).
  reverseAnimation: {
    type: Boolean,
    default: false,
  },
  // NEU: Prop, um den Zuckerwert zu erhalten und die Animation zu steuern.
  sugarAmount: {
    type: Number,
    default: 100, // Standardwert für einen hohen Zuckerkonsum
  },
  // NEU: Prop, um die Referenz auf das zentrale Audio-Element zu erhalten
  growSoundRef: {
    type: Object as PropType<HTMLAudioElement | null>,
    default: null,
  },
});
const emit = defineEmits(["scene-finished"]);

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

// NEU: Interface für Zucker-Partikel
interface SugarParticle {
  id: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  size: number;
  rotation: number;
  opacity: number;
}

const textElement = ref<HTMLElement | null>(null);
const turbulence = ref<SVGElement | null>(null); // KORREKTUR: Ref wieder auf das turbulence-Element
const introOverlay = ref<HTMLElement | null>(null); // NEU: Referenz für das Intro-Overlay
const introText = ref<HTMLElement | null>(null); // NEU: Referenz für den Intro-Text
const textBackdrop = ref<HTMLElement | null>(null); // NEU: Referenz für den Texthintergrund
const healthyOrgan = ref<HTMLImageElement | null>(null); // NEU: Referenz für das gesunde Organ
const unhealthyOrgan = ref<HTMLImageElement | null>(null); // NEU: Referenz für das kranke Organ
const textBlurVignette = ref<HTMLElement | null>(null); // NEU: Referenz für die Text-Vignette
const sugarSound = ref<HTMLAudioElement | null>(null); // NEU: Referenz für den Zucker-Sound
const backgroundTint = ref<HTMLElement | null>(null); // NEU: Referenz für die Hintergrund-Tönung
const sugarCounter = ref<HTMLElement | null>(null); // NEU: Referenz für den Zuckerzähler
const sugarAmountText = ref<HTMLElement | null>(null); // NEU: Referenz für den Zuckerzähler-Text
let currentTextIndex = 0;
const currentVoiceOver = ref<HTMLAudioElement | null>(null); // NEU: Aktuelles Voiceover
const showNextButton = ref(false); // NEU: Steuert die Sichtbarkeit des "Next"-Buttons
const fadeOutOverlay = ref<HTMLElement | null>(null); // NEU: Referenz für das Fade-Out-Overlay
const isSceneActive = ref(true); // NEU: Steuert die Sichtbarkeit der gesamten Szene
const heartbeatScale = ref(1); // KORREKTUR: Vereinfacht für bessere Performance

// NEU: Berechnet die Ziel-Deckkraft für das ungesunde Organ basierend auf dem Zuckerwert.
const targetOpacity = computed(() => {
  const dailyLimit = 25;
  if (props.sugarAmount <= dailyLimit) {
    return 0; // Gesund: keine Einblendung
  }
  // Linearer Anstieg der Opazität: 25g = 0, 50g = 1
  const opacity = (props.sugarAmount - dailyLimit) / dailyLimit;
  return Math.min(opacity, 1); // Begrenzen auf maximal 1 (volle Deckkraft ab 50g)
});

const mouse = ref({ x: 0, y: 0 });
const targetMouse = ref({ x: 0, y: 0 }); // Zielposition der Maus

const backgroundParticles = ref<Particle[]>([]);
const dustParticles = ref<Particle[]>([]); // NEU: Array für Staubpartikel
const foregroundParticles = ref<Particle[]>([]);
const sugarParticles = ref<SugarParticle[]>([]); // NEU: Array für Zuckerpartikel
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
  transform: `${getLayerStyle(0.4).transform} scale(1.2) rotate(${
    lightRayRotation.value * 0.8
  }deg)`,
}));

const containerStyle = computed(() => ({
  // Animiert die Perspektive für einen echten Zoom-Effekt
  perspective: `${perspective.value}px`,
}));

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
      color: props.particleColorFunc(),
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
      color: props.particleColorFunc(),
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
      color: props.particleColorFunc(), // Hier könnte auch eine andere Farb-Funktion als Prop übergeben werden
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

// NEU: Optimierte Funktion für Partikel-Transformation (vermeidet Layout-Thrashing)
const getParticleTransform = (particle: Particle) => {
  const moveX = -mouse.value.x * 100 * particle.depth;
  const moveY = -mouse.value.y * 100 * particle.depth;
  const translateZ = (particle.depth - 1) * 400;

  return `translate3d(calc(${particle.x}vw + ${moveX}px), calc(${particle.y}vh + ${moveY}px), ${translateZ}px)`;
};

const getForegroundStyle = (depth: number) => {
  const moveX = -mouse.value.x * 100 * depth;
  const moveY = -mouse.value.y * 100 * depth;
  // 3D-Neigung basierend auf der Mausposition berechnen
  const rotateY = mouse.value.x * 20; // Stärke der Neigung nach links/rechts
  const rotateX = -mouse.value.y * 20; // Stärke der Neigung nach oben/unten

  return {
    // Die rotate-Transformationen wieder hinzufügen
    transform: `translateX(-50%) translateY(-50%) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translate3d(${moveX}px, ${moveY}px, 350px) scale(${heartbeatScale.value})`, // KORREKTUR: Verwendet jetzt die einzelne Skalierungsvariable
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
      // --- Kamera-Animation: Handkamera-Effekt nach dem Zoom ---
      // Der Zoom selbst wird jetzt über GSAP gesteuert (siehe runIntroAnimation)
      const elapsedTime = time - animationStartTime;
      if (elapsedTime >= zoomDuration) {
        // 2. Handkamera-Effekt nach dem Zoom (angewendet auf die Maus)
        // perspective.value ist bereits durch GSAP auf 1200 gesetzt
        const shakeIntensity = 0.005;
        const noiseX =
          (Math.sin(time * 0.00025) + Math.cos(time * 0.00038)) *
          shakeIntensity;
        const noiseY =
          (Math.cos(time * 0.0003) + Math.sin(time * 0.00042)) * shakeIntensity;

        mouse.value.x += noiseX;
        mouse.value.y += noiseY;
      }
    }

    // KORREKTUR: Die Animation des 'seed' wird entfernt, da sie sprunghaft wirkt.
    // Stattdessen wird die 'baseFrequency' kontinuierlich und weich oszilliert,
    // um eine fließende, wellenartige Bewegung zu erzeugen, die natürlicher wirkt.
    if (turbulence.value) {
      // KORREKTUR: Angepasste Frequenzen und Oszillationsamplituden für deutlichere, großflächigere Wellen
      const freqX = 0.002 + Math.sin(time / 8000) * 0.0005; // Erhöhte Basisfrequenz und Amplitude
      const freqY = 0.003 + Math.cos(time / 7000) * 0.0007; // Erhöhte Basisfrequenz und Amplitude
      turbulence.value.setAttribute("baseFrequency", `${freqX} ${freqY}`);
    }
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
        const force =
          (1 - distance / repulsionRadius) * maxRepulsionStrength * p.depth; // Kraft skaliert mit Tiefe
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
        p.initialX += 100 + buffer * 2;
        p.x += 100 + buffer * 2; // KORREKTUR: Position sofort aktualisieren
      } else if (p.x > 100 + buffer) {
        p.initialX -= 100 + buffer * 2;
        p.x -= 100 + buffer * 2; // KORREKTUR: Position sofort aktualisieren
      }
      if (p.y < -buffer) {
        p.initialY += 100 + buffer * 2;
        p.y += 100 + buffer * 2; // KORREKTUR: Position sofort aktualisieren
      } else if (p.y > 100 + buffer) {
        p.initialY -= 100 + buffer * 2;
        p.y -= 100 + buffer * 2; // KORREKTUR: Position sofort aktualisieren
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
      if (
        p.x < -buffer ||
        p.x > 100 + buffer ||
        p.y < -buffer ||
        p.y > 100 + buffer
      ) {
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
      if (
        p.x < -buffer ||
        p.x > 100 + buffer ||
        p.y < -buffer ||
        p.y > 100 + buffer
      ) {
        // Anstatt sie auf der gegenüberliegenden Seite zu platzieren,
        // an einer zufälligen neuen Position starten lassen.
        const newX = Math.random() * 100;
        const newY = Math.random() * 100;
        p.initialX = newX;
        p.x = newX; // KORREKTUR: Position sofort aktualisieren
        p.initialY = newY;
        p.y = newY; // KORREKTUR: Position sofort aktualisieren
      }
    }

    animationFrameId = requestAnimationFrame(loop);
  };
  animationFrameId = requestAnimationFrame(loop);
};

// KORREKTUR: Die Herz-Animation wird jetzt in einer eigenen Funktion gekapselt.
const startHeartbeatAnimation = () => {
  if (!props.applyHeartbeatAnimation) return;

  // Diese Timeline ist jetzt exakt auf die 1.128s lange Audiodatei abgestimmt.
  const totalDuration = 1.128;

  // KORREKTUR: Animiert direkt die einzelne 'heartbeatScale'-Ref, was performanter ist.
  gsap.to(heartbeatScale, {
    value: 1, // Startwert, die Keyframes übernehmen die eigentliche Animation
    duration: totalDuration,
    repeat: -1,
    ease: "none",
    keyframes: {
      "25%": { value: 1 },
      "28%": { value: 1.05 },
      "30%": { value: 1.15 }, // 1. Spike bei 338ms
      "35%": { value: 1 },
      "48%": { value: 1 },
      "53%": { value: 1.06 }, // 2. Spike bei 598ms
      "60%": { value: 1 },
      "100%": { value: 1 },
    },
    // Der onUpdate-Callback mit Proxy-Objekt wird nicht mehr benötigt.
  });
};

// NEU: Funktion zum Erzeugen und Animieren der Zucker-Partikel
const triggerSugarParticles = () => {
  // Nur ausführen, wenn wir von gesund zu ungesund animieren
  if (props.reverseAnimation) return;

  // Anzahl basierend auf sugarAmount (z.B. sugarAmount * 2)
  const count = Math.floor(props.sugarAmount * 2);
  if (count <= 0) return;

  const newParticles: SugarParticle[] = [];

  for (let i = 0; i < count; i++) {
    // Startposition: Außerhalb des Bildschirms (Radius > ~70% vom Zentrum 50,50)
    const angle = Math.random() * Math.PI * 2;
    const startDist = 70 + Math.random() * 40; // 70% bis 110% Entfernung
    const startX = 50 + Math.cos(angle) * startDist;
    const startY = 50 + Math.sin(angle) * startDist;

    // Zielposition: Nahe dem Zentrum (Organ) mit etwas Streuung
    const endDist = Math.random() * 15; // Innerhalb von 15% Radius um die Mitte
    const endAngle = Math.random() * Math.PI * 2;
    const targetX = 50 + Math.cos(endAngle) * endDist;
    const targetY = 50 + Math.sin(endAngle) * endDist;

    newParticles.push({
      id: i,
      x: startX,
      y: startY,
      targetX,
      targetY,
      size: Math.random() * 3 + 2, // 2px bis 5px
      rotation: Math.random() * 360,
      opacity: 0, // Startet unsichtbar
    });
  }

  sugarParticles.value = newParticles;

  let maxDuration = 0;

  // Animation: Partikel fliegen zur Mitte (Optimiert & mit Fade-Out)
  sugarParticles.value.forEach((p) => {
    const delay = Math.random() * 3;
    const duration = 2.5;
    if (delay + duration > maxDuration) maxDuration = delay + duration;

    // Bewegung
    gsap.to(p, {
      x: p.targetX,
      y: p.targetY,
      rotation: Math.random() * 360 + 180,
      duration: duration,
      delay: delay,
      ease: "power2.in",
    });

    // Opazität: Einblenden -> Halten -> Ausblenden beim Auftreffen
    gsap.to(p, {
      duration: duration,
      delay: delay,
      keyframes: {
        "0%": { opacity: 0 },
        "10%": { opacity: 0.9 }, // Schnell einblenden
        "80%": { opacity: 0.9 }, // Sichtbar bleiben
        "100%": { opacity: 0 }, // Am Ende (beim Auftreffen) ausblenden
      },
    });
  });
};

// NEU: Hilfsfunktion zum Laden von Audio und Ermitteln der Dauer
const prepareAudio = (filename: string): Promise<{ audio: HTMLAudioElement, duration: number }> => {
  return new Promise((resolve) => {
    const audio = new Audio(`/voices/${filename}.mp3`);
    audio.onloadedmetadata = () => {
      // Sicherstellen, dass duration eine gültige Zahl ist
      const duration = Number.isFinite(audio.duration) ? audio.duration : 3;
      resolve({ audio, duration });
    };
    audio.onerror = () => {
      console.warn(`Audio ${filename} not found.`);
      resolve({ audio, duration: 3 }); // Fallback-Dauer
    };
    // Fallback Timeout, falls Metadata nicht lädt
    setTimeout(() => resolve({ audio, duration: 3 }), 2000);
  });
};

const playVoiceOver = (audio: HTMLAudioElement) => {
  if (currentVoiceOver.value) {
    currentVoiceOver.value.pause();
    currentVoiceOver.value.currentTime = 0;
  }
  currentVoiceOver.value = audio;
  audio.play().catch(e => console.warn("Voiceover play failed", e));
};

// NEU: GSAP-Animation für das Intro
const runIntroAnimation = async () => {
  if (
    !introOverlay.value ||
    !introText.value ||
    !textElement.value ||
    !textBackdrop.value ||
    !textBlurVignette.value ||
    !sugarCounter.value ||
    !sugarAmountText.value ||
    !backgroundTint.value
  )
    return;

  // 1. Audios vorladen und Dauern ermitteln
  let introAudioData = null;
  if (props.introAudioSrc) {
    introAudioData = await prepareAudio(props.introAudioSrc);
  }

  const textPartsData = [];
  for (const part of props.textPartsProp) {
    const data = await prepareAudio(part.audioSrc);
    textPartsData.push({ ...part, audio: data.audio, duration: data.duration });
  }

  // 2. Timeline erstellen
  const textEl = textElement.value;

  const tl = gsap.timeline({});

  // Initial Setup: Overlay startet schwarz (1), Text winzig und unsichtbar
  gsap.set(introOverlay.value, { opacity: 1 });
  gsap.set(introText.value, { scale: 0.1, opacity: 0, filter: "blur(10px)" });

  // Intro Audio starten (falls vorhanden)
  if (introAudioData) {
    playVoiceOver(introAudioData.audio);
  }

  // Intro Animation
  // 1. Text wird größer (winzig -> groß) im Dunkeln
  tl.to(introText.value, {
      scale: 1.1,
      opacity: 1,
      filter: "blur(0px)",
      duration: 4.0, // Langsamerer Anflug
      ease: "power2.out",
    })
    // 2. Intro-Text und Overlay faden aus (Szene enthüllen)
    .to([introOverlay.value, introText.value], {
      opacity: 0,
      duration: 2.0,
      ease: "power2.in",
      onStart: () => {
        // Hauptanimation (Zoom, Partikel etc.) starten
        runMainAnimation = true;
        animationStartTime = performance.now();
        // KORREKTUR: Organe initial setzen, je nach Animationsrichtung
        if (props.reverseAnimation) {
          // Heilung: Start mit krankem Organ (voll sichtbar) über gesundem
          gsap.set(healthyOrgan.value, { opacity: 1 });
          gsap.set(unhealthyOrgan.value, { opacity: 1 }); // Startet immer voll ungesund
          gsap.set(backgroundTint.value, { opacity: 0.8 }); // Startet mit Tönung
        } else {
          // Verfall: Start mit gesundem Organ
          gsap.set(healthyOrgan.value, { opacity: 1 });
          gsap.set(unhealthyOrgan.value, { opacity: 0 });
        }
        gsap.delayedCall(zoomDuration / 1000, startHeartbeatAnimation);

        // NEU: Zoom-Animation via GSAP für eine bessere Kurve
        gsap.fromTo(perspective, 
          { value: 6000 }, // Startwert verringert (weniger flach), um den "toten Punkt" am Anfang zu vermeiden
          { 
            value: 1200, 
            duration: zoomDuration / 1000, 
            ease: "expo.out" // Expo Out sorgt für einen schnellen Start und sanftes Landen
          }
        );
      },
      onComplete: () => {
        if (introOverlay.value) introOverlay.value.style.display = "none";
      },
    })
    // 4. Gesundes Organ für 2 Sekunden zeigen
    // Wenn Intro-Audio länger ist als die Animation bisher, hier warten?
    // Wir lassen es einfach laufen.
    .to({}, { duration: 1 })

    // 5. Dunkler werden und den ersten Text anzeigen
    .add(() => {
      textEl.innerHTML = textPartsData[0].text;
      playVoiceOver(textPartsData[0].audio);
    })
    .to(
      [textBackdrop.value, textBlurVignette.value],
      {
        opacity: 1,
        duration: 1.5,
        ease: "power2.inOut",
      },
      "<"
    ) // Gleichzeitig mit dem vorherigen Schritt starten
    .fromTo(
      textEl,
      { y: "100%", opacity: 0, filter: "blur(12px)" },
      {
        y: "0%",
        opacity: 1,
        filter: "blur(0px)",
        duration: 1.5,
        ease: "power3.out",
      },
      "-=1.0" // Startet 1s nach dem Einblenden des Backdrops
    )
    .to({}, { duration: textPartsData[0].duration }) // Text für Audio-Dauer halten

    // 6. Partikel-Animation 1 Sekunde vor dem nächsten Schritt starten
    .add(triggerSugarParticles, "-=2.0")
    // 7. Heller werden, Text ausblenden und Organ-Animation starten
    .to(textEl, {
      opacity: 0,
      filter: "blur(8px)",
      y: "-20%",
      duration: 1,
      ease: "power2.in",
    })
    .to(
      [textBackdrop.value, textBlurVignette.value],
      {
        opacity: 0,
        duration: 1.5,
        ease: "power2.out",
      },
      "<"
    ) // Gleichzeitig mit dem Text-Fade-out
    .to(
      unhealthyOrgan.value,
      {
        opacity: targetOpacity.value, // KORREKTUR: Zielwert ist immer der aktuelle Gesundheitszustand
        duration: 4, // 4 Sekunden Animation von gesund zu ungesund
        ease: "power2.inOut",
        onStart: () => {
          if (props.growSoundRef) {
            const sound = props.growSoundRef;
            sound.currentTime = 0;
            sound.volume = 0; // Startet leise
            sound.play();

            // Fade-in über 1 Sekunde
            gsap.to(sound, { volume: 0.8, duration: 1, ease: "power1.in" });

            // Fade-out nach 3 Sekunden (dauert 1 Sekunde, endet also bei 4s)
            gsap.to(sound, {
              volume: 0,
              duration: 1,
              delay: 3, // Startet nach 3 Sekunden
              ease: "power1.out",
              onComplete: () => sound.pause(), // Stoppt den Sound nach dem Ausblenden
            });
          }

          // NEU: Zucker-Sound synchron mit Grow-Sound abspielen
          if (sugarSound.value) {
            const sound = sugarSound.value;
            sound.currentTime = 0;
            sound.volume = 0;
            sound.play().catch(() => {});
            gsap.to(sound, { volume: 1, duration: 1, ease: "power1.in" });
            gsap.to(sound, {
              volume: 0,
              duration: 1,
              delay: 3,
              onComplete: () => sound.pause(),
            });
          }
        },
      },
      "<"
    )
    // NEU: Hintergrund-Tönung animieren, um den ungesunden Zustand zu verdeutlichen
    .to(
      backgroundTint.value,
      {
        opacity: targetOpacity.value * 0.8, // KORREKTUR: Zielwert ist immer der aktuelle Gesundheitszustand
        duration: 4,
        ease: "power2.inOut",
      },
      "<"
    )
    .add(() => {
      // NEU: Animation für den Zuckerzähler
      if (
        sugarCounter.value &&
        sugarAmountText.value &&
        props.sugarAmount > 0 &&
        !props.reverseAnimation
      ) {
        const counter = { value: 0 };

        // Zähler einblenden
        gsap.to(sugarCounter.value, {
          opacity: 1,
          duration: 1,
          ease: "power2.out",
        });

        // Zahl animieren
        gsap.to(counter, {
          value: props.sugarAmount,
          duration: 4, // Dauer der Organ-Animation
          ease: "power3.out",
          onUpdate: () => {
            if (sugarAmountText.value) {
              sugarAmountText.value.textContent = `${Math.round(
                counter.value
              )}g`;
            }
          },
        });
      }
    }, "<") // Gleichzeitig starten

    // 8. Dunkler werden und den letzten Text anzeigen
    .add(() => {
      const lastIndex = textPartsData.length - 1;
      textEl.innerHTML = textPartsData[lastIndex].text;
      playVoiceOver(textPartsData[lastIndex].audio);
    })
    .to([textBackdrop.value, textBlurVignette.value], {
      opacity: 1,
      duration: 1.5,
      ease: "power2.inOut",
    })
    .fromTo(
      textEl,
      { y: "100%", opacity: 0, filter: "blur(12px)" },
      {
        y: "0%",
        opacity: 1,
        filter: "blur(0px)",
        duration: 1.5,
        ease: "power3.out",
      },
      "-=1.0"
    )
    .to(
      {}, 
      { duration: textPartsData[textPartsData.length - 1].duration }
    ) // Letzten Text halten

    // 9. Alles ausblenden und "Next"-Button zeigen
    .to(textEl, {
      opacity: 0,
      filter: "blur(8px)",
      y: "-20%",
      duration: 1,
      ease: "power2.in",
    })
    .to(
      [textBackdrop.value, textBlurVignette.value],
      {
        opacity: 0,
        duration: 1.5,
        ease: "power2.out",
        onComplete: () => {
          showNextButton.value = true;
        },
      },
      "<"
    );
};

onMounted(() => {
  generateParticles();
  animateParticles();
  window.addEventListener("mousemove", handleMouseMove);
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
      emit("scene-finished"); // Informiert die Elternkomponente
    },
  });
};

onBeforeUnmount(() => {
  cancelAnimationFrame(animationFrameId);
  window.removeEventListener("mousemove", handleMouseMove); // Listener wieder entfernen
  if (currentVoiceOver.value) {
    currentVoiceOver.value.pause();
    currentVoiceOver.value = null;
  }
});
</script>

<style scoped>
/* NEU: Wrapper für globale Helligkeitsanpassung */
.scene-wrapper {
  width: 100%;
  height: 100%;
  filter: brightness(1.3); /* Gesamte Szene etwas heller machen */
}

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
  /* KORREKTUR: Der Turbulenz-Filter wird auf ein globales Overlay verschoben, um die gesamte Szene zu beeinflussen. */
  filter: blur(5px);
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
  max-width: 80%; /* Begrenzte Breite für automatischen Umbruch */
  line-height: 1.4; /* Bessere Lesbarkeit bei mehrzeiligem Text */
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
  opacity: 1; /* Startet sichtbar (schwarz) */
}

.intro-text {
  color: rgba(255, 220, 220, 0.8);
  font-size: clamp(2rem, 5vw, 5rem); /* Responsive Schriftgröße */
  font-weight: bold;
  text-shadow: 0 0 20px rgba(255, 100, 100, 0.3);
  text-align: center; /* KORREKTUR: Text zentrieren */
  opacity: 0; /* Startet unsichtbar für die GSAP-Animation */
  max-width: 80%; /* Begrenzte Breite */
  line-height: 1.2;
}

.vignette {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(
    ellipse at center,
    rgba(0, 0, 0, 0) 50%,
    rgba(0, 0, 0, 0.9) 100%
  );
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
  background-color: rgba(
    0,
    0,
    0,
    0.5
  ); /* Halbtransparenter schwarzer Hintergrund */
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
  will-change: transform; /* NEU: Performance-Optimierung */
}

/* NEU: Stil für Zucker-Partikel */
.sugar-particle {
  background-color: #fff;
  border-radius: 1px; /* Leicht eckig für Kristall-Look */
  box-shadow: 0 0 4px rgba(255, 255, 255, 0.8);
  pointer-events: none;
}

/* NEU: Stile für den Zuckerzähler */
.sugar-counter {
  position: fixed;
  bottom: 5vh; /* KORREKTUR: Position nach unten verschoben */
  left: 50%;
  transform: translateX(-50%); /* KORREKTUR: Nur horizontal zentrieren */
  color: rgba(255, 255, 255, 0.9);
  text-align: center;
  z-index: 5; /* Hinter dem Haupttext, aber vor dem Organ */
  opacity: 0; /* Startet unsichtbar */
  pointer-events: none;
  text-shadow: 0 0 15px rgba(0, 0, 0, 0.5);
}

.sugar-amount-text {
  font-size: 3rem; /* KORREKTUR: Schriftgröße verkleinert */
  font-weight: bold;
  display: block;
  line-height: 1;
}

.sugar-label-text {
  font-size: 1rem; /* KORREKTUR: Schriftgröße verkleinert */
  font-weight: normal;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  display: block;
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
    var(--a),
    var(--b),
    var(--c),
    var(--d),
    var(--a),
    var(--d),
    var(--a),
    var(--d),
    var(--b),
    var(--c),
    var(--d),
    var(--a),
    var(--b)
  );
}

.light-rays-foreground:after {
  background: conic-gradient(
    var(--c),
    transparent,
    var(--c),
    var(--a),
    transparent,
    var(--b),
    var(--c),
    transparent,
    var(--c),
    var(--a)
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
    var(--a-bg),
    var(--b-bg),
    var(--c-bg),
    var(--d-bg),
    var(--a-bg)
  );
}

.light-rays-background:after {
  background: conic-gradient(
    transparent,
    var(--b-bg),
    transparent,
    var(--c-bg)
  );
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

/* --- NEU: Overlay für die Unterwasser-Verzerrung --- */
.underwater-distortion-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none; /* Lässt Klicks durch */
  backdrop-filter: url(#turbulence-filter);
  z-index: 150; /* Stellt sicher, dass es über den meisten Inhalten liegt */
}

/* NEU: Overlay für die grün-gelbe Tönung des Hintergrunds */
.background-tint {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #c98e26; /* KORREKTUR: Gelblich/Rötlicher Ton (Rost/Orange) statt Grün */
  mix-blend-mode: color; /* KORREKTUR: 'color' ändert nur die Farbe, ohne das Bild abzudunkeln */
  opacity: 0; /* Wird über GSAP animiert */
  z-index: 0; /* Hinter dem Organ, aber über dem Hintergrundbild/den Strahlen */
  pointer-events: none;
}
</style>
