<script setup lang="ts">
defineProps<{
  icon?: string
  title: string
  description?: string
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center text-center py-12 px-4">
    <div class="w-14 h-14 rounded-full bg-(--ui-bg-elevated) flex items-center justify-center mb-4">
      <UIcon :name="icon || 'i-lucide-inbox'" class="w-7 h-7 text-(--ui-text-muted)" />
    </div>
    <p class="text-base font-medium text-(--ui-text-highlighted)">
      {{ title }}
    </p>
    <p v-if="description" class="text-sm text-(--ui-text-muted) mt-1 max-w-md">
      {{ description }}
    </p>
    <div v-if="$slots.action" class="mt-4">
      <slot name="action" />
    </div>
  </div>
</template>
