import { useEffect, useRef, useState } from "react";
import { CloseIcon, FlashIcon } from "../components/ui";
import { MAX_PAGES, readMenu } from "../lib/menuStore";
import { captureFrame, fromFile, release, type MenuPhoto } from "../lib/photos";
import { navigate } from "../lib/router";

type Camera = { status: "starting" } | { status: "live"; torch: boolean } | { status: "off"; reason: string };

// Torch isn't in TypeScript's DOM types yet; Android Chrome supports it.
type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };

export function Capture() {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [camera, setCamera] = useState<Camera>({ status: "starting" });
  const [torchOn, setTorchOn] = useState(false);
  const [pages, setPages] = useState<MenuPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const handedOff = useRef(false);
  const pagesRef = useRef(pages);
  pagesRef.current = pages;

  useEffect(() => {
    let cancelled = false;
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamera({ status: "off", reason: "This browser can't open the camera here." });
        return;
      }
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play().catch(() => {});
        }
        const track = s.getVideoTracks()[0];
        const caps = (track.getCapabilities?.() ?? {}) as TorchCapabilities;
        setCamera({ status: "live", torch: caps.torch === true });
      } catch (err) {
        const denied = err instanceof DOMException && err.name === "NotAllowedError";
        setCamera({
          status: "off",
          reason: denied ? "Camera access is off for Picky." : "We couldn't open the camera.",
        });
      }
    }
    start();
    return () => {
      cancelled = true;
      stream.current?.getTracks().forEach((t) => t.stop());
      if (!handedOff.current) release(pagesRef.current);
    };
  }, []);

  async function toggleTorch() {
    const track = stream.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {
      // Some phones report torch but refuse it; leave the button as it was.
    }
  }

  async function snap() {
    if (!video.current || pages.length >= MAX_PAGES) return;
    setBusy(true);
    try {
      const photo = await captureFrame(video.current);
      setPages((p) => [...p, photo]);
    } finally {
      setBusy(false);
    }
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const room = MAX_PAGES - pages.length;
      const added = await Promise.all(Array.from(files).slice(0, room).map(fromFile));
      setPages((p) => [...p, ...added]);
    } finally {
      setBusy(false);
    }
  }

  function removePage(index: number) {
    setPages((p) => {
      release([p[index]]);
      return p.filter((_, i) => i !== index);
    });
  }

  function read() {
    handedOff.current = true;
    readMenu(pages);
    navigate("/reading", { replace: true });
  }

  const full = pages.length >= MAX_PAGES;

  return (
    <main className="screen camera">
      <div className="topbar">
        <button
          type="button"
          className="round-btn"
          aria-label="Close camera"
          onClick={() => navigate("/", { replace: true })}
        >
          <CloseIcon />
        </button>
        <div className="display" style={{ fontSize: 18 }}>
          Snap the menu
        </div>
        {camera.status === "live" && camera.torch ? (
          <button
            type="button"
            className="round-btn"
            aria-label={torchOn ? "Turn off flash" : "Turn on flash"}
            aria-pressed={torchOn}
            onClick={toggleTorch}
            style={torchOn ? { background: "#fff", color: "#2A1A18" } : undefined}
          >
            <FlashIcon />
          </button>
        ) : (
          <span style={{ width: 44 }} />
        )}
      </div>

      <div className="viewfinder">
        <video ref={video} playsInline muted />
        {camera.status === "off" && (
          <p className="no-camera">
            {camera.reason} Tap <b>Upload</b> to pick a photo of the menu instead.
          </p>
        )}
        {camera.status === "live" && (
          <>
            <span className="corner tl" />
            <span className="corner tr" />
            <span className="corner bl" />
            <span className="corner br" />
            <div className="hint">
              {full ? "That's the most pages we can read at once" : "Fit one page inside the corners"}
            </div>
          </>
        )}
      </div>

      <div className="pages">
        {pages.map((p, i) => (
          <button
            key={p.url}
            type="button"
            className="page-thumb"
            aria-label={`Remove page ${i + 1}`}
            onClick={() => removePage(i)}
          >
            <img src={p.url} alt="" />
            <span className="count">{i + 1}</span>
          </button>
        ))}
        <div className="help">
          {pages.length === 0
            ? "Got more than one page or a specials board? Snap each one."
            : full
              ? "Tap a page to remove it."
              : "Snap another page, or tap one to remove it."}
        </div>
      </div>

      <div className="shutter-row">
        <label className="link-btn upload">
          Upload
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={busy || full}
            onChange={(e) => {
              upload(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            type="button"
            className="shutter"
            aria-label="Take photo"
            disabled={camera.status !== "live" || busy || full}
            onClick={snap}
          >
            <span />
          </button>
        </div>
        <button type="button" className="read-btn" disabled={pages.length === 0 || busy} onClick={read}>
          Read it
        </button>
      </div>
      <div className="small center">We read the photo, then throw it away. We never keep it.</div>
    </main>
  );
}
