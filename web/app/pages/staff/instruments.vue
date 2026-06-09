<script setup lang="ts">
definePageMeta({
  middleware: 'role',
  roles: ['staff', 'admin'],
  pageTitle: 'สถานะเครื่องมือ',
  pageSubtitle: 'ดูความพร้อมใช้งานและติดตามเครื่องมือในความดูแล'
})
</script>

<template>
  <AppPlaceholderPage
    icon="i-lucide-flask-conical"
    title="หน้าสถานะเครื่องมือยังอยู่ระหว่างพัฒนา"
    description="เพิ่ม route นี้เพื่อให้เมนูของเจ้าหน้าที่นำทางได้ถูกต้องก่อน แล้วค่อยต่อยอดเป็นรายการเครื่องมือและสถานะการเตรียมใช้งานจริง"
    cta-label="กลับไปคิวงานวันนี้"
    cta-to="/staff"
  />
</template>
