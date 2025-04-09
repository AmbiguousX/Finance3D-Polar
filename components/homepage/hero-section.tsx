"use client";
import { ArrowRight, BarChart3 } from "lucide-react";
import Link from "next/link";
import { Button } from "../ui/button";
import { useUser } from "@clerk/nextjs";

export default function HeroSection() {
  // Get the current user information
  const { user, isSignedIn } = useUser();

  return (
    <section
      className="relative flex flex-col items-center justify-center py-20"
      aria-label="Finance3D Hero"
    >
      {/* Background gradient */}
      <div className="absolute inset-0 -z-10 h-full w-full bg-white dark:bg-black bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]">
        <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-blue-400 dark:bg-blue-500 opacity-20 blur-[100px]"></div>
      </div>

      <div className="space-y-6 text-center max-w-4xl px-4">
        {/* Pill badge */}
        <div className="mx-auto w-fit rounded-full border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-900/30 px-4 py-1 mb-6">
          <div className="flex items-center gap-2 text-sm font-medium text-blue-900 dark:text-blue-200">
            <BarChart3 className="h-4 w-4" />
            {isSignedIn && user ? (
              <span>Welcome back, {user.firstName || user.username}!</span>
            ) : (
              <span>Advanced Financial Visualization</span>
            )}
          </div>
        </div>

        {/* Main heading */}
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-900 via-blue-800 to-gray-900 dark:from-white dark:via-blue-300 dark:to-white animate-gradient-x pb-2">
          Visualize Finance in <br className="hidden sm:block" />
          3D Space
        </h1>

        {/* Subtitle */}
        <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          Transform complex financial data into intuitive 3D visualizations.
          Make better decisions with our advanced analytics platform.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-wrap justify-center items-center gap-4 pt-4">
          <Link href="/dashboard">
            <Button
              size="lg"
              className="bg-blue-600 hover:bg-blue-500 text-white rounded-full px-8 h-12"
            >
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>

          <Link href="/pricing">
            <Button
              variant="outline"
              size="lg"
              className="rounded-full px-8 h-12 border-2"
            >
              View Pricing
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
