<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
    <div>
      <h1 class="text-xl md:text-2xl font-semibold text-(--ui-text-highlighted)">
        {{ title }}
      </h1>
      <p v-if="subtitle" class="text-sm text-(--ui-text-muted) mt-1">
        {{ subtitle }}
      </p>
    </div>
    <div v-if="$slots.actions" class="flex flex-wrap gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
