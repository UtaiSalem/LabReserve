<script setup lang="ts">
const { app } = useAppConfig()
</script>

<template>
  <div class="min-h-screen flex flex-col md:flex-row bg-(--ui-bg)">
    <!-- Brand panel: desktop only -->
    <aside
      class="hidden md:flex md:w-1/2 lg:w-2/5 relative overflow-hidden flex-col justify-between p-12 text-white"
      :style="{ background: 'linear-gradient(135deg, var(--color-skru-900) 0%, var(--color-skru-700) 60%, var(--color-forest-800) 100%)' }"
    >
      <div class="relative z-10">
        <BrandLogo size="xl" inverted />
      </div>

      <div class="relative z-10 space-y-3 max-w-sm">
        <div class="w-12 h-[2px] bg-(--color-gold-400)" />
        <h1 class="text-3xl font-semibold leading-snug">
          {{ app.tagline }}
        </h1>
        <p class="text-white/80 text-sm leading-relaxed">
          จองเครื่องมือวิทยาศาสตร์ออนไลน์ ติดตามสถานะคำขอ
          และประสานงานกับเจ้าหน้าที่ห้องปฏิบัติการได้ในที่เดียว
        </p>
      </div>

      <div class="relative z-10 text-xs text-white/60">
        © {{ new Date().getFullYear() }} {{ app.university }}
      </div>

      <!-- decorative orbs -->
      <div class="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-(--color-gold-500)/10 blur-3xl" />
      <div class="absolute -bottom-40 -left-20 w-96 h-96 rounded-full bg-(--color-forest-500)/10 blur-3xl" />
    </aside>

    <!-- Form panel -->
    <main class="flex-1 flex items-center justify-center p-6 md:p-12">
      <div class="w-full max-w-md">
        <!-- Mobile brand -->
        <div class="md:hidden flex justify-center mb-8">
          <BrandLogo size="lg" />
        </div>

        <slot />
      </div>
    </main>
  </div>
</template>
