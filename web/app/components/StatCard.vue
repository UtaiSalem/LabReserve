<script setup lang="ts">
defineProps<{
  label: string
  value: number | string
  icon?: string
  color?: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral'
  hint?: string
  to?: string
}>()

const colorClass = {
  primary: 'bg-(--ui-primary)/10 text-(--ui-primary)',
  success: 'bg-(--color-forest-50) text-(--color-forest-700) dark:bg-(--color-forest-950) dark:text-(--color-forest-300)',
  warning: 'bg-(--color-gold-50) text-(--color-gold-700) dark:bg-(--color-gold-950) dark:text-(--color-gold-300)',
  error: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
  info: 'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  neutral: 'bg-(--ui-bg-elevated) text-(--ui-text)'
} as const
</script>

<template>
  <NuxtLink
    v-if="to"
    :to="to"
    class="block rounded-xl border border-(--ui-border) bg-(--ui-bg) p-4 hover:border-(--ui-primary)/40 transition-colors"
  >
    <div class="flex items-start gap-3">
      <div
        v-if="icon"
        :class="['w-10 h-10 rounded-lg flex items-center justify-center shrink-0', colorClass[color || 'neutral']]"
      >
        <UIcon :name="icon" class="w-5 h-5" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-xs text-(--ui-text-muted) truncate">
          {{ label }}
        </p>
        <p class="text-2xl font-semibold text-(--ui-text-highlighted)">
          {{ value }}
        </p>
        <p v-if="hint" class="text-xs text-(--ui-text-muted) mt-0.5 truncate">
          {{ hint }}
        </p>
      </div>
    </div>
  </NuxtLink>
  <div
    v-else
    class="block rounded-xl border border-(--ui-border) bg-(--ui-bg) p-4"
  >
    <div class="flex items-start gap-3">
      <div
        v-if="icon"
        :class="['w-10 h-10 rounded-lg flex items-center justify-center shrink-0', colorClass[color || 'neutral']]"
      >
        <UIcon :name="icon" class="w-5 h-5" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-xs text-(--ui-text-muted) truncate">
          {{ label }}
        </p>
        <p class="text-2xl font-semibold text-(--ui-text-highlighted)">
          {{ value }}
        </p>
        <p v-if="hint" class="text-xs text-(--ui-text-muted) mt-0.5 truncate">
          {{ hint }}
        </p>
      </div>
    </div>
  </div>
</template>
