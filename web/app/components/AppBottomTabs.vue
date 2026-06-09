<script setup lang="ts">
const { mobileTabs } = useNav()
const route = useRoute()

function isActive(to: string) {
  if (to === '/') return route.path === '/'
  return route.path === to || route.path.startsWith(to + '/')
}
</script>

<template>
  <nav
    v-if="mobileTabs.length"
    class="md:hidden fixed bottom-0 inset-x-0 z-30 h-16 border-t border-(--ui-border) bg-(--ui-bg) flex"
  >
    <NuxtLink
      v-for="tab in mobileTabs"
      :key="tab.to"
      :to="tab.to"
      class="flex-1 flex flex-col items-center justify-center gap-1 text-xs"
      :class="isActive(tab.to) ? 'text-(--ui-primary) font-medium' : 'text-(--ui-text-muted)'"
    >
      <UIcon :name="tab.icon" class="w-5 h-5" />
      <span class="truncate max-w-full px-1">{{ tab.label }}</span>
    </NuxtLink>
  </nav>
</template>
