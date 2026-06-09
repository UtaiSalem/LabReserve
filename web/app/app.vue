<script setup lang="ts">
const { app } = useAppConfig()

useSeoMeta({
  title: `${app.name} — ${app.tagline}`,
  description: `${app.tagline} ${app.university}`
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
