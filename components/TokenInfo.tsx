"use client";

import { useState } from "react";
import {
  HTAO_TOKEN_INDEX,
  HTAO_TOKEN_ID,
  HTAO_EVM_CONTRACT,
  PAIR_COIN,
} from "@/lib/hl";
import type { Overview } from "@/lib/hl";
import { Panel } from "./Panel";

function Copyable({ label, value, href }: { label: string; value: string; href?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };
  return (
    <div className="flex items-center justify-between gap-2 border-b border-bg-line/60 py-1.5">
      <span className="label shrink-0">{label}</span>
      <div className="flex min-w-0 items-center gap-2">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="tnum truncate text-xs text-term-text hover:text-term-green"
          >
            {value}
          </a>
        ) : (
          <span className="tnum truncate text-xs text-term-text">{value}</span>
        )}
        <button
          onClick={copy}
          className="shrink-0 text-[10px] text-term-muted hover:text-term-green"
          title="copy"
        >
          {copied ? "✓" : "⧉"}
        </button>
      </div>
    </div>
  );
}

export function TokenInfo({ ov }: { ov: Overview | null }) {
  const contract = ov?.evmContract ?? HTAO_EVM_CONTRACT;
  return (
    <Panel title="ASSET" right={<span className="tnum">HIP-1 · LayerZero</span>}>
      <div className="px-3 py-1 text-xs">
        <Copyable label="NAME" value="Hyper TAO (HTAO)" />
        <Copyable label="SPOT PAIR" value={`${PAIR_COIN} · HTAO/USDC`} />
        <Copyable label="TOKEN INDEX" value={String(HTAO_TOKEN_INDEX)} />
        <Copyable label="TOKEN ID" value={HTAO_TOKEN_ID} />
        <Copyable
          label="EVM CONTRACT"
          value={contract}
          href={`https://hyperevmscan.io/address/${contract}`}
        />
        <Copyable label="SZ DECIMALS" value={String(ov?.szDecimals ?? 2)} />
        <Copyable label="WEI DECIMALS" value={String(ov?.weiDecimals ?? 8)} />
        <div className="pt-2 text-[10px] leading-relaxed text-term-muted">
          HTAO is Bittensor TAO bridged to Hyperliquid via LayerZero. It trades on HyperCore
          spot as <span className="text-term-green">{PAIR_COIN}</span> and mirrors the native
          TAO price. Market-made by MentatMinds (delta-neutral, hedged on MEXC).
        </div>
      </div>
    </Panel>
  );
}
