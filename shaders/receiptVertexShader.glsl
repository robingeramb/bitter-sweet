varying vec2 vUv;

uniform float uProgress;
uniform float uBend;
uniform float uHeight;

void main() {

    vUv = uv;

    vec3 p = position;

    float visibleHeight = uProgress * uHeight;

    if (p.y > visibleHeight) {
        gl_Position = vec4(0.0, -9999.0, 0.0, 1.0);
        return;
    }

    float t = clamp((p.y / visibleHeight) - 0.7, 0.0, 1.0);
    float bendAmount = t * uBend;

    p.z -= sin(t * 3.14159) * bendAmount * 0.3;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
