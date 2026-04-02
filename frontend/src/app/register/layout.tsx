import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Account | Fayda ID Card Converter",
  description: "Sign up to convert your Fayda National ID PDF or screenshot into a print-ready ID card image.",
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
