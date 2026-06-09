<script setup lang="ts">
import { getDisplayStatus, type Booking } from '~/types/booking'

const props = defineProps<{
  booking: Pick<Booking, 'status' | 'staffStatus'>
  size?: 'sm' | 'md' | 'lg'
}>()

const display = computed(() => getDisplayStatus(props.booking))
</script>

<template>
  <UBadge
    :label="display.label"
    :color="display.color"
    :icon="display.icon"
    variant="subtle"
    :size="size || 'md'"
  />
</template>
