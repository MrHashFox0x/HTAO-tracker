-- Relabel MM flow (2026-09-28): the MM ran on two wallets — v1
-- 0x11f9a5bd...dcf00 (June–Sept history) then v2 0xbbf18320...cf61 (current).
-- Both classify as MM. Idempotent — safe to re-run.

BEGIN;

UPDATE trades SET buyer_label = 'MM'
  WHERE lower(buyer) IN (
    '0xbbf18320cf13005771874c2af18dd9253a8ecf61',
    '0x11f9a5bd171bdb5f71126d59276072f4b76dcf00'
  ) AND buyer_label <> 'MM';

UPDATE trades SET seller_label = 'MM'
  WHERE lower(seller) IN (
    '0xbbf18320cf13005771874c2af18dd9253a8ecf61',
    '0x11f9a5bd171bdb5f71126d59276072f4b76dcf00'
  ) AND seller_label <> 'MM';

-- Recompute the single-bucket classification (precedence MM > VOLBOT > ORGANIC)
UPDATE trades SET bucket = CASE
    WHEN buyer_label = 'MM' OR seller_label = 'MM' THEN 'MM'
    WHEN buyer_label = 'VOLBOT' OR seller_label = 'VOLBOT' THEN 'VOLBOT'
    ELSE 'ORGANIC'
  END
  WHERE bucket <> CASE
    WHEN buyer_label = 'MM' OR seller_label = 'MM' THEN 'MM'
    WHEN buyer_label = 'VOLBOT' OR seller_label = 'VOLBOT' THEN 'VOLBOT'
    ELSE 'ORGANIC'
  END;

COMMIT;
