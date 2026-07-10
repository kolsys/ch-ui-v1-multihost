import { ConnectionEnvironment } from "@/types/common";
import { ENV_HEX_COLOR } from "@/lib/environments";
import { withBasePath } from "@/lib/basePath";

const FAVICON_SIZE = 64;

let baseLogoImage: HTMLImageElement | null = null;
let baseLogoLoadPromise: Promise<HTMLImageElement> | null = null;

function loadBaseLogo(): Promise<HTMLImageElement> {
  if (baseLogoImage) return Promise.resolve(baseLogoImage);
  if (!baseLogoLoadPromise) {
    baseLogoLoadPromise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        baseLogoImage = img;
        resolve(img);
      };
      img.onerror = reject;
      img.src = withBasePath("logo.png");
    });
  }
  return baseLogoLoadPromise;
}

function getFaviconLink(): HTMLLinkElement {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  return link;
}

/**
 * Draws the base logo with a colored corner dot for the given environment
 * and swaps the document's favicon to it. Pass `null` to restore the plain
 * logo (no active/production-flagged connection).
 */
export async function setFaviconForEnvironment(
  environment: ConnectionEnvironment | null
): Promise<void> {
  try {
    const logo = await loadBaseLogo();
    const canvas = document.createElement("canvas");
    canvas.width = FAVICON_SIZE;
    canvas.height = FAVICON_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(logo, 0, 0, FAVICON_SIZE, FAVICON_SIZE);

    if (environment) {
      const radius = FAVICON_SIZE * 0.2;
      const cx = FAVICON_SIZE - radius - 2;
      const cy = FAVICON_SIZE - radius - 2;

      // Ring for contrast against whatever's behind it in the logo artwork.
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 3, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = ENV_HEX_COLOR[environment];
      ctx.fill();
    }

    getFaviconLink().href = canvas.toDataURL("image/png");
  } catch {
    // Base logo failed to load — leave the static favicon from index.html alone.
  }
}
