import * as THREE from "three";

import { camera, taskDone, endScreen } from "@/composables/useThree";
let clickedObject;
const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

export function clickCheckout(event, selectedCheckout) {

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    let intersects = raycaster.intersectObjects([selectedCheckout]);

    if(intersects.length > 0) {
        clickedObject = intersects[0].object;
        if(taskDone.value == true) {
            endScreen.value = true;
        }
    }
}