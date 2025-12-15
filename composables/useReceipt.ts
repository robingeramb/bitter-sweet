import * as THREE from "three";
import gsap from "gsap";
import { useVariablesStore } from "~/stores/store";

const receiptData = {
  headline: "Receipt",
  items: [
    { name: "Cola 1L", sugar: 106 },
    { name: "Nutella 400g", sugar: 212 },
    { name: "Snickers", sugar: 26 },
  ],
};

export let receipt: THREE.Mesh;
let l = 0;

/**
 * Animiert den Receipt: fährt nach oben und rollt sich leicht hinten
 */
export function animateReceipt() {
  if (!receipt || !receipt.geometry) return;

  const geom = receipt.geometry;
  const posAttribute = geom.attributes.position;
  const originalPositions = Float32Array.from(posAttribute.array);

  // Einstellungen für einen 0.15m langen Bon
  const config = {
    progress: 0,
    curlRadius: 0.05, // Enger Radius (2.5cm) für realistische Rolle
    curlStart: 0.05, // Die ersten 2cm kommen kerzengerade raus, dann rollt es
  };

  // Ziel: Länge + ein kleines Stück extra, damit er am Ende locker hängt
  const targetDist = l;

  gsap.to(config, {
    progress: targetDist,
    duration: 3,
    ease: "power2.inOut", // Fängt sanft an, wird schneller, bremst sanft
    onComplete: () => {
      const variablesStore = useVariablesStore();
      document.exitPointerLock();
      variablesStore.updateShowReceiptDone(true);
    },
    onUpdate: () => {
      for (let i = 0; i < posAttribute.count; i++) {
        const ix = i * 3;
        const yBase = originalPositions[ix + 1]; // Basis Y (z.B. -0.15 bis 0)
        const zBase = originalPositions[ix + 2]; // Basis Z (meist 0)

        // 1. Lineares Herausschieben
        // Wir addieren den Progress.
        // Da yBase negativ ist (im Drucker), schiebt 'progress' den Punkt Richtung 0 (Schlitz).
        const currentY = yBase + config.progress;

        // 2. Biege-Logik
        // Alles was oberhalb von 'curlStart' ist, wird gebogen
        if (currentY > config.curlStart) {
          // Wie viel Papier ist schon "über" der Biege-Grenze?
          const dist = currentY - config.curlStart;

          // WICHTIG: Winkel ist POSITIV, damit der Bogen nach OBEN geht.
          const angle = dist / config.curlRadius;

          // Y-Position (Höhe):
          // Sinus startet bei 0, geht auf 1 hoch -> Papier geht HOCH.
          // Wir addieren curlStart, damit der Bogen exakt dort ansetzt.
          const bentY = config.curlStart + Math.sin(angle) * config.curlRadius;

          // Z-Position (Tiefe/Rolle):
          // Cosinus startet bei 1. (1 - 1) = 0. -> Startet flach.
          // Dann wird cos kleiner, der Term wird größer.
          // Das MINUS davor sorgt dafür, dass es nach HINTEN (-Z) rollt.
          const bentZ = zBase + config.curlRadius * (1 - Math.cos(angle));

          posAttribute.setY(i, bentY);
          posAttribute.setZ(i, bentZ);
        } else {
          // Der Teil des Papiers, der noch gerade ist (oder noch im Drucker steckt)
          posAttribute.setY(i, currentY);
          posAttribute.setZ(i, zBase);
        }
      }

      posAttribute.needsUpdate = true;
      geom.computeBoundingSphere(); // Verhindert Flackern/Culling
    },
  });
}

/**
 * Erstellt die Receipt-Textur (Canvas)
 */
export async function createReceiptTexture(data, widthMeter) {
  const DPI = 300; // hohe Schärfe für klare Schrift
  const pxPerMeter = 3779; // 1m ≈ 3779px bei 96dpi → für 300dpi skalieren wir später hoch
  const scale = 3.125; // 96dpi → 300dpi Faktor
  const pxpm = pxPerMeter * scale;

  const widthPx = widthMeter * pxpm;

  // TEXT STYLE
  const fontXtreme = "900 100px Arial";
  const fontTitle = "bold 70px Arial";
  const fontItem = "42px Arial";
  const fontSum = "600 42px Arial";

  // --- PRE-CALC HEIGHT ---
  const lineGap = 40;
  const titleHeight = 160;
  const itemHeight = 70;
  const sumHeight = 520;

  const itemsHeight = data.items.length * (itemHeight + lineGap);
  const totalHeight = titleHeight + itemsHeight + sumHeight + 200;

  const heightPx = totalHeight;

  // --- CANVAS ---
  const canvas = document.createElement("canvas");
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext("2d");

  // Spiegeln wie in deinem Code
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);

  // Hintergrund
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let y = 160;

  // --- TITLE ---
  ctx.fillStyle = "black";
  ctx.font = fontTitle;
  ctx.textAlign = "center";
  ctx.fillText(data.headline, canvas.width / 2, y);
  y += 120;

  // --- ITEMS ---
  ctx.font = fontItem;
  ctx.textAlign = "left";

  let totalSugar = 0;

  data.items.forEach((item) => {
    ctx.fillText(item.name, 50, y);
    ctx.textAlign = "right";
    ctx.fillText(item.sugar + " g", canvas.width - 50, y);

    totalSugar += item.sugar;

    ctx.textAlign = "left"; // für nächsten Loop
    y += itemHeight;
  });

  // --- TOTAL ---
  y += 50;
  ctx.font = fontSum;
  ctx.textAlign = "left";
  ctx.fillText(`Total Sugar amount:`, 50, y);

  // Relation zum Tageslimit
  y += 80;
  ctx.font = fontTitle;
  ctx.textAlign = "right";
  ctx.fillStyle = "red";
  ctx.fillText(`${totalSugar} g`, canvas.width - 50, y);
  y += 110;
  ctx.fillStyle = "black";
  ctx.font = fontSum;
  ctx.textAlign = "left";
  const maxDaily = 25;
  const percentage = ((totalSugar / maxDaily) * 100).toFixed(0);
  ctx.fillText(`The Healthy limit`, 50, y);
  y += 50;
  ctx.fillText(`per day is 25g.`, 50, y);
  y += 90;
  ctx.textAlign = "right";
  ctx.fillText(`Your shopping is`, canvas.width - 50, y);
  y += 120;

  ctx.font = fontXtreme;
  ctx.fillStyle = "red";
  ctx.fillText(`${percentage}%`, canvas.width - 50, y);
  y += 70;
  ctx.fillStyle = "black";
  ctx.font = fontSum;
  ctx.fillText(`of that.`, canvas.width - 50, y);
  y += 120;

  // --- TEXTURE ---
  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = true;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  // Länge des "Papiers" in Metern zurückgeben
  const lengthMeter = canvas.height / pxpm;

  return { texture, lengthMeter };
}

/**
 * Erstellt die Receipt-Geometry + Mesh komplett unterhalb der Szene
 */
export async function createReceiptShaderMesh(width, paperPosition) {
  const { texture, lengthMeter } = await createReceiptTexture(
    receiptData,
    width
  );

  l = lengthMeter;

  const geo = new THREE.PlaneGeometry(width, lengthMeter, 2, 200);
  geo.translate(0, -lengthMeter / 2, 0);

  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geo, mat);

  // Sicheres Setzen der Position & Rotation
  if (paperPosition?.position) {
    mesh.position.copy(paperPosition.position);
  }

  if (paperPosition?.rotation) {
    mesh.rotation.copy(paperPosition.rotation);
  }

  receipt = mesh;
  return mesh;
}

/**
 * Hilfsfunktion: Höhe der Geometrie berechnen
 */
function getGeometryHeight(geom: THREE.BufferGeometry) {
  geom.computeBoundingBox();
  return geom.boundingBox.max.y - geom.boundingBox.min.y;
}
