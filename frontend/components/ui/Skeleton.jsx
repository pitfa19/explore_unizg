"use client";

export default function Skeleton({ className = "", variant = "default" }) {
  const variants = {
    default: "bg-gray-200 dark:bg-gray-700",
    text: "bg-gray-200 dark:bg-gray-700 h-4 rounded",
    circular: "bg-gray-200 dark:bg-gray-700 rounded-full",
    rectangular: "bg-gray-200 dark:bg-gray-700 rounded",
  };

  return (
    <div
      className={`animate-pulse ${variants[variant]} ${className}`}
      aria-label="Loading..."
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-6 md:p-8">
      <Skeleton className="h-6 w-32 mb-4" />
      <Skeleton className="h-4 w-48 mb-6" />
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-4 rounded-xl border border-gray-200 dark:border-gray-700">
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}



