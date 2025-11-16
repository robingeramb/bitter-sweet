import * as THREE from "three";

type MessageLine = {
  text: string;
  size?: number;
  color?: string;
};

type MessageLayout = {
  lines: MessageLine[];
};

// --- Globale Variablen ---
const messages: MessageLayout[] = [
  {
    lines: [
      { text: "Awesome!", size: 64, color: "white" },
      { text: "You have successfully completed", size: 36, color: "white" },
      { text: "your grocery shopping.", size: 36, color: "white" },
    ],
  },
  {
    lines: [{ text: " But at what cost?", size: 64, color: "white" }],
  },
  {
    lines: [
      {
        text: "Grocerys are filled with sugar",
        size: 36,
        color: "white",
      },
      {
        text: "and we often dont even know about it.",
        size: 36,
        color: "white",
      },
    ],
  },
];

let currentIndex = 0;
let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let texture: THREE.CanvasTexture;

let animationTimer = 0;
let transitionState = "IDLE";
let textOpacity = 1.0;
const fadeSpeed = 0.02;

/**
 * Initialisiert das Display und weist die Canvas-Textur dem Mesh zu
 */
export function initDisplayController(displayMesh: THREE.Mesh) {
  canvas = document.createElement("canvas");
  ctx = canvas.getContext("2d")!;
  const scale = 2;
  canvas.width = 512 * scale;
  canvas.height = 256 * scale;

  texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;

  const mat = displayMesh.material as
    | THREE.MeshBasicMaterial
    | THREE.MeshStandardMaterial;
  mat.map = texture;
  mat.map.repeat.set(1, -1);
  mat.map.offset.set(0, 1);
  mat.needsUpdate = true;

  window.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "l" && transitionState === "IDLE") {
      transitionState = "FADING_OUT";
      console.log("test");
    }
  });

  animateDisplay();
}

/**
 * Diese Funktion wird in jedem Frame aufgerufen
 */
export function animateDisplay() {
  if (!ctx) return;

  animationTimer += 0.05;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(Math.PI);

  ctx.fillStyle = "black";
  ctx.fillRect(
    -canvas.width / 2,
    -canvas.height / 2,
    canvas.width,
    canvas.height
  );

  // --- Fade State Machine ---
  if (transitionState === "FADING_OUT") {
    textOpacity -= fadeSpeed;
    if (textOpacity <= 0) {
      textOpacity = 0;
      transitionState = "FADING_IN";
      currentIndex = (currentIndex + 1) % messages.length;
    }
  } else if (transitionState === "FADING_IN") {
    textOpacity += fadeSpeed;
    if (textOpacity >= 1) {
      textOpacity = 1;
      transitionState = "IDLE";
    }
  }

  // --- Text Rendering ---
  const layout = messages[currentIndex];
  const lineHeightFactor = 1.3; // Zeilenabstand
  let totalHeight = 0;

  // 1. Berechne Gesamthöhe
  for (const line of layout.lines) {
    totalHeight += (line.size ?? 48) * lineHeightFactor;
  }

  // 2. Zeichne jede Zeile zentriert
  ctx.save();
  ctx.globalAlpha = textOpacity;
  let y = -totalHeight / 2;

  for (const line of layout.lines) {
    const size = line.size ?? 48;
    ctx.font = `bold ${size}px sans-serif`;
    ctx.fillStyle = line.color ?? "white";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(line.text, 0, y);
    y += size * lineHeightFactor;
  }

  ctx.restore();
  texture.needsUpdate = true;
}
