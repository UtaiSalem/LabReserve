<script setup lang="ts">
withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showText?: boolean
  inverted?: boolean
}>(), {
  size: 'md',
  showText: true,
  inverted: false
})

const { app } = useAppConfig()

const sizeMap = {
  sm: { box: 'w-7 h-7', text: 'text-sm', sub: 'text-[10px]' },
  md: { box: 'w-9 h-9', text: 'text-base', sub: 'text-xs' },
  lg: { box: 'w-12 h-12', text: 'text-lg', sub: 'text-xs' },
  xl: { box: 'w-20 h-20', text: 'text-2xl', sub: 'text-sm' }
}
</script>

<template>
  <div class="flex items-center gap-3">
    <div
      :class="[
        sizeMap[size].box,
        inverted ? 'bg-white text-(--ui-primary)' : 'bg-(--ui-primary) text-white',
        'rounded-xl flex items-center justify-center font-bold shadow-sm ring-1 ring-(--ui-primary)/20'
      ]"
    >
      <UIcon name="i-lucide-flask-conical" class="w-1/2 h-1/2" />
    </div>
    <div
      v-if="showText"
      class="flex flex-col leading-tight"
    >
      <span :class="[sizeMap[size].text, 'font-bold tracking-tight', inverted ? 'text-white' : 'text-(--ui-text-highlighted)']">
        {{ app.name }}
      </span>
      <span :class="[sizeMap[size].sub, inverted ? 'text-white/80' : 'text-(--ui-text-muted)']">
        {{ app.university }}
      </span>
    </div>
  </div>
</template>
