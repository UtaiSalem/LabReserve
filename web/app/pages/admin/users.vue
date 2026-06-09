<script setup lang="ts">
import type { CurrentUser } from '~/composables/useAuth'

definePageMeta({
  middleware: 'role',
  roles: ['admin'],
  pageTitle: 'ผู้ใช้งานระบบ',
  pageSubtitle: 'จัดการบัญชีและบทบาท'
})

const { users, loading, fetchUsers, updateProfile } = useAdmin()
const toast = useToast()

await fetchUsers()

const search = ref('')
const roleFilter = ref<string>('all')

const roles = [
  { label: 'ทั้งหมด', value: 'all' },
  { label: 'ผู้จอง', value: 'requester' },
  { label: 'ผู้อนุมัติ', value: 'approver' },
  { label: 'เจ้าหน้าที่', value: 'staff' },
  { label: 'แอดมิน', value: 'admin' }
]

const filteredUsers = computed(() => {
  return users.value.filter(u => {
    const matchesSearch = !search.value || 
      u.username.toLowerCase().includes(search.value.toLowerCase()) ||
      (u.name || '').toLowerCase().includes(search.value.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(search.value.toLowerCase())
    
    const matchesRole = roleFilter.value === 'all' || u.role === roleFilter.value
    
    return matchesSearch && matchesRole
  })
})

const selectedUser = ref<CurrentUser | null>(null)
const isDrawerOpen = ref(false)

function editUser(u: CurrentUser) {
  selectedUser.value = u
  isDrawerOpen.value = true
}

async function handleSave(body: any) {
  if (!selectedUser.value) return
  try {
    await updateProfile(selectedUser.value.username, body)
    isDrawerOpen.value = false
    toast.add({ title: 'อัปเดตข้อมูลเรียบร้อย', color: 'success' })
  } catch (err: any) {
    toast.add({ title: 'เกิดข้อผิดพลาด', description: err.data?.error || 'ไม่สามารถบันทึกได้', color: 'error' })
  }
}

const roleLabels: Record<string, string> = {
  requester: 'ผู้จอง',
  approver: 'ผู้อนุมัติ',
  staff: 'เจ้าหน้าที่',
  admin: 'แอดมิน'
}

const roleColors: Record<string, string> = {
  requester: 'neutral',
  approver: 'primary',
  staff: 'warning',
  admin: 'error'
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col md:flex-row gap-4 items-center justify-between">
      <div class="flex flex-1 gap-2 w-full">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="ค้นหาชื่อ, อีเมล, username..."
          class="flex-1"
          size="lg"
        />
        <USelectMenu
          v-model="roleFilter"
          :items="roles"
          value-key="value"
          class="w-40"
          size="lg"
        />
      </div>
      <UButton
        icon="i-lucide-refresh-cw"
        variant="ghost"
        color="neutral"
        :loading="loading"
        @click="fetchUsers"
      />
    </div>

    <UCard :ui="{ body: 'p-0' }" class="overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-(--ui-bg-elevated) border-b border-(--ui-border)">
              <th class="px-4 py-3 text-xs font-bold uppercase text-(--ui-text-muted)">ผู้ใช้งาน</th>
              <th class="px-4 py-3 text-xs font-bold uppercase text-(--ui-text-muted)">บทบาท</th>
              <th class="px-4 py-3 text-xs font-bold uppercase text-(--ui-text-muted)">หน่วยงาน</th>
              <th class="px-4 py-3 text-xs font-bold uppercase text-(--ui-text-muted)">สถานะ</th>
              <th class="px-4 py-3 text-xs font-bold uppercase text-(--ui-text-muted) text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-(--ui-border)">
            <tr v-if="filteredUsers.length === 0" class="hover:bg-(--ui-bg-elevated)/50 transition-colors">
              <td colspan="5" class="px-4 py-10 text-center text-(--ui-text-muted)">
                ไม่พบข้อมูลผู้ใช้งาน
              </td>
            </tr>
            <tr 
              v-for="u in filteredUsers" 
              :key="u.username"
              class="hover:bg-(--ui-bg-elevated)/50 transition-colors"
            >
              <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                  <UAvatar :alt="u.name || u.username" size="sm" />
                  <div class="min-w-0">
                    <p class="text-sm font-bold text-(--ui-text-highlighted) truncate">{{ u.name || '-' }}</p>
                    <p class="text-xs text-(--ui-text-muted) truncate">@{{ u.username }}</p>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3">
                <UBadge :color="(roleColors[u.role] as any)" variant="subtle" size="sm">
                  {{ roleLabels[u.role] }}
                </UBadge>
              </td>
              <td class="px-4 py-3 text-sm text-(--ui-text-muted)">
                {{ u.department || '-' }}
              </td>
              <td class="px-4 py-3">
                <UBadge :color="u.active !== false ? 'success' : 'neutral'" variant="solid" size="xs" class="rounded-full">
                  {{ u.active !== false ? 'ปกติ' : 'ระงับ' }}
                </UBadge>
              </td>
              <td class="px-4 py-3 text-right">
                <UButton
                  icon="i-lucide-edit-3"
                  variant="ghost"
                  color="neutral"
                  size="sm"
                  @click="editUser(u)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <UserEditDrawer
      v-model:open="isDrawerOpen"
      :user="selectedUser"
      @save="handleSave"
    />
  </div>
</template>
