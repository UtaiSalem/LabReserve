<script setup lang="ts">
definePageMeta({
  layout: false
})

const { user, homePath } = useAuth()

if (user.value) {
  await navigateTo(homePath.value, { replace: true })
} else {
  await navigateTo('/login', { replace: true })
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center">
    <UIcon name="i-lucide-loader-circle" class="w-8 h-8 animate-spin text-(--ui-primary)" />
  </div>
</template>
