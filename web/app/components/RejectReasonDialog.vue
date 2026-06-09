<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
  loading?: boolean
}>()

const emit = defineEmits(['update:modelValue', 'confirm'])

const reason = ref('')

function handleConfirm() {
  if (!reason.value.trim()) return
  emit('confirm', reason.value)
  reason.value = ''
}
</script>

<template>
  <UModal :model-value="modelValue" @update:model-value="(val: boolean) => emit('update:modelValue', val)">
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-base font-semibold leading-6">
            ระบุเหตุผลที่ไม่อนุมัติ
          </h3>
          <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="emit('update:modelValue', false)" />
        </div>
      </template>

      <div class="p-4 space-y-4">
        <UFormField label="เหตุผล / Rejection Reason" required>
          <UTextarea
            v-model="reason"
            placeholder="เช่น ช่วงเวลาซ้ำซ้อน, เครื่องมืองดให้บริการ..."
            autofocus
            :rows="4"
            size="lg"
            class="w-full"
          />
        </UFormField>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            label="ยกเลิก"
            @click="emit('update:modelValue', false)"
          />
          <UButton
            color="error"
            label="ยืนยันไม่อนุมัติ"
            :loading="loading"
            :disabled="!reason.trim()"
            @click="handleConfirm"
          />
        </div>
      </template>
    </UCard>
  </UModal>
</template>
