<script setup lang="ts">
definePageMeta({
  middleware: 'role',
  roles: ['requester', 'approver', 'staff', 'admin'],
  pageTitle: 'โปรไฟล์',
  pageSubtitle: 'ข้อมูลบัญชีผู้ใช้งานและสิทธิ์การเข้าถึง'
})

const { user, homePath, role } = useAuth()

const roleLabel: Record<string, string> = {
  requester: 'ผู้ใช้งานบริการ',
  approver: 'ผู้อนุมัติ',
  staff: 'เจ้าหน้าที่',
  admin: 'ผู้ดูแลระบบ'
}

const profileFields = computed(() => [
  { label: 'ชื่อผู้ใช้', value: user.value?.username || '-' },
  { label: 'ชื่อ - นามสกุล', value: user.value?.name || '-' },
  { label: 'อีเมล', value: user.value?.email || '-' },
  { label: 'แผนก', value: user.value?.department || '-' },
  { label: 'บทบาท', value: role.value ? (roleLabel[role.value] || role.value) : '-' }
])
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="โปรไฟล์ผู้ใช้งาน"
      subtitle="ตรวจสอบข้อมูลพื้นฐานของบัญชีที่กำลังใช้งานอยู่"
    />

    <UCard>
      <div class="flex flex-col gap-6 md:flex-row md:items-start">
        <div class="flex items-center gap-4">
          <UAvatar
            :alt="user?.name || user?.username"
            size="3xl"
          />
          <div>
            <p class="text-lg font-semibold text-(--ui-text-highlighted)">
              {{ user?.name || user?.username }}
            </p>
            <p class="text-sm text-(--ui-text-muted)">
              {{ user?.email || 'ยังไม่ได้ระบุอีเมล' }}
            </p>
          </div>
        </div>

        <div class="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
          <div
            v-for="field in profileFields"
            :key="field.label"
            class="rounded-lg border border-(--ui-border) bg-(--ui-bg-elevated) px-4 py-3"
          >
            <p class="text-xs uppercase tracking-wide text-(--ui-text-muted)">
              {{ field.label }}
            </p>
            <p class="mt-1 text-sm font-medium text-(--ui-text-highlighted)">
              {{ field.value }}
            </p>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex flex-wrap gap-2">
          <UButton :to="homePath" icon="i-lucide-layout-dashboard">
            กลับไปหน้าแดชบอร์ด
          </UButton>
        </div>
      </template>
    </UCard>
  </div>
</template>
