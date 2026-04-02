import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In | Fayda ID Converter - PDF to ID Card Tool",
  description:
    "Convert your National ID PDF to a high-quality, print-ready ID card format instantly. The most reliable Fayda ID converter for Ethiopian digital IDs.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
