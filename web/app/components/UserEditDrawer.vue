<script setup lang="ts">
import type { CurrentUser, UserRole } from '~/composables/useAuth'

const props = defineProps<{
  user: CurrentUser | null
  open: boolean
}>()

const emit = defineEmits(['update:open', 'save'])

const form = reactive({
  name: '',
  email: '',
  department: '',
  role: 'requester' as UserRole,
  active: true
})

watch(() => props.user, (u) => {
  if (u) {
    form.name = u.name || ''
    form.email = u.email || ''
    form.department = u.department || ''
    form.role = u.role
    form.active = u.active !== false
  }
}, { immediate: true })

const roles: { label: string; value: UserRole }[] = [
  { label: 'ผู้จอง (Requester)', value: 'requester' },
  { label: 'ผู้อนุมัติ (Approver)', value: 'approver' },
  { label: 'เจ้าหน้าที่ (Staff)', value: 'staff' },
  { label: 'ผู้ดูแลระบบ (Admin)', value: 'admin' }
]

function handleSubmit() {
  emit('save', { ...form })
}
</script>

<template>
  <USlideover
    :model-value="open"
    @update:model-value="(val: boolean) => emit('update:open', val)"
    title="แก้ไขผู้ใช้งาน"
    :ui="{ content: 'w-full max-w-md' }"
  >
    <template #content>
      <div class="h-full flex flex-col">
        <div class="p-4 border-b border-(--ui-border) flex items-center justify-between">
          <h3 class="font-bold">แก้ไขผู้ใช้งาน: {{ user?.username }}</h3>
          <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="emit('update:open', false)" />
        </div>

        <div class="flex-1 overflow-y-auto p-4 space-y-4">
          <UFormField label="ชื่อ-นามสกุล">
            <UInput v-model="form.name" block size="lg" />
          </UFormField>

          <UFormField label="อีเมล">
            <UInput v-model="form.email" type="email" block size="lg" />
          </UFormField>

          <UFormField label="หน่วยงาน/ภาควิชา">
            <UInput v-model="form.department" block size="lg" />
          </UFormField>

          <UFormField label="บทบาท (Role)">
            <USelectMenu
              v-model="form.role"
              :items="roles"
              value-key="value"
              block
              size="lg"
            />
          </UFormField>

          <UFormField label="สถานะบัญชี">
            <div class="flex items-center gap-2 mt-2">
              <USwitch v-model="form.active" />
              <span class="text-sm">{{ form.active ? 'เปิดใช้งาน' : 'ระงับการใช้งาน' }}</span>
            </div>
          </UFormField>
        </div>

        <div class="p-4 border-t border-(--ui-border) bg-(--ui-bg-elevated) flex gap-3">
          <UButton
            color="neutral"
            variant="ghost"
            label="ยกเลิก"
            class="flex-1"
            @click="emit('update:open', false)"
          />
          <UButton
            color="primary"
            label="บันทึกการเปลี่ยนแปลง"
            class="flex-1"
            @click="handleSubmit"
          />
        </div>
      </div>
    </template>
  </USlideover>
</template>
