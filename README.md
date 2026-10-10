# บ้านใจ — Home Organizer

Next.js PWA สำหรับบันทึกข้อมูลในบ้าน ข้อมูลออนไลน์ใช้ Supabase Auth, PostgreSQL และ Storage โดยกำหนดสิทธิ์ด้วย Row Level Security (RLS)

## เริ่มใช้งานในเครื่อง

```bash
npm install
npm run dev
```

หากยังไม่ได้ตั้งค่า Supabase แอปยังใช้ข้อมูลในเบราว์เซอร์ตามเดิม

## ตั้งค่า Supabase

1. สร้าง Supabase project และเปิด SQL Editor
2. รัน [migration](supabase/migrations/20261010000000_initial.sql) เพื่อสร้างตาราง, RLS และ Storage bucket แบบส่วนตัว
3. ใน Authentication > URL Configuration ตั้ง Site URL เป็น URL ของเว็บบน Vercel และเพิ่ม `http://localhost:3001` ใน Redirect URLs สำหรับการพัฒนา (เพิ่มพอร์ตที่ใช้งานจริงด้วย)
4. เปิด Email provider ใน Authentication
5. คัดลอก `.env.example` เป็น `.env.local` แล้วกรอก Project URL และ publishable key หรือ anon key (ไม่ใช้ service role key ใน frontend)
6. รีสตาร์ตเซิร์ฟเวอร์ Next.js

เมื่อเข้าสู่ระบบครั้งแรก แอปสร้างบ้านส่วนตัวอัตโนมัติ หากบัญชีนี้ยังไม่มีรายการออนไลน์และมีบันทึกเดิมในเบราว์เซอร์ แอปจะแสดงปุ่มให้เลือกนำเข้าข้อมูลเดิม โดยไม่ลบต้นฉบับในเบราว์เซอร์ รูปภาพและเอกสารจะถูกย้ายเข้า Storage ส่วนตัวหลังจากกดนำเข้า

## ตั้งค่า Vercel

1. Import repository `mackkydev/home-love` ใน Vercel
2. ตั้ง Environment Variables `NEXT_PUBLIC_SUPABASE_URL` และ `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` จาก Supabase project
3. Deploy แล้วเพิ่ม URL จริงใน Supabase Authentication > URL Configuration

ค่าทั้งสองเป็นค่าที่เปิดเผยได้ในเว็บ สิทธิ์เข้าถึงข้อมูลบังคับโดย RLS ฝั่งฐานข้อมูล อย่าใส่ secret key หรือ service role key ใน `NEXT_PUBLIC_` variables

## สถานะปัจจุบัน

- มีการเข้าสู่ระบบผ่านลิงก์อีเมลและจัดเก็บบันทึกออนไลน์
- ตารางรองรับสมาชิกหลายคนต่อบ้านและบทบาท `owner`, `admin`, `member`
- ยังไม่มีหน้าจอเชิญสมาชิกหรือจัดการสิทธิ์ จึงสร้างบ้านส่วนตัวให้แต่ละบัญชีก่อน
- ยังไม่มีระบบ subscription หรือการรับชำระเงิน
- บันทึกที่ผู้ใช้แก้ไขจะซิงก์หลังจากหยุดพิมพ์สั้น ๆ หากการซิงก์มีปัญหา แอปจะแสดงข้อความผิดพลาด
