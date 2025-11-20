<template>
  <div class="parallax-container" @mousemove="handleMouseMove" :style="containerStyle">
    <!-- NEU: Vordere rotierende Lichtstrahlen -->
    <div class="light-rays-foreground" :style="{ transform: 'scale(1.2)' }"></div>

    <!-- Hintergrundbild (ganz hinten) -->
    <img
      src="/parallax/Innenraum.png"
      class="parallax-layer background-image"
      alt="Hintergrund"
      :style="{ transform: getLayerStyle(0.1).transform + ' scale(1.2)' }"
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
      :style="{ transform: getLayerStyle(0.4).transform + ' scale(1.2)' }"
    >
    </div>

    <!-- NEU: Gesunde Leber (wird überblendet) -->
    <img
      src="/parallax/Leber_Healthy2.png"
      class="parallax-layer foreground"
      :style="getForegroundStyle(1)"
      alt="Gesunde Leber"
    />

    <!-- Vordergrundbild (im Fokus) -->
    <img
      src="/parallax/Leber2.png"
      class="parallax-layer foreground unhealthy-liver"
      :style="getForegroundStyle(1)"
      alt="Kranke Leber"
    />

    <!-- Text-Ebene -->
    <div class="parallax-layer" :style="getLayerStyle(1.1)">
      <div class="text-content">
        <p>
          Elevated risk of obesity and liver fat accumulation<br />
          Linked to childhood obesity in research
        </p>
        <p>
          Elevated risk for liver disease,<br />
          Including non-alcoholic fatty liver disease (NAFLD)
        </p>
      </div>
    </div>

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
    <div class="blur-vignette"></div>
    <div class="vignette"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from "vue";

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

const mouse = ref({ x: 0, y: 0 });
const targetMouse = ref({ x: 0, y: 0 }); // Zielposition der Maus
const backgroundParticles = ref<Particle[]>([]);
const foregroundParticles = ref<Particle[]>([]);
const totalParticleCount = 70;
const foregroundParticleCount = 5;
const mouseSmoothness = 0.1; // Je kleiner, desto sanfter (0.1 = 10% pro Frame)
let animationFrameId: number;
const perspective = ref(3000); // Startwert für den Zoom (weit weg)
let animationStartTime: number | null = null;
const zoomDuration = 4000; // 4 Sekunden Zoom-Animation

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

const getEdgePositions = (): { x: number; y: number } => {
  let x: number;
  let y: number;
  const edgeMargin = 0.15; // 15% Puffer außerhalb des Bildschirms

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

  backgroundParticles.value = newBgParticles;
  foregroundParticles.value = newFgParticles;
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
  // NEU: Z-Translation hinzufügen, um echten 3D-Raum zu schaffen
  const translateZ = (depth - 1) * 300; // Elemente mit depth < 1 nach hinten, > 1 nach vorne

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
    transform: `translateX(-70%) translateY(-50%) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translate3d(${moveX}px, ${moveY}px, 150px)`,
  };
};

// Animations-Loop mit sanfter Interpolation und Performance-Optimierung
const animateParticles = () => {
  const loop = (time: number) => {
    if (animationStartTime === null) {
      animationStartTime = time;
    }

    // Sanfte Maus-Interpolation (Lerp)
    mouse.value.x += (targetMouse.value.x - mouse.value.x) * mouseSmoothness;
    mouse.value.y += (targetMouse.value.y - mouse.value.y) * mouseSmoothness;

    // --- Kamera-Animation: Zoom und Handkamera-Effekt (korrigiert) ---
    const elapsedTime = time - animationStartTime;
    if (elapsedTime < zoomDuration) {
      // 1. Zoom-In Animation am Anfang
      const progress = elapsedTime / zoomDuration;
      const easedProgress = progress * (2 - progress); // Ease-out Quad
      // Animiert die Perspektive von 1200px (nah) auf 3000px (fern), was einen Zoom-In-Effekt erzeugt
      perspective.value = 3000 - 1800 * easedProgress;
    } else {
      // 2. Handkamera-Effekt nach dem Zoom (angewendet auf die Maus)
      perspective.value = 1200; // Endwert der Perspektive beibehalten
      const shakeIntensity = 0.005;
      const noiseX = (Math.sin(time * 0.00025) + Math.cos(time * 0.00038)) * shakeIntensity;
      const noiseY = (Math.cos(time * 0.0003) + Math.sin(time * 0.00042)) * shakeIntensity;

      mouse.value.x += noiseX;
      mouse.value.y += noiseY;
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
            const force = (1 - distance / repulsionRadius) * maxRepulsionStrength * p.depth; // Kraft skaliert mit Tiefe
            const angle = Math.atan2(dy, dx); // Winkel von der Maus zum Partikel
            // Die Grundposition des Partikels dauerhaft verschieben
            p.initialX += Math.cos(angle) * force * 0.1; // 0.1 als Dämpfungsfaktor
            p.initialY += Math.sin(angle) * force * 0.1;
        }

        p.x = newX;
        p.y = newY;
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

        // Normalisiere Maus- und Partikelpositionen in den gleichen Bereich [0, 100]
        const mouseX = (mouse.value.x + 0.5) * 100;
        const mouseY = (mouse.value.y + 0.5) * 100;

        const dx = newX - mouseX;
        const dy = newY - mouseY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < repulsionRadius) {
            const force = (1 - distance / repulsionRadius) * maxRepulsionStrength;
            const angle = Math.atan2(dy, dx); // Winkel von der Maus zum Partikel
            // Die Grundposition des Partikels dauerhaft verschieben
            p.initialX += Math.cos(angle) * force * 0.1; // 0.1 als Dämpfungsfaktor
            p.initialY += Math.sin(angle) * force * 0.1;
        }
        p.x = p.initialX + Math.sin(t * p.speed + p.offsetX) * p.amplitude;
        p.y = p.initialY + Math.cos(t * p.speed + p.offsetY) * p.amplitude;
    }

    animationFrameId = requestAnimationFrame(loop);
  };
  animationFrameId = requestAnimationFrame(loop);
};

onMounted(() => {
  generateParticles();
  handleMouseMove({ clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 } as MouseEvent);
  animateParticles();
});

onBeforeUnmount(() => {
  cancelAnimationFrame(animationFrameId);
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
  width: 60%;
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
}

.text-content {
  position: absolute;
  top: 50%;
  left: 65%; /* Positioniert den Text auf der rechten Bildschirmhälfte */
  width: 30%; /* Breite des Textblocks */
  transform: translateY(-50%); /* Zentriert den Block vertikal */
  color: rgba(255, 255, 255, 0.8);
  font-size: 1rem;
  pointer-events: none; /* Verhindert, dass der Text Maus-Events abfängt */
}

.vignette {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(ellipse at center, rgba(0,0,0,0) 60%, rgba(0,0,0,0.5) 100%);
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

.text-content p {
  margin-bottom: 1.5em;
}

.particle {
  border-radius: 50%;
}

/* --- NEU: Leber-Überblendung --- */
@keyframes fadeInLiver {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
.unhealthy-liver {
  opacity: 0; /* Startet unsichtbar */
  animation: fadeInLiver 2s ease-in-out 0.5s forwards; /* 10s Fade-In nach 3s Verzögerung */
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
  animation: rotate 80s infinite linear; /* Animation weiter verlangsamt */
}

.light-rays-foreground:after {
  background: conic-gradient(
    var(--c), transparent, var(--c), var(--a), transparent, var(--b),
    var(--c), transparent, var(--c), var(--a)
  );
  animation: rotate 65s 4s infinite reverse linear; /* Animation weiter verlangsamt */
}

/* Hintere Lichtstrahlen */
.light-rays-background {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
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
  animation: rotate 110s infinite linear; /* Andere, noch langsamere Geschwindigkeit */
}

.light-rays-background:after {
  background: conic-gradient(transparent, var(--b-bg), transparent, var(--c-bg));
  animation: rotate 90s 2s infinite reverse linear; /* Andere Geschwindigkeit und Delay */
}
</style>