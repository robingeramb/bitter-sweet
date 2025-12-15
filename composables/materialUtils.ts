import * as THREE from "three";
// Korrektur: Verwendung von 'import type' für Interfaces
import type { BlendingState } from "./types";

/**
 * Modifiziert das Material, um das Shader-Blending zwischen Originalfarbe und der "faulen" Textur
 * zu ermöglichen, indem der Shader von MeshStandardMaterial überschrieben wird (onBeforeCompile).
 *
 * @param material Das zu modifizierende MeshStandardMaterial.
 * @param blendingState Der Zustands-Container, der die Texturen und die Blending-Uniform enthält.
 */
export function setupMaterialBlending(
  material: THREE.MeshStandardMaterial,
  blendingState: BlendingState
) {
  if (!blendingState.rottenBaseColorMap) {
    console.warn("Blending-Textur (Rotten BaseColor) fehlt.");
    return;
  }

  // Zustand speichern
  blendingState.targetMaterial = material;
  blendingState.startRoughness = material.roughness;
  blendingState.startColor.copy(material.color);

  material.onBeforeCompile = (shader) => {
    // Uniforms hinzufügen (u_blendFactor steuert das Blending)
    shader.uniforms.u_blendFactor = blendingState.blendUniform;
    shader.uniforms.tBaseColorB = {
      value: blendingState.rottenBaseColorMap,
    };

    // --- 1. Fragment Shader: Globale Deklarationen und vUv-Definition erzwingen ---
    shader.fragmentShader = `
          uniform float u_blendFactor;
          uniform sampler2D tBaseColorB;
          
          // Wir definieren vUv, falls das Material keine eigene Map hat und es fehlen würde.
          #ifndef USE_UV
          varying vec2 vUv;
          #endif
          
          ${shader.fragmentShader}
      `;

    // --- 2. Vertex Shader: vUv-Deklaration und Zuweisung erzwingen ---
    shader.vertexShader = shader.vertexShader.replace(
      "#include <uv_pars_vertex>",
      `
          #include <uv_pars_vertex>
          #ifndef USE_UV
          varying vec2 vUv;
          #endif
          `
    );

    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `
          #include <begin_vertex>
          
          #ifndef USE_UV
          vUv = uv; // Manuelle Zuweisung (uv ist immer verfügbar)
          #endif
          `
    );

    // --- 3. Base Color Blending Logik ergänzen ---
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `
          #include <color_fragment>

          // Zustand A ist die bereits berechnete diffuseColor (Originalfarbe/Textur)
          vec4 texelMapA = vec4( diffuseColor.rgb, 1.0 );
          
          // Zustand B ist unsere "faule" Textur
          vec4 texelMapB = texture2D( tBaseColorB, vUv );
          
          // Lineares Blending basierend auf u_blendFactor
          vec4 blendedColor = mix( texelMapA, texelMapB, u_blendFactor );

          // Die gemischte Farbe anwenden
          diffuseColor.rgb = blendedColor.rgb;
          `
    );
  };

  material.needsUpdate = true;
}
