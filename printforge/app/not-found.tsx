import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <div className="text-6xl">🧩</div>
      <h1 className="mt-4 text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-slate-600">The part you’re looking for isn’t on the build plate.</p>
      <Link href="/" className="btn-primary mt-6">Back to home</Link>
    </div>
  );
}
