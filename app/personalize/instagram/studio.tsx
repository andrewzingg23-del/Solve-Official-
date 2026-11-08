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
import { searchPublicInstagram } from "./search";
import { sourceWordsFromProfile, type PublicInstagramMatch } from "@/lib/product/instagram-public-search";

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
  const [publicMatches, setPublicMatches] = useState<PublicInstagramMatch[]>([]);
  const [searching, setSearching] = useState(false);
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

  async function lookup() {
    if (!profileUrl || searching || saving || busy) return;
    setSearching(true);
    setNotice("");
    setPublicMatches([]);
    setProposal(null);
    try {
      const result = await searchPublicInstagram(handle);
      if (!result.ok) { setNotice(result.error); return; }
      setPublicMatches(result.matches);
      if (!result.matches.length) {
        setNotice("No cited public search result could confirm that exact profile. Select your own photos for a reliable visual preview.");
        return;
      }
      // Public captions are text-only and often incomplete; never present this as reading the feed.
      const publicWords = sourceWordsFromProfile(result.matches);
      const draft = suggestInstagramAppearance(initialAppearance, [], publicWords);
      if (draft.analysis) {
        setProposal({ next: draft.next, analysis: {
          ...draft.analysis,
          source: "public-profile",
          explanation: "A tentative look using only publicly indexed text from the cited profile. SOLVE has not read your Instagram photos or private feed."
        } });
        setNotice("Public profile match found. Review the cited source and suggested look before applying.");
      } else {
        setNotice("Public profile found, but the indexed text doesn't describe its visual style. Select a few photos for a useful preview.");
      }
    } catch {
      setNotice("Public search couldn't finish. You can still choose your own photos.");
    } finally {
      setSearching(false);
    }
  }

  async function preview() {
    if (busy || saving) return;
    const indexedText = sourceWordsFromProfile(publicMatches);
    if (!files.length && !captions.trim() && !indexedText) {
      setNotice("Choose photos from your Instagram posts or paste captions to make a real style preview.");
      return;
    }
    setBusy(true);
    setNotice("");
    setProposal(null);
    try {
      const photoHues: number[] = [];
      for (const file of files) photoHues.push(await samplePhotoHue(file));
      const combinedText = [captions, indexedText].filter(Boolean).join("\n");
      const result = suggestInstagramAppearance(initialAppearance, photoHues, combinedText);
      if (!result.analysis) {
        setNotice("There wasn't enough visible source information to propose a look. Try adding photos.");
      } else {
        const indexedSource = indexedText ? files.length ? "photos-and-public" : captions.trim() ? "captions-and-public" : "public-profile" : result.analysis.source;
        setProposal({ next: result.next, analysis: {
          ...result.analysis,
          source: indexedSource,
          explanation: indexedText && !files.length
            ? "A tentative mood based on indexed public profile text. Add photos for a stronger visual match."
            : result.analysis.explanation
        } });
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
          <input id="ig-profile" type="text" autoComplete="off" placeholder="@yourinstagram" maxLength={250} value={handle} onChange={event => { setHandle(event.target.value); setPublicMatches([]); setProposal(null); setNotice(""); }}/>
          <p>{profileUrl ? <a href={profileUrl} target="_blank" rel="noopener noreferrer">Open this profile on Instagram ↗</a>
            : "Enter your handle to find the public profile. SOLVE won't assume someone else's account belongs to you."}</p>
          <button className="ig-public-search" type="button" disabled={!profileUrl || searching || busy || saving} onClick={() => void lookup()}>{searching ? "Searching public web…" : "Search public Instagram"}</button>
          {publicMatches.length ? <div className="ig-search-evidence" aria-label="Cited public Instagram sources">
            <strong>Publicly indexed match · Not account verification</strong>
            {publicMatches.map(match => <div key={match.url}>
              <a href={match.url} target="_blank" rel="noopener noreferrer">{match.title || "View indexed profile"} ↗</a>
              {match.excerpt ? <p>{match.excerpt.slice(0,320)}{match.excerpt.length > 320 ? "…" : ""}</p> : null}
            </div>)}
          </div> : null}
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
            <small>{proposal.analysis.photosRead} selected photos · {proposal.analysis.captionsRead} text lines · Source: {proposal.analysis.source.replaceAll("-", " ")}</small>
          </div>
          <div className="ig-buttons">
            <button type="button" className="ig-action" disabled={saving} onClick={() => void save()}>{saving ? "Applying…" : "Apply to my SOLVE"}</button>
            <button type="button" className="ig-discard" disabled={saving} onClick={() => { setProposal(null); setNotice("Preview discarded. Your Space is unchanged."); }}>Discard</button>
          </div>
        </> : <p className="ig-await">A real preview appears here after you choose content. Nothing changes automatically.</p>}
        <div className="ig-boundary"><strong>About Instagram access</strong><p>Public search checks indexed web results and shows citations, not a complete Instagram feed. Official direct reading requires a supported Creator/Business connection; Meta's professional API cannot read consumer-account feeds. Photos you select stay on this device.</p></div>
      </aside>
    </div>
  </main>;
}
