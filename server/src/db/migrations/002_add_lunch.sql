-- 弁当代有無 (lunch allowance ○/×): the staff's per-day declaration of whether the
-- lunch allowance applies. On the 勤務表 this is the 弁当代有無 column (有/無). It is
-- only offered when the day's worked time exceeds 6 hours, per the note printed on
-- the form ("弁当代の支給は…1日の労働時間が6時間を超える場合に限る").
--
-- This is a ○/× flag, NOT a duration — lunch is not deducted from worked time.
-- Added as a follow-up migration so an existing Neon database upgrades in place;
-- defaults to false, so every existing row and the June seed are unchanged.
ALTER TABLE attendance ADD COLUMN lunch_allowance BOOLEAN NOT NULL DEFAULT FALSE;
