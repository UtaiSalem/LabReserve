<script setup lang="ts">
const { items } = useNav()
const { user, logout } = useAuth()
</script>

<template>
  <aside class="h-full w-64 flex flex-col bg-(--ui-bg) border-r border-(--ui-border)">
    <div class="p-5 border-b border-(--ui-border)">
      <NuxtLink to="/" class="block">
        <BrandLogo size="md" />
      </NuxtLink>
    </div>

    <nav class="flex-1 p-3 space-y-1 overflow-y-auto">
      <UButton
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        :icon="item.icon"
        :label="item.label"
        color="neutral"
        variant="ghost"
        block
        class="justify-start"
        active-class="!bg-(--ui-primary)/10 !text-(--ui-primary) font-medium"
      />
    </nav>

    <div class="p-3 border-t border-(--ui-border) space-y-2">
      <div class="flex items-center gap-3 px-2 py-2">
        <UAvatar
          :alt="user?.name || user?.username"
          size="sm"
          :src="undefined"
        />
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium truncate text-(--ui-text-highlighted)">
            {{ user?.name || user?.username }}
          </p>
          <p class="text-xs text-(--ui-text-muted) truncate">
            {{ user?.email }}
          </p>
        </div>
      </div>
      <UButton
        icon="i-lucide-log-out"
        label="ออกจากระบบ"
        color="neutral"
        variant="ghost"
        block
        class="justify-start"
        @click="logout"
      />
    </div>
  </aside>
</template>
