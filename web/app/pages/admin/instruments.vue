<script setup lang="ts">
definePageMeta({
  middleware: 'role',
  roles: ['admin'],
  pageTitle: 'เครื่องมือ',
  pageSubtitle: 'จัดการรายการเครื่องมือวิทยาศาสตร์และข้อมูลพื้นฐาน'
})
</script>

<template>
  <AppPlaceholderPage
    icon="i-lucide-flask-conical"
    title="หน้าจัดการเครื่องมือยังอยู่ระหว่างพัฒนา"
    description="เส้นทางสำหรับผู้ดูแลระบบถูกสร้างไว้แล้ว เพื่อให้เมนูทำงานครบและพร้อมสำหรับเพิ่มฟอร์มจัดการเครื่องมือในรอบถัดไป"
    cta-label="กลับไปผู้ใช้งานระบบ"
    cta-to="/admin/users"
  />
</template>
