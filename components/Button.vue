<template>
  <div
    class="select-none border border-gray-400 rounded-xl font-medium text-2xl text-gray-100 bg-gray-700 bg-opacity-70 hover:cursor-pointer hover:bg-gray-600 backdrop-blur-md px-10 py-5 flex items-center justify-center text-center transition-colors"
    :class="{ 'pointer-events-none opacity-80': loading }"
  >
    <span v-if="!loading">{{ props.text }}</span>
    <div v-else class="spinner"></div>
  </div>
</template>

<script lang="ts" setup>
interface Props {
  text: String;
  loading?: boolean;
}

const props = defineProps<Props>();
</script>

<style scoped>
.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: #fff;
  animation: spin 1s ease-in-out infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
