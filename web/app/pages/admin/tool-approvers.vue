<script setup lang="ts">
import { useSnapshot } from '~/composables/useBookings'

definePageMeta({
  middleware: 'role',
  roles: ['admin'],
  pageTitle: 'ตั้งค่าผู้อนุมัติ',
  pageSubtitle: 'จับคู่เครื่องมือกับผู้มีสิทธิ์อนุมัติ'
})

const { data: snapshot, ensure: ensureSnapshot } = useSnapshot()
const { toolApprovers, users, fetchToolApprovers, fetchUsers, addToolApprover, removeToolApprover, loading } = useAdmin()
const toast = useToast()

await Promise.all([
  ensureSnapshot(),
  fetchToolApprovers(),
  fetchUsers()
])

const tools = computed(() => snapshot.value?.tools || [])

const approverCandidates = computed(() => {
  return users.value
    .filter(u => u.role === 'approver' || u.role === 'admin')
    .map(u => ({ label: `${u.name} (@${u.username})`, value: u.username }))
})

const approversByTool = computed(() => {
  const map: Record<string, typeof toolApprovers.value> = {}
  tools.value.forEach(t => {
    map[t] = toolApprovers.value.filter(ta => ta.tool === t)
  })
  return map
})

async function handleAdd(tool: string, username: string) {
  try {
    await addToolApprover(tool, username)
    toast.add({ title: 'เพิ่มผู้อนุมัติเรียบร้อย', color: 'success' })
  } catch (err: any) {
    toast.add({ title: 'เกิดข้อผิดพลาด', description: err.data?.error || 'ไม่สามารถเพิ่มได้', color: 'error' })
  }
}

async function handleRemove(tool: string, username: string) {
  try {
    await removeToolApprover(tool, username)
    toast.add({ title: 'ลบผู้อนุมัติเรียบร้อย', color: 'warning' })
  } catch (err: any) {
    toast.add({ title: 'เกิดข้อผิดพลาด', description: err.data?.error || 'ไม่สามารถลบได้', color: 'error' })
  }
}
</script>

<template>
  <div class="space-y-6">
    <div v-for="tool in tools" :key="tool" class="space-y-3">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="font-bold text-(--ui-text-highlighted)">{{ tool }}</h3>
            <UBadge v-if="(approversByTool[tool]?.length ?? 0) === 0" color="error" variant="subtle">
              ยังไม่มีผู้อนุมัติ
            </UBadge>
          </div>
        </template>

        <div class="space-y-4">
          <div v-if="(approversByTool[tool]?.length ?? 0) === 0" class="text-sm text-(--ui-text-muted) py-2">
            เครื่องมือนี้ยังไม่ได้ระบุผู้อนุมัติ (ระบบจะอนุญาตให้แอดมินอนุมัติแทนได้)
          </div>
          
          <div v-else class="flex flex-wrap gap-2">
            <div
              v-for="ta in (approversByTool[tool] ?? [])"
              :key="ta.approver_username"
              class="flex items-center gap-2 bg-(--ui-bg-elevated) px-3 py-1.5 rounded-full border border-(--ui-border)"
            >
              <UAvatar :alt="ta.name" size="xs" />
              <span class="text-sm font-medium">{{ ta.name }}</span>
              <UButton
                icon="i-lucide-x"
                variant="ghost"
                color="neutral"
                size="xs"
                :loading="loading"
                class="rounded-full -mr-1"
                @click="handleRemove(tool, ta.approver_username)"
              />
            </div>
          </div>

          <div class="pt-2 border-t border-(--ui-border) flex items-center gap-2">
            <USelectMenu
              placeholder="เพิ่มผู้อนุมัติ..."
              :items="approverCandidates"
              class="flex-1"
              searchable
              @update:model-value="val => handleAdd(tool, (val as any).value)"
            />
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
