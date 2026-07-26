-- 郵便番号 (postal code) on the staff profile. The 請求明細書 and 給料計算書 carry the
-- staff member's address block, and a Japanese address is incomplete without the
-- 〒 code, so 住所 alone was not enough for アルバイトマスタ.
--
-- Nullable with no default, matching address/phone: existing rows and the June
-- seed stay valid, and an admin fills it in when they next edit the staff member.
ALTER TABLE staff_profiles ADD COLUMN postal_code TEXT;
