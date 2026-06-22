import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 font-extrabold">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-brand-600 text-white text-xs">PF</span>
            PrintForge <span className="text-forge-500">NZ</span>
          </div>
          <p className="mt-3 text-sm text-slate-500">
            3D printing marketplace & manufacturing platform. Made in Aotearoa New Zealand.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Services</h4>
          <ul className="mt-3 space-y-2 text-sm text-slate-500">
            <li><Link href="/quote" className="hover:text-brand-700">Instant Quote</Link></li>
            <li><Link href="/custom-request" className="hover:text-brand-700">Custom CAD Design</Link></li>
            <li><Link href="/materials" className="hover:text-brand-700">Materials</Link></li>
            <li><Link href="/products" className="hover:text-brand-700">Online Store</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Company</h4>
          <ul className="mt-3 space-y-2 text-sm text-slate-500">
            <li><Link href="/track" className="hover:text-brand-700">Track an order</Link></li>
            <li><Link href="/dashboard" className="hover:text-brand-700">My account</Link></li>
            <li><Link href="/ai-assistant" className="hover:text-brand-700">AI Design Assistant</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Payments & Shipping</h4>
          <p className="mt-3 text-sm text-slate-500">
            Stripe · Apple Pay · Google Pay · PayPal · NZ cards
          </p>
          <p className="mt-2 text-sm text-slate-500">NZ Post · Aramex NZ · CourierPost</p>
        </div>
      </div>
      <div className="border-t border-slate-100 py-4 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} PrintForge NZ. All prices in NZD incl. GST.
      </div>
    </footer>
  );
}
