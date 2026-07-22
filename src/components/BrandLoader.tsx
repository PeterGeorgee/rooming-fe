export function BrandLoader({ label = "Loading...", fullscreen = false, overlay = false }: { label?: string; fullscreen?: boolean; overlay?: boolean }) {
  return <div className={`brand-loader${fullscreen ? " fullscreen" : ""}${overlay ? " overlay" : ""}`} role="status" aria-live="polite">
    <div className="brand-loader-mark">
      <img src="/vault-hq-logo.png" alt="" />
      <span aria-hidden="true" />
    </div>
    <p>{label}</p>
  </div>;
}
