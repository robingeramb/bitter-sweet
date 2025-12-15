<template>
  <div class="overflow-hidden relative bg-neutral-950 h-screen w-full">
    <div class="endscreen w-full flex flex-col">
      <div
        ref="thirdText"
        class="z-20 opacity-0 left-1/2 -translate-x-1/2 top-1/2 text-white font-medium -translate-y-1/2 text-center absolute"
      >
        <div class="bg-orange-500 py-4 px-8 rounded-full text-4xl">
          try again
        </div>
      </div>
      <div
        class="flex items-center justify-center headlineContainer text-white"
      >
        <div ref="secondText" class="opacity-0 z-10 text-center absolute">
          <h1 class="text-3xl font-light text-center max-w-[40rem] mb-12">
            Grocerys are filled with sugar and we often dont even know about it.
          </h1>
          <p class="text-3xl font-light mb-8 text-center text-white">
            We gave you a relatable scenario <br />to visualise it for you:
          </p>
        </div>

        <div ref="firstText" class="opacity-0 z-10 absolute">
          <h1 class="text-7xl text-center max-w-[40rem] mb-2">Awesome!</h1>
          <h1 class="text-3xl font-light text-center max-w-[40rem] mb-6">
            You have successfully completed <br />
            your grocery shopping.
          </h1>
          <p
            class="text-2xl font-semibold text-orange-500 mt-16 text-center text-white"
          >
            But at what cost?
          </p>
        </div>
      </div>
      <div
        class="flex flex-col z-10 items-center justify-center w-full absolute"
        ref="receipt"
      >
        <Receipt ref="receiptComp" />
      </div>

      <div
        ref="dailyLimit"
        class="flex z-10 top-1/2 -translate-y-1/2 flex-col items-center w-full absolute justify-center"
      >
        <DailyLimitDisplay :formattedText="formattedText" />
        <Button
          v-if="showConsequences"
          @click="restartFunction()"
          :text="'restart'"
          class="mb-40"
        />
      </div>
      <div ref="consequences" class="opacity-0 z-20">
        <Consequences
          ref="conseqComp"
          class="absolute left-1/2 -translate-x-1/2 z-20 top-[130px]"
          :consList="consList"
        />
      </div>

      <div
        v-if="currSlide >= 3"
        class="flex top-1/2 -translate-y-1/2 flex-col items-center w-full absolute justify-center"
      >
        <SugarCubes :amount="Math.round(sugarCounter / 3 / 3)" />
      </div>
    </div>
    <div
      class="asideSection flex flex-col gap-4 left-10 z-20 absolute top-1/2 -translate-y-1/2"
    >
      <div
        v-for="(items, index) in 5"
        @click="setCurrSlide(index)"
        :class="currSlide == index ? 'opacity-100' : 'opacity-50'"
        class="point cursor-pointer bg-white w-3 h-3 rounded-full"
      ></div>
    </div>
  </div>
  <div
    class="bottomShadow fixed left-0 w-full bottom-0 z-50 h-80 bg-gradient-to-t from-black"
  >
    <div
      v-if="currSlide != 4"
      @click="next()"
      class="absolute cursor-pointer select-none bottom-14 inline-block left-1/2 flex flex-col items-center justify-center -translate-x-1/2 text-white"
    >
      <p class="text-xl">continue</p>
      <svg xmlns="http://www.w3.org/2000/svg" class="h-14" viewBox="0 0 24 24">
        <path
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 5v14m4-4l-4 4m-4-4l4 4"
        />
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import gsap from "gsap";
import { useSugarEffects } from "~/stores/effects";
const receipt = ref();
const receiptComp = ref();
const conseqComp = ref();
const dailyLimit = ref();
const secondText = ref();
const firstText = ref();
const thirdText = ref();
const consequences = ref();
const effectsStore = useSugarEffects();
const effectList = effectsStore.effects;
const productCount = productsInCartData.length;
let showTitel = true;
let showMainTitel = true;
let formattedText: string;
const showConsequences = ref(false);
const consList = ref([]);
const currSlide = ref(0);
const prevSlide = ref(0);

function setCurrSlide(index: number) {
  currSlide.value = index;
  if (currSlide.value == 0) {
    gsap.to(firstText.value, {
      opacity: 1,
      delay: 0.75,
      duration: 0.75, // Kürzerer Zeitraum für den Rest
      ease: "power3.out", // Schnellerer Verlauf am Ende
    });
    gsap.to(secondText.value, {
      opacity: 0,
      duration: 0.75, // Kürzerer Zeitraum für den Rest
      ease: "power3.out", // Schnellerer Verlauf am Ende
    });
  }
  if (currSlide.value >= 1) {
    gsap.to(firstText.value, {
      opacity: 0,
      duration: 0.75, // Kürzerer Zeitraum für den Rest
      ease: "power3.out", // Schnellerer Verlauf am Ende
    });
  }
  if (currSlide.value == 1) {
    gsap.to(secondText.value, {
      opacity: 1,
      delay: 0.75,
      duration: 0.75, // Kürzerer Zeitraum für den Rest
      ease: "power3.out", // Schnellerer Verlauf am Ende
    });
  }
  if (currSlide.value < 2 && prevSlide.value > currSlide.value) {
    gsap.to(receipt.value, {
      bottom: 300 - receipt.value.offsetHeight,
      duration: 1,
      delay: 0.5,
    });
    gsap.to(dailyLimit.value, {
      opacity: 0,
      duration: 1, // Kürzerer Zeitraum für den Rest
      ease: "power3.out", // Schnellerer Verlauf am Ende
    });
    receiptComp.value.fadeBack(1);
    showConsequences.value = false;
  }
  if (currSlide.value == 2 && prevSlide.value < currSlide.value) {
    scrollToReceipt();
    //showConsequences.value = true;
  }
  if (currSlide.value < 4) {
    gsap.to(thirdText.value, {
      opacity: 0,
      delay: 0.75,
      duration: 0.75, // Kürzerer Zeitraum für den Rest
      ease: "power3.out", // Schnellerer Verlauf am Ende
    });
  }
  if (currSlide.value < 3) {
    gsap.to(receipt.value, {
      y: 0,
      duration: 0.75, // Kürzerer Zeitraum für den Rest
      ease: "power3.out", // Schnellerer Verlauf am Ende
    });
    gsap.to(dailyLimit.value, {
      y: 0,

      duration: 0.75, // Kürzerer Zeitraum für den Rest
      ease: "power3.out", // Schnellerer Verlauf am Ende
    });
  }
  if (currSlide.value == 3 && prevSlide.value < currSlide.value) {
    scrollToCanvas();
    //showConsequences.value = true;
  }
  if (currSlide.value < 3 && prevSlide.value > currSlide.value) {
    gsap.to(consequences.value, {
      opacity: 0,
      delay: 0,
      duration: 0.75, // Kürzerer Zeitraum für den Rest
      ease: "power3.out", // Schnellerer Verlauf am Ende
      onComplete: () => {
        conseqComp.value.fadeBack(5);
      },
    });
  }
  prevSlide.value = currSlide.value;
}

onMounted(() => {
  gsap.to(receipt.value, {
    bottom: 300 - receipt.value.offsetHeight,
    duration: 0,
  });
  gsap.to(dailyLimit.value, {
    opacity: 0,
    duration: 0, // Kürzerer Zeitraum für den Rest
    ease: "power3.out", // Schnellerer Verlauf am Ende
  });
  gsap.to(firstText.value, {
    opacity: 1,
    duration: 0.75, // Kürzerer Zeitraum für den Rest
    ease: "power3.out", // Schnellerer Verlauf am Ende
  });
});

function next() {
  currSlide.value++;
  prevSlide.value = currSlide.value;
  if (currSlide.value == 1) {
    gsap.to(firstText.value, {
      opacity: 0,
      duration: 0.75, // Kürzerer Zeitraum für den Rest
      ease: "power3.out", // Schnellerer Verlauf am Ende
    });
    gsap.to(secondText.value, {
      opacity: 1,
      delay: 0.75,
      duration: 0.75, // Kürzerer Zeitraum für den Rest
      ease: "power3.out", // Schnellerer Verlauf am Ende
    });
  }
  if (currSlide.value == 2) {
    scrollToReceipt();
    //showConsequences.value = true;
  }
  if (currSlide.value == 3) {
    scrollToCanvas();
    //showConsequences.value = true;
  }
  if (currSlide.value == 4) {
    gsap.to(thirdText.value, {
      opacity: 1,
      delay: 0.75,
      duration: 0.75, // Kürzerer Zeitraum für den Rest
      ease: "power3.out", // Schnellerer Verlauf am Ende
    });
    gsap.to(consequences.value, {
      opacity: 0,
      delay: 0,
      duration: 0.75, // Kürzerer Zeitraum für den Rest
      ease: "power3.out", // Schnellerer Verlauf am Ende
      onComplete: () => {
        conseqComp.value.startFadeIn(5);
      },
    });
  }
}

function back() {
  currSlide.value--;
  if (currSlide.value < 2) {
    gsap.to(receipt.value, {
      bottom: 300 - receipt.value.offsetHeight,
      duration: 1,
    });
    //showConsequences.value = false;
  }
}

function scrollToCanvas() {
  gsap.to(receipt.value, {
    y: -1000,
    duration: 2, // Kürzerer Zeitraum für den Rest
    ease: "power3.out", // Schnellerer Verlauf am Ende
  });
  gsap.to(dailyLimit.value, {
    y: -1000,
    duration: 2, // Kürzerer Zeitraum für den Rest
    ease: "power3.out", // Schnellerer Verlauf am Ende
  });
  gsap.to(consequences.value, {
    opacity: 1,
    delay: 6,
    duration: 0.75, // Kürzerer Zeitraum für den Rest
    ease: "power3.out", // Schnellerer Verlauf am Ende
    onComplete: () => {
      conseqComp.value.startFadeIn(5);
    },
  });
}

function scrollToAgain() {
  gsap.to(receipt.value, {
    y: -1000,
    duration: 2, // Kürzerer Zeitraum für den Rest
    ease: "power3.out", // Schnellerer Verlauf am Ende
  });
  gsap.to(dailyLimit.value, {
    y: -1000,
    duration: 2, // Kürzerer Zeitraum für den Rest
    ease: "power3.out", // Schnellerer Verlauf am Ende
  });
  gsap.to(consequences.value, {
    opacity: 1,
    delay: 6,
    duration: 0.75, // Kürzerer Zeitraum für den Rest
    ease: "power3.out", // Schnellerer Verlauf am Ende
    onComplete: () => {
      conseqComp.value.startFadeIn(5);
    },
  });
}

function scrollToReceipt() {
  gsap.to(secondText.value, {
    opacity: 0,
    duration: 0.75, // Kürzerer Zeitraum für den Rest
    ease: "power3.out", // Schnellerer Verlauf am Ende
  });
  gsap.to(receipt.value, {
    bottom: window.innerHeight - 500,
    duration: receipt.value.offsetHeight / 100,
    ease: "linear",
    onComplete: () => {
      // Zweiter Teil der Animation
      gsap.to(receipt.value, {
        bottom: window.innerHeight - 200,
        duration: 1.2, // Kürzerer Zeitraum für den Rest
        ease: "power3.out", // Schnellerer Verlauf am Ende
      });
      gsap.to(dailyLimit.value, {
        opacity: 1,
        delay: 0.7,
        duration: 0.75, // Kürzerer Zeitraum für den Rest
        ease: "power3.out", // Schnellerer Verlauf am Ende
      });
    },
  });

  receiptComp.value.startFadeIn(6);
}

function scrollToChild() {
  const child = receipt.value?.$el || receipt.value; // Zugriff auf das DOM-Element der Child-Komponente
  if (!child) {
    return;
  }

  const offset = 300; // Offset von -20 Pixel
  const targetPosition = child.getBoundingClientRect().top + window.scrollY;

  // Scrollen mit Smooth-Animation
  window.scrollTo({
    top: targetPosition,
    behavior: "smooth",
  });
}

//Checken ob Zuckerergebnis in einem Bereich liegt
function findSugarRange() {
  let found = false;
  let current;
  let sugarPerPerson = Math.round(sugarCounter.value / 3);

  for (let i = 0; i < effectList.length; i++) {
    current = effectList[i];

    if (
      sugarPerPerson >= current.sugarMinAmount &&
      sugarPerPerson <= current.sugarMaxAmount
    ) {
      consList.value.push(current);
      found = true;
    }
  }

  if (!found) {
    console.log(
      `sugarPerPerson (${sugarPerPerson}) liegt in keinem definierten Bereich.`
    );
  }
}
findSugarRange();

function addParagraphsToString(text: string, maxLength: number): string {
  let result = "<p>"; // Beginne mit einem Absatz
  let currentLength = 0;
  let currentWord = "";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (
      char === " " ||
      char === "." ||
      char === "," ||
      char === "!" ||
      char === "?"
    ) {
      currentWord += char;
      result += currentWord;
      currentLength += currentWord.length;

      if (currentLength >= maxLength) {
        result += "</p><p>"; // Neuen HTML-Absatz hinzufügen
        currentLength = 0;
      }
      currentWord = "";
    } else {
      currentWord += char;
    }
  }

  if (currentWord) {
    result += currentWord;
  }
  result += "</p>"; // Letzten Absatz schließen

  return result;
}

//Check how many items in cart and response dynamic layout

if (productCount > 5) {
  showTitel = false;
  showMainTitel = false;
} else if (productCount > 3) {
  showTitel = false;
  showMainTitel = true;
} else {
  showTitel = true;
  showMainTitel = true;
}

const emit = defineEmits(["restartFunction"]);

function restartFunction() {
  emit("restartFunction");
  endScreen.value = false;
  sugarCounter.value = 0;
}
</script>

<style>
.headlineContainer {
  height: calc(100vh - 250px);
}
</style>
