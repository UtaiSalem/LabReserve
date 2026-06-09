<script setup lang="ts">
definePageMeta({
  middleware: 'role',
  roles: ['admin'],
  pageTitle: 'ตั้งค่า',
  pageSubtitle: 'กำหนดค่าระบบและพารามิเตอร์สำคัญของแอป'
})
</script>

<template>
  <AppPlaceholderPage
    icon="i-lucide-settings"
    title="หน้าตั้งค่าระบบยังอยู่ระหว่างพัฒนา"
    description="route นี้ช่วยปิดช่องว่างของ navigation ฝั่งผู้ดูแลระบบก่อน เพื่อให้ค่อย ๆ เติมการตั้งค่าเชิงลึกได้โดยไม่เจอ router warning"
    cta-label="กลับไปผู้ใช้งานระบบ"
    cta-to="/admin/users"
  />
</template>
