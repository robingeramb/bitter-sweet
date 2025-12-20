import * as THREE from "three";
import gsap from "gsap";
import { useVariablesStore } from "~/stores/store";
import { useShoppingCartStore } from "~/stores/store";

let receiptData = {
  headline: "Receipt",
  items: [],
};

export let receipt: THREE.Mesh;
let l = 0;

// NEU: Sound für den Kassenbon
const receiptSound = typeof Audio !== "undefined" ? new Audio("/sound/receipt.mp3") : null;
if (receiptSound) receiptSound.volume = 0.5;

/**
 * Animiert den Receipt: fährt nach oben und rollt sich leicht hinten
 */
export function animateReceipt() {
  if (!receipt || !receipt.geometry) return;

  // NEU: Sound abspielen
  if (receiptSound) {
    receiptSound.currentTime = 0;
    receiptSound.play().catch(() => {});
  }

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
 * Hilfsfunktion: Zerlegt Text in Zeilen basierend auf maximaler Breite
 */
function wrapText(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + " " + word).width;
    if (width < maxWidth) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
}

/**
 * Erstellt die Receipt-Textur (Canvas) mit Zeilenumbruch
 */
export async function createReceiptTexture(data, widthMeter) {
  // --- KONFIGURATION ---
  const DPI = 300;
  const pxPerMeter = 3779;
  const scale = 3.125;
  const pxpm = pxPerMeter * scale;
  const widthPx = widthMeter * pxpm;

  // Fonts
  const fontXtreme = "900 100px Arial";
  const fontTitle = "bold 70px Arial";
  const fontItem = "42px Arial";
  const fontSum = "600 42px Arial";

  // Abstände
  const marginX = 50;
  const lineGap = 40; // Abstand zwischen Items
  const lineHeight = 50; // Höhe einer einzelnen Textzeile
  const titleHeight = 160;
  const sumSectionHeight = 520; // Pauschale Höhe für den Footer (Total, Limit, etc.)

  // Bereich für Zucker-Anzeige rechts reservieren (z.B. 250px)
  const sugarColumnWidth = 100;
  const maxNameWidth = widthPx - marginX * 2 - sugarColumnWidth;

  // --- SCHRITT 1: VORBERECHNUNG (Messen) ---
  // Wir brauchen einen Dummy-Context zum Messen der Textbreite
  const tempCanvas = document.createElement("canvas");
  const tempCtx = tempCanvas.getContext("2d");
  tempCtx.font = fontItem;

  let dynamicItemsHeight = 0;
  const processedItems = [];

  data.items.forEach((item) => {
    // Zeilenumbruch berechnen
    const lines = wrapText(tempCtx, item.productName, maxNameWidth);

    // Höhe dieses Items: (Anzahl Zeilen * Zeilenhöhe) + Abstand zum nächsten Item
    const itemHeight = lines.length * lineHeight + lineGap;

    dynamicItemsHeight += itemHeight;

    processedItems.push({
      ...item,
      lines: lines, // Die berechneten Zeilen speichern wir für später
      height: itemHeight, // Die Höhe dieses Blocks
    });
  });

  // Gesamthöhe berechnen
  const totalHeight = titleHeight + dynamicItemsHeight + sumSectionHeight + 200;

  // --- SCHRITT 2: CANVAS ERSTELLEN ---
  const canvas = document.createElement("canvas");
  canvas.width = widthPx;
  canvas.height = totalHeight;
  const ctx = canvas.getContext("2d");

  // Spiegeln (Setup wie gehabt)
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);

  // Hintergrund weiß
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let y = 160; // Start Y-Position

  // --- HEADER ZEICHNEN ---
  ctx.fillStyle = "black";
  ctx.font = fontTitle;
  ctx.textAlign = "center";
  ctx.fillText(data.headline, canvas.width / 2, y);
  y += 120;

  // --- ITEMS ZEICHNEN ---
  ctx.font = fontItem;

  let totalSugar = 0;

  processedItems.forEach((item) => {
    // 1. Produktname (Linksbündig)
    ctx.textAlign = "left";

    // Jede Zeile des Namens schreiben
    item.lines.forEach((line, index) => {
      // y + (index * lineHeight) sorgt dafür, dass Zeilen untereinander stehen
      ctx.fillText(line, marginX, y + index * lineHeight);
    });

    // 2. Zuckerwert (Rechtsbündig)
    // Wir schreiben den Wert in die ERSTE Zeile des Produkts (oder item.height/2 für Mitte)
    ctx.textAlign = "right";
    ctx.fillText(item.sugarAmount + " g", canvas.width - marginX, y);

    totalSugar += item.sugarAmount;

    // Y für das nächste Item erhöhen
    // Wir addieren die tatsächliche Höhe dieses Items (inkl. aller Zeilen)
    y += item.height;
  });

  // --- FOOTER / TOTAL ---
  // Ab hier ist y dynamisch korrekt verschoben
  y += 50;

  ctx.font = fontSum;
  ctx.textAlign = "left";
  ctx.fillText(`Total Sugar amount:`, marginX, y);

  y += 80;
  ctx.font = fontTitle;
  ctx.textAlign = "right";
  ctx.fillStyle = "red";
  ctx.fillText(`${totalSugar} g`, canvas.width - marginX, y);

  y += 110;
  ctx.fillStyle = "black";
  ctx.font = fontSum;
  ctx.textAlign = "left";

  const maxDaily = 25;
  const percentage =
    maxDaily > 0 ? ((totalSugar / maxDaily) * 100).toFixed(0) : 0;

  ctx.fillText(`The Healthy limit`, marginX, y);
  y += 50;
  ctx.fillText(`per day is 25g.`, marginX, y);
  y += 90;
  ctx.textAlign = "right";
  ctx.fillText(`Your shopping is`, canvas.width - marginX, y);
  y += 120;

  ctx.font = fontXtreme;
  ctx.fillStyle = "red";
  ctx.fillText(`${percentage}%`, canvas.width - marginX, y);
  y += 70;
  ctx.fillStyle = "black";
  ctx.font = fontSum;
  ctx.fillText(`of that.`, canvas.width - marginX, y);

  // --- TEXTURE ERSTELLEN ---
  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = true;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  // Länge in Metern für Three.js Geometrie
  const lengthMeter = canvas.height / pxpm;

  return { texture, lengthMeter };
}

/**
 * Erstellt die Receipt-Geometry + Mesh komplett unterhalb der Szene
 */
export async function createReceiptShaderMesh(width, paperPosition, model) {
  const shoppingCartStore = useShoppingCartStore();
  const variablesStore = useVariablesStore();
  watch(
    () => variablesStore.cashoutStart,
    async (newValue) => {
      if (newValue === true) {
        if (newValue) {
          receiptData.items = shoppingCartStore.itemsInCart;
          console.log(shoppingCartStore.itemsInCart);
          console.log("Receipt Data:", receiptData);
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
          model.add(receipt);
        }
      }
    }
  );
}

/**
 * Hilfsfunktion: Höhe der Geometrie berechnen
 */
function getGeometryHeight(geom: THREE.BufferGeometry) {
  geom.computeBoundingBox();
  return geom.boundingBox.max.y - geom.boundingBox.min.y;
}
