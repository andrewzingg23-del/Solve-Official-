"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ChangeEvent } from "react";
import type { SpaceAppearance } from "@/lib/product/appearance";
import {
  instagramProfileUrl,
  suggestInstagramAppearance,
  type InstagramAnalysis
} from "@/lib/product/instagram-style";
import { applyInstagramInspiredLook } from "./actions";

type ProposedLook = { next: SpaceAppearance; analysis: InstagramAnalysis };

const MAX_PHOTOS = 8;
const MAX_BYTES = 10 * 1024 * 1024;
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function hueOf(red: number, green: number, blue: number): { hue: number; saturation: number } {
  const r = red / 255, g = green / 255, b = blue / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const spread = max - min;
  if (spread < 0.055 || max < 0.13 || max > 0.96) return { hue: -1, saturation: 0 };
  let h = 0;
  if (max === r) h = ((g - b) / spread) % 6;
  else if (max === g) h = (b - r) / spread + 2;
  else h = (r - g) / spread + 4;
  const saturation = max === 0 ? 0 : spread / max;
  return { hue: (h * 60 + 360) % 360, saturation };
}

// Entirely on the device. No image bytes, login cookies or media are sent to SOLVE.
async function samplePhotoHue(file: File): Promise<number> {
  const src = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Image could not be decoded"));
      image.src = src;
    });
    const canvas = document.createElement("canvas");
    canvas.width = 72;
    canvas.height = 72;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Image processing is unavailable");
    context.drawImage(image, 0, 0, 72, 72);
    const pixels = context.getImageData(0, 0, 72, 72).data;
    const buckets = Array.from({ length: 36 }, () => 0);
    for (let i = 0; i < pixels.length; i += 16) {
      if (pixels[i + 3] < 215) continue;
      const { hue, saturation } = hueOf(pixels[i], pixels[i + 1], pixels[i + 2]);
      if (hue < 0 || saturation < 0.20) continue;
      buckets[Math.floor(hue / 10)] += saturation;
    }
    const largest = Math.max(...buckets);
    return largest > 0 ? buckets.indexOf(largest) * 10 + 5 : -1;
  } finally {
    URL.revokeObjectURL(src);
  }
}

const toneColors: Record<SpaceAppearance["tone"], [string,string]> = {
  graphite: ["#0e141c","#edf0f5"],
  ocean: ["#123148","#8cc9dd"],
  mint: ["#19382e","#b1e2d0"],
  sunset: ["#3f2730","#edb187"],
  violet: ["#2a2343","#cab8e9"]
};

export function InstagramStyleStudio({ initialAppearance }: { initialAppearance: SpaceAppearance }) {
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [captions, setCaptions] = useState("");
  const [proposal, setProposal] = useState<ProposedLook | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const profileUrl = instagramProfileUrl(handle);

  function onFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = [...(event.target.files || [])];
    setNotice("");
    setProposal(null);
    if (selected.length > MAX_PHOTOS || selected.some(file => !PHOTO_TYPES.has(file.type) || file.size > MAX_BYTES)) {
      setFiles([]);
      setNotice("Choose up to 8 JPG, PNG or WebP photos, each under 10 MB.");
      return;
    }
    setFiles(selected);
  }

  async function preview() {
    if (busy || saving) return;
    if (!files.length && !captions.trim()) {
      setNotice("Choose photos from your Instagram posts or paste captions to make a real style preview.");
      return;
    }
    setBusy(true);
    setNotice("");
    setProposal(null);
    try {
      const photoHues: number[] = [];
      for (const file of files) photoHues.push(await samplePhotoHue(file));
      const result = suggestInstagramAppearance(initialAppearance, photoHues, captions);
      if (!result.analysis) {
        setNotice("There wasn't enough visible source information to propose a look. Try adding photos.");
      } else {
        setProposal({ next: result.next, analysis: result.analysis });
      }
    } catch {
      setNotice("One of the selected photos couldn't be read on this device. Try a JPG or PNG.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!proposal || saving) return;
    setSaving(true);
    setNotice("");
    try {
      const result = await applyInstagramInspiredLook(proposal.next, proposal.analysis.source);
      if (!result.ok) {
        setNotice(result.error);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setNotice("Your appearance wasn't confirmed. The preview is still here; retry when connected.");
    } finally {
      setSaving(false);
    }
  }

  return <main className="ig-personalizer">
    <header className="ig-head">
      <Link href="/" className="ig-wordmark">SOLVE</Link>
      <span>Personalize your reality</span>
      <Link href="/" className="ig-exit">Back to SOLVE</Link>
    </header>
    <div className="ig-body">
      <div className="ig-copy">
        <span className="ig-eyebrow">YOUR SOURCES · YOUR CHOICE</span>
        <h1>Make SOLVE feel like you.</h1>
        <p>Let your own Instagram content shape your Space. Preview the result before anything changes.</p>
        <div className="ig-source">
          <h2>1. Find your Instagram</h2>
          <label htmlFor="ig-profile">Your username or profile link</label>
          <input id="ig-profile" type="text" autoComplete="off" placeholder="@yourinstagram" maxLength={250} value={handle} onChange={event => setHandle(event.target.value)}/>
          <p>{profileUrl ? <a href={profileUrl} target="_blank" rel="noopener noreferrer">Open this profile on Instagram ↗</a>
            : "Enter your handle to open the right profile. SOLVE won't assume someone else's account belongs to you."}</p>
        </div>
        <div className="ig-source">
          <h2>2. Choose content to use</h2>
          <label htmlFor="ig-photos">Select photos from your Instagram posts</label>
          <input id="ig-photos" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={onFiles}/>
          <p>{files.length ? files.length + " photo" + (files.length === 1 ? "" : "s") + " selected · processed on this device" : "Up to 8 photos. Your files stay on this device."}</p>
          <label htmlFor="ig-captions">Captions (optional)</label>
          <textarea id="ig-captions" rows={3} maxLength={10000} value={captions} placeholder="Paste captions from posts that represent your style…" onChange={event => { setCaptions(event.target.value); setProposal(null); }} />
          <p>Only what you choose is analyzed. No followers, private messages or account passwords are requested.</p>
        </div>
        <button className="ig-action" type="button" disabled={busy || saving} onClick={() => void preview()}>{busy ? "Reading selected content…" : "Preview my look"}</button>
        {notice ? <p className="ig-alert" role="alert">{notice}</p> : null}
      </div>
      <aside className="ig-review" aria-label="Your appearance preview">
        <div className="ig-review-top">
          <span>3. Review your Space</span>
          <span>{proposal ? "Proposed · Not applied" : "Waiting for your content"}</span>
        </div>
        <div className="ig-look" style={{
          background: proposal ? toneColors[proposal.next.tone][0] : "#161b23",
          color: proposal ? toneColors[proposal.next.tone][1] : "#e9edf4"
        }}>
          <div className="ig-look-heading">S O L V E <span>YOUR SPACE</span></div>
          <div className="ig-look-content">
            <span>What matters to you, in one place.</span>
            <strong>Your Space.</strong>
            <div className="ig-look-controls"><span>Work</span><span>People</span><span>Create</span></div>
          </div>
        </div>
        {proposal ? <>
          <div className="ig-analysis">
            <strong>{proposal.next.tone[0].toUpperCase() + proposal.next.tone.slice(1)} · Suggested mood</strong>
            <p>{proposal.analysis.explanation}</p>
            <small>{proposal.analysis.photosRead} selected photos · {proposal.analysis.captionsRead} caption lines</small>
          </div>
          <div className="ig-buttons">
            <button type="button" className="ig-action" disabled={saving} onClick={() => void save()}>{saving ? "Applying…" : "Apply to my SOLVE"}</button>
            <button type="button" className="ig-discard" disabled={saving} onClick={() => { setProposal(null); setNotice("Preview discarded. Your Space is unchanged."); }}>Discard</button>
          </div>
        </> : <p className="ig-await">A real preview appears here after you choose content. Nothing changes automatically.</p>}
        <div className="ig-boundary"><strong>About Instagram access</strong><p>Official direct reading requires a supported Instagram Creator or Business connection. Personal accounts cannot currently be read through Meta's professional API. This version uses your explicitly selected photos and captions instead—never a simulated search.</p></div>
      </aside>
    </div>
  </main>;
}
