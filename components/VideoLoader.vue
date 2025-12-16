<template>
  <div class="video-loader-fullscreen">
    <!-- NEU: Wir verwenden zwei Video-Elemente für nahtloses Preloading -->
    <video
      ref="videoPlayerA"
      playsinline
      :class="{ 'fullscreen-video': true, 'hidden-video': !isPlayerAActive }"
      @ended="onVideoEnded"
    ></video>
    <video
      ref="videoPlayerB"
      playsinline
      :class="{ 'fullscreen-video': true, 'hidden-video': isPlayerAActive }"
      @ended="onVideoEnded"
    ></video>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";

// NEU: Props für die Videos
const props = defineProps<{
  videos: string[];
}>();

const emit = defineEmits(["video-finished"]);

const videoPlayerA = ref<HTMLVideoElement | null>(null);
const videoPlayerB = ref<HTMLVideoElement | null>(null);

// const videos = ["/videos/Szene1.webm", "/videos/Szene2.webm", "/videos/Szene3.webm"]; // Entfernt, da jetzt über Props
const currentVideoIndex = ref(0);
const isPlayerAActive = ref(true);

// NEU: Hilfsfunktion für eine kurze Pause
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const activePlayer = computed(() => isPlayerAActive.value ? videoPlayerA.value : videoPlayerB.value);

onMounted(() => {
  // Starte das erste Video
  if (videoPlayerA.value) {
    videoPlayerA.value.src = props.videos[0];
    videoPlayerA.value.load();
    videoPlayerA.value.play().catch((e: any) => console.error("Autoplay für Video 1 fehlgeschlagen:", e));
    // Lade das zweite Video sofort vor
    preloadNextVideo();
  }
});

const preloadNextVideo = () => {
  const nextIndex = currentVideoIndex.value + 1;
  if (nextIndex < props.videos.length) {
    const inactivePlayer = isPlayerAActive.value ? videoPlayerB.value : videoPlayerA.value;
    if (inactivePlayer) {
      inactivePlayer.src = props.videos[nextIndex];
      inactivePlayer.load();
    }
  }
};

const onVideoEnded = async () => {
  // Blende das gerade beendete Video aus
  if (activePlayer.value) {
    activePlayer.value.style.opacity = '0';
  }
  await sleep(500); // Warte 500ms (schwarzer Bildschirm)

  currentVideoIndex.value++;

  if (currentVideoIndex.value < props.videos.length) {
    isPlayerAActive.value = !isPlayerAActive.value;
    const newActivePlayer = isPlayerAActive.value ? videoPlayerA.value : videoPlayerB.value;
    if (newActivePlayer) {
      newActivePlayer.style.opacity = "1"; // Blende das neue Video ein
      newActivePlayer.play().catch((e: any) => console.error(`Abspielen von Video ${currentVideoIndex.value + 1} fehlgeschlagen:`, e));
      // Lade das *übernächste* Video vor
      preloadNextVideo();
    }
  } else {
    emit("video-finished");
  }
};
</script>

<style>
.video-loader-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: black;
  z-index: 9999;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden; /* Verhindert, dass Scrollbalken während des Übergangs erscheinen */
}

.fullscreen-video {
  width: 100%;
  height: 100%;
  object-fit: cover; /* Stellt sicher, dass das Video den gesamten Bildschirm ausfüllt */
  /* NEU: Hinweis für Hardware-Beschleunigung zur Entlastung der CPU */
  transform: translateZ(0);
  transition: opacity 0.5s ease-in-out; /* Übergangsdauer auf 500ms erhöht */
}

.hidden-video {
  opacity: 0;
  position: absolute;
  pointer-events: none; /* Verhindert Interaktion mit dem unsichtbaren Video */
}
</style>