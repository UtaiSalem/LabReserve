<script setup lang="ts">
withDefaults(defineProps<{
  icon?: string
  title: string
  description: string
  ctaLabel?: string
  ctaTo?: string
}>(), {
  icon: 'i-lucide-construction'
})
</script>

<template>
  <UCard>
    <EmptyState
      :icon="icon"
      :title="title"
      :description="description"
    >
      <template v-if="ctaLabel && ctaTo" #action>
        <UButton :to="ctaTo" icon="i-lucide-arrow-left">
          {{ ctaLabel }}
        </UButton>
      </template>
    </EmptyState>
  </UCard>
</template>
