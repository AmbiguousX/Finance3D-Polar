import NavBar from "@/components/wrapper/navbar";
import { ReactNode } from "react";

export default function PagesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <NavBar />
      <div className="pt-20">
        {children}
      </div>
    </div>
  );
}
