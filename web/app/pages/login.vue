<script setup lang="ts">
definePageMeta({
  layout: 'auth'
})

const { login, homePath } = useAuth()

const form = reactive({
  username: '',
  password: ''
})
const loading = ref(false)
const errorMsg = ref<string | null>(null)
const toast = useToast()

async function onSubmit() {
  if (!form.username || !form.password) {
    errorMsg.value = 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน'
    return
  }
  errorMsg.value = null
  loading.value = true
  try {
    await login(form.username, form.password)
    toast.add({
      title: 'เข้าสู่ระบบสำเร็จ',
      icon: 'i-lucide-check-circle',
      color: 'success'
    })
    await navigateTo(homePath.value, { replace: true })
  } catch (err: unknown) {
    const e = err as { data?: { error?: string }, status?: number }
    if (e?.status === 429) {
      errorMsg.value = 'พยายามเข้าระบบบ่อยเกินไป กรุณารอสักครู่'
    } else if (e?.status === 401) {
      errorMsg.value = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'
    } else {
      const raw = e?.data?.error
      errorMsg.value = typeof raw === 'string' && raw ? raw : 'เกิดข้อผิดพลาด กรุณาลองใหม่ (ตรวจสอบว่า backend รันอยู่ที่ port 8775)'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="space-y-2">
      <h2 class="text-2xl font-semibold text-(--ui-text-highlighted)">
        เข้าสู่ระบบ
      </h2>
      <p class="text-sm text-(--ui-text-muted)">
        ใช้บัญชีของมหาวิทยาลัยเพื่อเข้าใช้ระบบจองเครื่องมือ
      </p>
    </div>

    <UAlert
      v-if="errorMsg"
      :title="errorMsg"
      color="error"
      variant="soft"
      icon="i-lucide-alert-circle"
    />

    <form class="space-y-4" @submit.prevent="onSubmit">
      <UFormField label="ชื่อผู้ใช้ หรือ อีเมล" name="username" required>
        <UInput
          v-model="form.username"
          icon="i-lucide-user"
          placeholder="username@skru.ac.th"
          autocomplete="username"
          size="lg"
          class="w-full"
        />
      </UFormField>

      <UFormField label="รหัสผ่าน" name="password" required>
        <UInput
          v-model="form.password"
          type="password"
          icon="i-lucide-lock"
          placeholder="••••••••"
          autocomplete="current-password"
          size="lg"
          class="w-full"
        />
      </UFormField>

      <div class="flex items-center justify-between text-sm">
        <UCheckbox label="จดจำฉัน" />
      </div>

      <UButton
        type="submit"
        block
        size="lg"
        :loading="loading"
        icon="i-lucide-log-in"
      >
        เข้าสู่ระบบ
      </UButton>
    </form>

    <p class="text-xs text-center text-(--ui-text-muted)">
      หากพบปัญหาการเข้าใช้งาน โปรดติดต่อผู้ดูแลระบบ
    </p>
  </div>
</template>
