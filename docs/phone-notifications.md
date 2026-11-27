# การแจ้งเตือนบนมือถือ

ไปที่ **ตั้งค่า > การแจ้งเตือน > ตั้งค่าและยินยอมให้มือถือแจ้งเตือน** แล้วอนุญาตในหน้าต่างของระบบ ต้องทำบนอุปกรณ์แต่ละเครื่องหลังเข้าสู่ระบบ

บน iPhone/iPad ใช้ iOS/iPadOS 16.4 ขึ้นไป เปิดด้วย Safari แล้วเลือก **แชร์ > เพิ่มไปยังหน้าจอโฮม** จากนั้นเปิดแอปผ่านไอคอนเพื่อกดยินยอม หากเคยปฏิเสธสิทธิ์ ให้เปิดใน **การตั้งค่า > การแจ้งเตือน > แอปนี้** แล้วกลับเข้าแอป ระบบตรวจสถานะใหม่เมื่อกลับมาหน้าแอป

สถานะ “เปิดสิทธิ์และบันทึกอุปกรณ์แล้ว” หมายถึงได้รับสิทธิ์และมีอุปกรณ์บันทึกใน `push_subscriptions` ของบัญชีที่เข้าสู่ระบบ ไม่ได้ยืนยันว่ารอบส่งบนเซิร์ฟเวอร์ทำงานแล้ว

## เปิดรอบส่งบนเซิร์ฟเวอร์

1. ใช้ migration ตารางแจ้งเตือนและ `active_notification_members` ตามขั้นตอนเดิมของโครงการ
2. กำหนด `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NOTIFICATION_CRON_SECRET` ใน Vercel แล้ว deploy ใหม่เมื่อเปลี่ยน public key
3. สร้าง Supabase Vault secret ชื่อ `push_cron_secret` ให้ตรงกับ `NOTIFICATION_CRON_SECRET` ห้ามใส่ค่าลับลง Git
4. รัน `supabase/setup_push_scheduler.sql` ในโครงการ Supabase ที่แอปใช้งาน สคริปต์แทนรอบเดิมทุกนาทีด้วย `home-love-push-30s` ทุก 30 วินาทีแบบ transaction เดียว ตรวจ URL ในสคริปต์ให้ตรงโดเมน production ก่อนรัน
5. ตรวจ Cron job runs และคำตอบ HTTP ใน `net._http_response` โดยไม่คัดลอก headers หรือ Vault secret ออกมา: ปกติเป็น 200 พร้อม `sent`/`failed`; 401 คือ secret ไม่ตรง, 503 คือ env ยังไม่ครบ, 500/502 คือฐานข้อมูลหรือการส่งล้มเหลว

ตัวอย่างตรวจรอบงานโดยไม่แสดงค่าลับ:

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname in ('home-love-push-minute', 'home-love-push-30s');
```

ระบบใช้เวลาไทย ตรวจย้อนหลังได้ 5 นาทีเพื่อชดเชยรอบที่สะดุด และกันส่งซ้ำต่อเหตุการณ์/อุปกรณ์ด้วย unique key ใน `push_deliveries` ส่งแบบ urgency high และ TTL 5 นาทีเพื่อไม่ค้างเตือนเก่านาน ขณะเปิดแอปจะตรวจตรงขอบนาทีและตรวจใหม่ทันทีเมื่อกลับเข้าแอป

รอบตรวจทุก 30 วินาทีเป็นเป้าหมายการเริ่มส่ง ไม่ใช่การรับประกันเวลาแสดงบนโทรศัพท์ อินเทอร์เน็ต โหมดโฟกัส การประหยัดพลังงาน และบริการ push ของระบบปฏิบัติการอาจทำให้ล่าช้า ไม่ควรใช้แทนนาฬิกาปลุกสำหรับเหตุการณ์ที่ต้องตรงวินาที

อ้างอิง: [Apple WebKit Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) และ [Supabase Cron](https://supabase.com/docs/guides/cron/quickstart)
