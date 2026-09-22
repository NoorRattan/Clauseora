import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("frontend accessibility contracts", () => {
  const landing = source("src/app/page.tsx");
  const layout = source("src/app/layout.tsx");
  const heroArtwork = source("src/app/components/landing/HeroArtwork.tsx");
  const workspace = source("src/app/components/AnalysisWorkspace.tsx");
  const uploadZone = source("src/app/components/UploadZone.tsx");
  const evidenceDrawer = source("src/app/components/EvidenceDrawer.tsx");
  const verificationBadge = source("src/app/components/VerificationBadge.tsx");
  const pageStyles = source("src/app/page.module.css");
  const globalStyles = source("src/app/globals.css");

  it("provides a skip link, main landmark, and labelled landing sections", () => {
    expect(landing).toContain('href="#main"');
    expect(landing).toContain('id="main"');
    expect(landing).toContain('aria-labelledby="hero-title"');
    expect(landing).toContain('aria-label="Main navigation"');
    expect(workspace).toContain('className="workspace-skip-link"');
    expect(workspace).toContain('id="workspace-main"');
    expect(workspace).toContain('aria-label="Document analysis workspace"');
  });

  it("publishes discoverable metadata, FAQ structured data, and image alternatives", () => {
    expect(layout).toContain("alternates: { canonical: \"/\" }");
    expect(landing).toContain('"@type": "FAQPage"');
    expect(landing).toContain('type="application/ld+json"');
    expect(heroArtwork).toContain('alt="Evidence-linked legal document illustration"');
    expect(heroArtwork).toContain("width={749}");
    expect(heroArtwork).toContain("height={568}");
    expect(heroArtwork).toContain("sizes=");
  });

  it("keeps the analysis mode switcher keyboard-navigable as a tablist", () => {
    expect(workspace).toContain('role="tablist"');
    expect(workspace).toContain('role="tab"');
    expect(workspace).toContain("aria-selected={isActive}");
    expect(workspace).toContain('aria-controls="analysis-panel"');
    expect(workspace).toContain('role="tabpanel"');
    expect(workspace).toContain('event.key === "ArrowRight"');
    expect(workspace).toContain('event.key === "ArrowLeft"');
  });

  it("gives dialogs a labelled modal contract and focus management hook", () => {
    expect(workspace).toContain('role="dialog"');
    expect(workspace).toContain('aria-modal="true"');
    expect(workspace).toContain("useDialogFocus");
    expect(evidenceDrawer).toContain('role="dialog"');
    expect(evidenceDrawer).toContain('aria-labelledby="evidence-title"');
    expect(evidenceDrawer).toContain('aria-label="Close evidence drawer"');
  });

  it("announces asynchronous errors, results, and verification state", () => {
    expect(workspace).toContain('role="alert"');
    expect(workspace).toContain('aria-live="assertive"');
    expect(workspace).toContain('aria-live="polite"');
    expect(verificationBadge).toContain('role="status"');
    expect(verificationBadge).toContain('aria-live="polite"');
  });

  it("keeps the upload surface operable without a pointer", () => {
    expect(uploadZone).toContain('role={file ? "group" : "button"}');
    expect(uploadZone).toContain("tabIndex={disabled ? -1 : 0}");
    expect(uploadZone).toContain('event.key === "Enter"');
    expect(uploadZone).toContain('event.key === " "');
    expect(uploadZone).toContain("aria-describedby=");
    expect(uploadZone).toContain("aria-labelledby=");
  });

  it("keeps focus visibility and reduced-motion behavior as maintained contracts", () => {
    expect(pageStyles).toContain(":focus-visible");
    expect(pageStyles).toContain("prefers-reduced-motion: reduce");
    expect(globalStyles).toContain(":focus-visible");
    expect(globalStyles).toContain("prefers-reduced-motion: reduce");
  });
});
