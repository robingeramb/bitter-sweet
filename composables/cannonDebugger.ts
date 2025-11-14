import * as THREE from 'three';
import * as CANNON from 'cannon';

/**
 * Erstellt ein sichtbares Drahtgitter-Mesh für einen CANNON.Body, um Kollisionsformen zu debuggen.
 * @param scene Die Three.js-Szene, zu der das Debug-Mesh hinzugefügt wird.
 * @param body Der CANNON.Body, der visualisiert werden soll.
 * @returns Ein THREE.Object3D, das die visuellen Debug-Meshes enthält.
 */
export function createCannonDebugger(scene: THREE.Scene, body: CANNON.Body): THREE.Object3D {
    const group = new THREE.Group();

    const material = new THREE.MeshBasicMaterial({
        color: 0xff0000, // Leuchtend rot für gute Sichtbarkeit
        wireframe: true,
        transparent: true,
        opacity: 0.7
    });

    body.shapes.forEach((shape, i) => {
        let mesh: THREE.Mesh;

        if (shape instanceof CANNON.Box) {
            const halfExtents = shape.halfExtents;
            const geometry = new THREE.BoxGeometry(halfExtents.x * 2, halfExtents.y * 2, halfExtents.z * 2);
            mesh = new THREE.Mesh(geometry, material);
        } else if (shape instanceof CANNON.Sphere) {
            const geometry = new THREE.SphereGeometry(shape.radius, 8, 8);
            mesh = new THREE.Mesh(geometry, material);
        } else {
            // Für andere Shapes kann der Debugger erweitert werden
            return;
        }

        // Position und Rotation des Shapes relativ zum Body übernehmen
        const offset = body.shapeOffsets[i];
        const orientation = body.shapeOrientations[i];
        mesh.position.copy(offset as unknown as THREE.Vector3);
        mesh.quaternion.copy(orientation as unknown as THREE.Quaternion);

        group.add(mesh);
    });

    scene.add(group);
    return group;
}