<template>
  <div
    class="select-none border border-gray-400 rounded-xl font-medium text-2xl text-gray-100 bg-gray-700 bg-opacity-70 hover:cursor-pointer hover:bg-gray-600 backdrop-blur-md px-10 py-5 flex items-center justify-center text-center transition-colors"
  >
    {{ props.text }}
  </div>
</template>

<script lang="ts" setup>
interface Props {
  text: String;
}

const props = defineProps<Props>();
</script>

<style></style>
