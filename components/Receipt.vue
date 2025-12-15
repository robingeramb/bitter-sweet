<template>
  <div>
    <ul
      class="px-10 py-10 bg-white rounded-md mb-8 max-w-[400px] mx-5 receipt-list"
      ref="receiptList"
    >
      <p class="text-2xl font-semibold text-slate-950">Your receipt</p>
      <div
        class="border-t border-dashed border-gray-500 mb-4 mt-2 -mx-10"
      ></div>
      <li class="mb-4" v-for="(child, index) in productsInCartData" :key="index">
        <p class="text-slate-800 text-xs">
          {{ child.amount }}g {{ child.productName || "Unbenannt" }}
          <span class="">:</span>
        </p>
        <p class="text-red-900 opacity-0">
          {{ Math.round(child.sugarAmount) }}g sugar / ≈
          {{ Math.round(child.sugarAmount / 3) }}g per person
        </p>
      </li>
      <div
        class="border-t border-dashed border-gray-500 mb-4 mt-2 -mx-10"
      ></div>
      <p class="text-5xl opacity-0 font-bold text-red-800">
        <span>{{ Math.round(sugarCounter) }}</span
        >g sugar
      </p>
      <p class="m-3 opacity-0 text-red-800">
        ≈ {{ Math.round(sugarCounter / 3) }}g per person.
      </p>
    </ul>
  </div>
</template>

<script lang="ts" setup>
import gsap from "gsap";
import { productsInCartData, sugarCounter } from "@/composables/useThree";

const receiptList = ref<HTMLUListElement | null>(null);

function startFadeIn(totalTime: number) {
  const elements = receiptList.value?.querySelectorAll(".opacity-0");

  if (elements) {
    gsap.to(elements, {
      opacity: 1,
      stagger: totalTime / elements.length, // Zeitverzögerung zwischen den Elementen
      duration: 0.75, // Dauer der Animation pro Element
    });
  }
}

function fadeBack(totalTime: number) {
  const elements = receiptList.value?.querySelectorAll(".opacity-0");

  if (elements) {
    const totalElements = elements.length;

    gsap.to(elements, {
      opacity: 0,
      stagger: (index) =>
        (totalElements - 1 - index) * (totalTime / totalElements), // Umgekehrte Verzögerung
      duration: 0.5, // Dauer der Animation pro Element
    });
  }
}

defineExpose({ startFadeIn, fadeBack });
</script>
