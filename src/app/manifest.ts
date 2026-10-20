
import type { MetadataRoute } from "next";

const manifest: MetadataRoute.Manifest = {
  id: "/",
  name: "Ledger — Money, in perspective",
  short_name: "Ledger",
  description: "Understand your money with clarity.",
  start_url: "/",
  display: "standalone",
  background_color: "#08090b",
  theme_color: "#08090b",
  icons: [
    {
      src: "/ledger-icon.svg",
      sizes: "any",
      type: "image/svg+xml",
      purpose: "any",
    },
  ],
};

export default function getManifest(): MetadataRoute.Manifest {
  return manifest;
}
