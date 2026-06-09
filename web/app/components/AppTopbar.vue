<script setup lang="ts">
defineProps<{
  title?: string
  subtitle?: string
}>()

const emit = defineEmits<{
  openSidebar: []
}>()

const { user, logout, role } = useAuth()

const roleLabel: Record<string, string> = {
  requester: 'ผู้ใช้บริการ',
  approver: 'ผู้อนุมัติ',
  staff: 'เจ้าหน้าที่',
  admin: 'ผู้ดูแลระบบ'
}

const userMenu = computed(() => [
  [{
    label: user.value?.name || user.value?.username || '',
    slot: 'account',
    disabled: true
  }],
  [{
    label: 'โปรไฟล์',
    icon: 'i-lucide-user',
    to: '/profile'
  }],
  [{
    label: 'ออกจากระบบ',
    icon: 'i-lucide-log-out',
    onSelect: () => logout()
  }]
])
</script>

<template>
  <header class="h-16 md:h-16 border-b border-(--ui-border) bg-(--ui-bg) sticky top-0 z-30">
    <div class="h-full px-4 md:px-6 flex items-center gap-3">
      <!-- mobile hamburger -->
      <UButton
        icon="i-lucide-menu"
        color="neutral"
        variant="ghost"
        size="md"
        class="md:hidden"
        aria-label="เปิดเมนู"
        @click="emit('openSidebar')"
      />

      <!-- mobile brand -->
      <NuxtLink to="/" class="md:hidden flex-1">
        <BrandLogo size="sm" :show-text="true" />
      </NuxtLink>

      <!-- desktop page title -->
      <div class="hidden md:block flex-1 min-w-0">
        <h1 v-if="title" class="text-lg font-semibold text-(--ui-text-highlighted) truncate">
          {{ title }}
        </h1>
        <p v-if="subtitle" class="text-sm text-(--ui-text-muted) truncate">
          {{ subtitle }}
        </p>
      </div>

      <div class="flex items-center gap-1 md:gap-2">
        <!-- desktop: popover dropdown -->
        <div class="hidden md:block">
          <NotificationDropdown />
        </div>
        <!-- mobile: full sheet -->
        <div class="md:hidden">
          <NotificationSheet />
        </div>

        <UDropdownMenu :items="userMenu">
          <UButton
            color="neutral"
            variant="ghost"
            class="!px-2"
          >
            <UAvatar :alt="user?.name || user?.username" size="xs" />
            <span class="hidden md:inline text-sm">
              {{ user?.name || user?.username }}
            </span>
            <UBadge
              v-if="role"
              :label="roleLabel[role] || role"
              color="primary"
              variant="subtle"
              size="sm"
              class="hidden lg:inline-flex"
            />
            <UIcon name="i-lucide-chevron-down" class="w-4 h-4 hidden md:inline" />
          </UButton>
        </UDropdownMenu>
      </div>
    </div>
  </header>
</template>
