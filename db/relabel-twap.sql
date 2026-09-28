-- Relabel MentatMinds TWAP flow (2026-09-28, corrected): the in-house TWAP
-- address is 0x3491b228...255f. 0x1aa780bb...9ed9 was briefly mislabeled TWAP
-- (it's an external TWAP seller — organic). Precedence MM > VOLBOT > TWAP >
-- ORGANIC. Idempotent — safe to re-run (also after prod writes stale labels).

BEGIN;

-- 0x1aa7… back to ORGANIC (external trader)
UPDATE trades SET buyer_label = 'ORGANIC'
  WHERE lower(buyer) = '0x1aa780bb10425b86bcf05ecbb7953f9a93729ed9' AND buyer_label <> 'ORGANIC';
UPDATE trades SET seller_label = 'ORGANIC'
  WHERE lower(seller) = '0x1aa780bb10425b86bcf05ecbb7953f9a93729ed9' AND seller_label <> 'ORGANIC';

-- 0x3491… is the MentatMinds TWAP
UPDATE trades SET buyer_label = 'TWAP'
  WHERE lower(buyer) = '0x3491b228f114fa6cadfabff27ba001ae5220255f' AND buyer_label <> 'TWAP';
UPDATE trades SET seller_label = 'TWAP'
  WHERE lower(seller) = '0x3491b228f114fa6cadfabff27ba001ae5220255f' AND seller_label <> 'TWAP';

UPDATE trades SET bucket = CASE
    WHEN buyer_label = 'MM' OR seller_label = 'MM' THEN 'MM'
    WHEN buyer_label = 'VOLBOT' OR seller_label = 'VOLBOT' THEN 'VOLBOT'
    WHEN buyer_label = 'TWAP' OR seller_label = 'TWAP' THEN 'TWAP'
    ELSE 'ORGANIC'
  END
  WHERE bucket <> CASE
    WHEN buyer_label = 'MM' OR seller_label = 'MM' THEN 'MM'
    WHEN buyer_label = 'VOLBOT' OR seller_label = 'VOLBOT' THEN 'VOLBOT'
    WHEN buyer_label = 'TWAP' OR seller_label = 'TWAP' THEN 'TWAP'
    ELSE 'ORGANIC'
  END;

COMMIT;
